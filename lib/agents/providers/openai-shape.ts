import {
  AgentMessage,
  AgentStartInput,
  AgentTurn,
  ToolCall,
  ToolDefinition,
  AgentLoopError,
} from "../types";
import { toOpenAITools } from "../tools";

export interface OpenAIShapeConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  toolChoice?: "auto" | "required" | "none";
  /** Some servers (LM Studio variants) reject `tool_choice`. Set false to omit. */
  sendToolChoice?: boolean;
  /** Max retries on HTTP 429. Default 3. */
  maxRetries?: number;
  /** Cap on a single retry wait (ms). Default 60000. */
  maxRetryWaitMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryWaitMs(
  headers: Headers,
  body: string,
  attempt: number,
  cap = 60_000,
): number {
  // 1) Standard Retry-After header (seconds or HTTP date)
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const asInt = parseFloat(retryAfter);
    if (Number.isFinite(asInt) && asInt > 0) {
      return Math.min(cap, Math.ceil(asInt * 1000) + 250);
    }
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      const delta = dateMs - Date.now();
      if (delta > 0) return Math.min(cap, delta + 250);
    }
  }
  // 2) Groq surfaces "Please try again in 12.25s" inside the body
  const m = body.match(/try again in ([\d.]+)\s*s/i);
  if (m) {
    const secs = parseFloat(m[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(cap, Math.ceil(secs * 1000) + 250);
    }
  }
  // 3) Exponential backoff fallback: 2^attempt seconds + jitter
  const base = Math.min(cap, Math.pow(2, attempt) * 1000);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: "assistant";
      content: string | null;
      reasoning_content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
}

/**
 * Some models (e.g. Nemotron via LM Studio) emit tool calls as XML-style text
 * inside `content` or `reasoning_content` instead of populating `tool_calls`.
 * Format:
 *   <tool_call>
 *   <function=NAME>
 *   <parameter=KEY>
 *   VALUE
 *   </parameter>
 *   ...
 *   </function>
 *   </tool_call>
 *
 * Returns an array of synthesized OpenAIToolCall objects, or [] if no match.
 */
function parseXmlToolCalls(text: string | null | undefined): OpenAIToolCall[] {
  if (!text) return [];
  if (!text.includes("<tool_call>")) return [];

  const calls: OpenAIToolCall[] = [];
  const blockRe = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  const fnRe = /<function=([^>\s]+)>([\s\S]*?)<\/function>/;
  const paramRe = /<parameter=([^>\s]+)>([\s\S]*?)<\/parameter>/g;
  let match: RegExpExecArray | null;
  let idSeq = 0;

  while ((match = blockRe.exec(text)) !== null) {
    const block = match[1];
    const fn = block.match(fnRe);
    if (!fn) continue;
    const name = fn[1].trim();
    const inner = fn[2];
    const args: Record<string, unknown> = {};
    let pm: RegExpExecArray | null;
    paramRe.lastIndex = 0;
    while ((pm = paramRe.exec(inner)) !== null) {
      const key = pm[1].trim();
      const raw = pm[2].trim();
      // Coerce numbers / bools / JSON; leave string otherwise.
      args[key] = coerceValue(raw);
    }
    calls.push({
      id: `xml_call_${Date.now().toString(36)}_${idSeq++}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });
  }
  return calls;
}

function coerceValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(raw)) {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) return n;
  }
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to string
    }
  }
  return raw;
}

interface InternalState {
  systemMessage: OpenAIMessage;
  initialUserMessage: OpenAIMessage;
  /** Assistant + tool messages, in chronological order. */
  followups: OpenAIMessage[];
}

export interface OpenAIShapeSession {
  startCall(input: AgentStartInput): Promise<AgentTurn>;
  continueTurn(history: AgentMessage[], tools: ToolDefinition[]): Promise<AgentTurn>;
}

export function createOpenAIShapeSession(config: OpenAIShapeConfig): OpenAIShapeSession {
  const state: InternalState = {
    systemMessage: { role: "system", content: "" },
    initialUserMessage: { role: "user", content: "" },
    followups: [],
  };

  function buildRequestBody(messages: OpenAIMessage[], tools: ToolDefinition[]) {
    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      tools: toOpenAITools(tools),
      temperature: config.temperature ?? 0.2,
      max_tokens: config.maxTokens ?? 2048,
      stream: false,
    };
    if (config.sendToolChoice !== false) {
      body.tool_choice = config.toolChoice ?? "auto";
    }
    return body;
  }

  async function callApi(
    messages: OpenAIMessage[],
    tools: ToolDefinition[],
    attempt = 0,
  ): Promise<AgentTurn> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildRequestBody(messages, tools)),
      });
    } catch (err) {
      throw new AgentLoopError(
        "provider_error",
        `network call failed: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }
    if (res.status === 429) {
      const text = await res.text().catch(() => "");
      const waitMs = computeRetryWaitMs(
        res.headers,
        text,
        attempt,
        config.maxRetryWaitMs ?? 60_000,
      );
      const maxRetries = config.maxRetries ?? 3;
      if (attempt < maxRetries) {
        console.warn(
          `[agent:${config.baseUrl}] HTTP 429 — retrying in ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await sleep(waitMs);
        return callApi(messages, tools, attempt + 1);
      }
      throw new AgentLoopError(
        "provider_error",
        `HTTP 429 after ${maxRetries} retries from ${config.baseUrl}: ${text.slice(0, 500)}`,
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AgentLoopError(
        "provider_error",
        `HTTP ${res.status} from ${config.baseUrl}: ${text.slice(0, 500)}`,
      );
    }
    const json = (await res.json()) as OpenAIResponse;
    const choice = json.choices?.[0];
    if (!choice) {
      throw new AgentLoopError(
        "provider_error",
        `empty choices array from ${config.baseUrl}`,
      );
    }
    let rawCalls = choice.message.tool_calls ?? [];
    if (rawCalls.length === 0) {
      const fromContent = parseXmlToolCalls(choice.message.content);
      const fromReasoning = parseXmlToolCalls(choice.message.reasoning_content);
      const synth = [...fromContent, ...fromReasoning];
      if (synth.length > 0) {
        rawCalls = synth;
        // Persist into the message so appendAssistantTurn records them in history.
        choice.message.tool_calls = synth;
      }
    }
    const toolCalls: ToolCall[] = rawCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      args: parseArgs(tc.function.arguments),
    }));
    const finishMap: Record<string, AgentTurn["finishReason"]> = {
      stop: "stop",
      length: "length",
      tool_calls: "tool_use",
    };
    return {
      rawText: choice.message.content ?? undefined,
      toolCalls,
      finishReason: finishMap[choice.finish_reason] ?? "stop",
      raw: choice,
    };
  }

  function parseArgs(s: string): unknown {
    if (!s) return {};
    try {
      return JSON.parse(s);
    } catch {
      return { _raw: s };
    }
  }

  function appendAssistantTurn(turn: AgentTurn) {
    const choice = turn.raw as OpenAIResponse["choices"][0] | undefined;
    state.followups.push({
      role: "assistant",
      content: choice?.message.content ?? null,
      tool_calls: choice?.message.tool_calls,
    });
  }

  function appendToolResults(history: AgentMessage[]) {
    const last = history[history.length - 1];
    if (!last || last.role !== "tool" || !last.toolResults) return;
    for (const tr of last.toolResults) {
      const payload = tr.result.ok
        ? { ok: true, data: (tr.result as { data: unknown }).data }
        : { ok: false, error: (tr.result as { error: string }).error };
      state.followups.push({
        role: "tool",
        tool_call_id: tr.id,
        name: tr.name,
        content: JSON.stringify(payload),
      });
    }
  }

  return {
    async startCall(input) {
      state.systemMessage = { role: "system", content: input.systemPrompt };
      state.initialUserMessage = {
        role: "user",
        content: [
          { type: "text", text: input.userPrompt },
          {
            type: "image_url",
            image_url: { url: `data:${input.mimeType};base64,${input.image}` },
          },
        ],
      };
      state.followups = [];
      const messages: OpenAIMessage[] = [state.systemMessage, state.initialUserMessage];
      const turn = await callApi(messages, input.tools);
      appendAssistantTurn(turn);
      return turn;
    },

    async continueTurn(history, tools) {
      // Look at the most recent assistant turn in history that we haven't appended yet.
      // Our state.followups already has the assistant turn from the previous call.
      // The history's latest "tool" message carries new tool results — append those.
      appendToolResults(history);

      const messages: OpenAIMessage[] = [
        state.systemMessage,
        state.initialUserMessage,
        ...state.followups,
      ];
      const turn = await callApi(messages, tools);
      appendAssistantTurn(turn);
      return turn;
    },
  };
}
