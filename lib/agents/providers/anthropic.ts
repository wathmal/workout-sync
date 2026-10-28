import Anthropic from "@anthropic-ai/sdk";
import {
  AgentLoopError,
  AgentMessage,
  AgentTurn,
  IterativeAgentProvider,
  ToolDefinition,
} from "../types";
import { toAnthropicTools } from "../tools";
import { agentModelOpts, withModelRetry } from "../../models/resolve";

const FINISH_REASON: Partial<Record<string, AgentTurn["finishReason"]>> = {
  tool_use: "tool_use",
  end_turn: "stop",
  max_tokens: "length",
};

export function createAnthropicAgentProvider(): IterativeAgentProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — required for AGENT_HARNESS_PROVIDER=anthropic",
    );
  }
  // SDK retries 429/5xx with backoff; replaces openai-shape's hand-rolled 429 loop.
  const client = new Anthropic({ apiKey, maxRetries: 3 });
  const opts = agentModelOpts("anthropic");

  let model = opts.pinned;
  let system = "";
  const messages: Anthropic.MessageParam[] = [];

  async function call(tools: ToolDefinition[]): Promise<Anthropic.Message> {
    return client.messages.create({
      model,
      // max_tokens includes adaptive-thinking tokens on Claude 5.5; leave room
      // for a full proposeWorkout payload.
      max_tokens: 8192,
      system,
      tools: toAnthropicTools(tools) as Anthropic.Tool[],
      // Forced tool_choice (any/tool) 400s on Opus/Sonnet 5.5; prompt enforces tools-only.
      tool_choice: { type: "auto" },
      messages,
    });
  }

  function toTurn(res: Anthropic.Message): AgentTurn {
    if (res.stop_reason === "refusal") {
      throw new AgentLoopError(
        "provider_error",
        `Anthropic refused: ${res.stop_details?.explanation ?? res.stop_details?.category ?? "no reason given"}`,
      );
    }
    // Replay verbatim (thinking + tool_use blocks intact); history is append-only.
    messages.push({ role: "assistant", content: res.content });
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return {
      rawText: text || undefined,
      toolCalls: res.content.flatMap((b) =>
        b.type === "tool_use" ? [{ id: b.id, name: b.name, args: b.input }] : [],
      ),
      finishReason: FINISH_REASON[res.stop_reason ?? ""] ?? "stop",
      raw: res,
    };
  }

  function toLoopError(err: unknown): never {
    if (err instanceof AgentLoopError) throw err;
    if (err instanceof Anthropic.APIError) {
      throw new AgentLoopError("provider_error", `Anthropic ${err.status}: ${err.message}`, err);
    }
    throw err;
  }

  return {
    name: "anthropic",
    kind: "iterative",
    get modelLabel() {
      return `${model} · Anthropic (agent)`;
    },

    async startCall(input) {
      system = input.systemPrompt;
      messages.length = 0;
      messages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mimeType as Anthropic.Base64ImageSource["media_type"],
              data: input.image,
            },
          },
          { type: "text", text: input.userPrompt },
        ],
      });
      // Retry wraps the raw SDK call so isModelNotFound sees the SDK error's .status.
      const res = await withModelRetry(opts, (m) => {
        model = m;
        return call(input.tools);
      }).catch(toLoopError);
      return toTurn(res);
    },

    async continue(history: AgentMessage[], tools: ToolDefinition[]) {
      const last = history[history.length - 1];
      if (last?.role === "tool" && last.toolResults?.length) {
        // All tool_results of a turn go in ONE user message.
        messages.push({
          role: "user",
          content: last.toolResults.map((tr) => ({
            type: "tool_result" as const,
            tool_use_id: tr.id,
            content: JSON.stringify(
              tr.result.ok ? { ok: true, data: tr.result.data } : { ok: false, error: tr.result.error },
            ),
            is_error: !tr.result.ok,
          })),
        });
      }
      const res = await call(tools).catch(toLoopError);
      return toTurn(res);
    },
  };
}
