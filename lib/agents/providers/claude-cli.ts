import { spawn } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import {
  SelfHostedAgentProvider,
  AgentLoopError,
  AgentTurn,
  ToolCall,
  ToolHandlerResult,
  TerminalToolResult,
} from "../types";
import { WorkoutExercise } from "../../types";
import { AGENT_SYSTEM_PROMPT_CLI, AGENT_USER_PROMPT_CLI } from "../prompts";
import { envInt } from "../env";

const DEFAULT_TIMEOUT_MS = 240_000;
const DEFAULT_MAX_TURNS = 30;

function decodeBase64Image(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

interface StreamEventHandlers {
  onAssistantTurn(turn: AgentTurn, toolCalls: ToolCall[]): void;
  onToolResult(toolUseId: string, result: ToolHandlerResult | TerminalToolResult): void;
}

const SHIM_NAME_BY_SCRIPT: Record<string, string> = {
  "search-catalog": "searchCatalog",
  "get-exercise-details": "getExerciseDetails",
  "expand-abbreviations": "expandAbbreviations",
  "propose-workout": "proposeWorkout",
};

function deriveAgentToolName(claudeName: string, input: unknown): string {
  if (claudeName !== "Bash") return claudeName;
  const command =
    typeof input === "object" && input !== null && "command" in input
      ? String((input as { command: unknown }).command ?? "")
      : "";
  const match = command.match(/scripts\/agent-tools\/([a-z-]+)\.ts/);
  if (match && SHIM_NAME_BY_SCRIPT[match[1]]) return SHIM_NAME_BY_SCRIPT[match[1]];
  return claudeName;
}

function deriveAgentToolArgs(claudeName: string, input: unknown): unknown {
  if (claudeName !== "Bash") return input;
  const command =
    typeof input === "object" && input !== null && "command" in input
      ? String((input as { command: unknown }).command ?? "")
      : "";
  // Match a single-quoted JSON object that follows the shim path. Stricter than
  // a greedy `\S+` so trailing shell metachars (2>&1, | head -30) don't get
  // captured as fake args when the model is just peeking at output.
  const m = command.match(/\.ts\s+'(\{[\s\S]*?\})'/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {
      return { _raw: m[1] };
    }
  }
  return { _command: command };
}

function parseToolResultPayload(content: unknown): ToolHandlerResult | TerminalToolResult {
  let text = "";
  let nonTextBlockTypes: string[] = [];
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    for (const c of content) {
      if (typeof c !== "object" || c === null) continue;
      const block = c as Record<string, unknown>;
      if (typeof block.text === "string") text += block.text;
      else if (typeof block.type === "string") nonTextBlockTypes.push(block.type);
    }
  } else {
    text = JSON.stringify(content);
  }
  text = text.trim();
  if (!text) {
    if (nonTextBlockTypes.length > 0) {
      return { ok: true, data: { blocks: nonTextBlockTypes } };
    }
    return { ok: false, error: "<empty tool output>" };
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && "ok" in parsed) {
      return parsed as ToolHandlerResult | TerminalToolResult;
    }
  } catch {
    // not JSON — fall through
  }
  return { ok: true, data: { raw: text.slice(0, 200) } };
}

function handleStreamEvent(evt: unknown, handlers: StreamEventHandlers): void {
  if (typeof evt !== "object" || evt === null) return;
  const e = evt as Record<string, unknown>;
  if (e.type !== "assistant" && e.type !== "user") return;
  const message = e.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (!Array.isArray(content)) return;

  if (e.type === "assistant") {
    let rawText = "";
    const toolCalls: ToolCall[] = [];
    for (const block of content) {
      if (typeof block !== "object" || block === null) continue;
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") {
        rawText += b.text;
      } else if (b.type === "tool_use" && typeof b.id === "string" && typeof b.name === "string") {
        toolCalls.push({
          id: b.id,
          name: deriveAgentToolName(b.name, b.input),
          args: deriveAgentToolArgs(b.name, b.input),
        });
      }
    }
    handlers.onAssistantTurn(
      {
        rawText: rawText || undefined,
        toolCalls,
        finishReason: toolCalls.length > 0 ? "tool_use" : "stop",
      },
      toolCalls,
    );
  } else {
    for (const block of content) {
      if (typeof block !== "object" || block === null) continue;
      const b = block as Record<string, unknown>;
      if (b.type !== "tool_result" || typeof b.tool_use_id !== "string") continue;
      const result = b.is_error
        ? { ok: false as const, error: typeof b.content === "string" ? b.content.slice(0, 500) : "tool error" }
        : parseToolResultPayload(b.content);
      handlers.onToolResult(b.tool_use_id, result);
    }
  }
}

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

interface ClaudeCliRunOptions {
  binary?: string;
  cwd?: string;
}

export function createClaudeCliAgentProvider(
  options: ClaudeCliRunOptions = {},
): SelfHostedAgentProvider {
  const binary = options.binary || process.env.CLAUDE_CLI_BIN || "claude";
  const cwd = options.cwd || process.cwd();
  const maxTurns = envInt("AGENT_MAX_ITERATIONS", DEFAULT_MAX_TURNS);
  const timeoutMs = envInt("AGENT_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);

  return {
    name: "claude-cli",
    kind: "self-hosted-loop",
    modelLabel: "Claude Code · headless (agent)",
    async runOnce(image, mimeType, hooks) {
      const runId = randomBytes(8).toString("hex");
      const workDir = mkdtempSync(join(tmpdir(), `agent-cli-${runId}-`));
      const imagePath = join(workDir, `image.${extensionForMime(mimeType)}`);
      const promptPath = join(workDir, "prompt.txt");
      const resultPath = join(tmpdir(), `agent-result-${runId}.json`);

      writeFileSync(imagePath, decodeBase64Image(image));

      const prompt = [
        AGENT_SYSTEM_PROMPT_CLI,
        "",
        `# Run id`,
        runId,
        "",
        `# Image to extract`,
        `Read the workout image at this absolute path BEFORE doing anything else (use the Read tool — it accepts image files):`,
        imagePath,
        "",
        `# Result sentinel path`,
        `When you call propose-workout, it writes the assembled workout to: ${resultPath}`,
        "",
        AGENT_USER_PROMPT_CLI,
      ].join("\n");
      writeFileSync(promptPath, prompt);

      const args = [
        "-p",
        "--output-format", "stream-json",
        "--verbose",
        "--max-turns", String(maxTurns),
        "--add-dir", workDir,
        "--allowedTools",
        [
          "Read",
          "Bash(npx tsx scripts/agent-tools/search-catalog.ts:*)",
          "Bash(npx tsx scripts/agent-tools/get-exercise-details.ts:*)",
          "Bash(npx tsx scripts/agent-tools/expand-abbreviations.ts:*)",
          "Bash(npx tsx scripts/agent-tools/propose-workout.ts:*)",
        ].join(","),
      ];

      const env = { ...process.env, AGENT_RESULT_PATH: resultPath, AGENT_RUN_ID: runId };
      const child = spawn(binary, args, { cwd, env });
      let stdout = "";
      let stderr = "";
      let toolCalls = 0;
      let assistantTurns = 0;
      const pendingCalls = new Map<string, ToolCall>();
      let lineBuffer = "";

      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.on("data", (chunk) => {
        const s = chunk.toString();
        stdout += s;
        lineBuffer += s;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: unknown;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          handleStreamEvent(evt, {
            onAssistantTurn: (turn, calls) => {
              assistantTurns++;
              hooks?.onTurn?.(assistantTurns - 1, turn);
              for (const call of calls) {
                toolCalls++;
                pendingCalls.set(call.id, call);
                hooks?.onToolCall?.(call);
              }
            },
            onToolResult: (toolUseId, result) => {
              const call = pendingCalls.get(toolUseId);
              if (call) {
                hooks?.onToolResult?.(call, result);
                pendingCalls.delete(toolUseId);
              }
            },
          });
        }
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, timeoutMs);

      const exitCode: number = await new Promise((resolve, reject) => {
        child.on("error", (err) => {
          clearTimeout(timeout);
          reject(
            new AgentLoopError(
              "subprocess_error",
              `failed to spawn ${binary}: ${err.message}`,
              err,
            ),
          );
        });
        child.on("close", (code) => {
          clearTimeout(timeout);
          resolve(code ?? -1);
        });
      });

      if (!existsSync(resultPath)) {
        if (process.env.AGENT_DEBUG_LOG === "1") {
          console.error("--- claude stdout (full) ---");
          console.error(stdout);
          console.error("--- claude stderr (full) ---");
          console.error(stderr);
        }
        throw new AgentLoopError(
          "subprocess_error",
          `claude exited with code ${exitCode} but did not produce ${resultPath}\n` +
            `stdout (last 1500 chars): ${stdout.slice(-1500)}\n` +
            `stderr (last 500 chars): ${stderr.slice(-500)}`,
        );
      }

      let workout: WorkoutExercise[];
      try {
        const raw = readFileSync(resultPath, "utf8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.workout)) {
          throw new Error("result file missing 'workout' array");
        }
        workout = parsed.workout as WorkoutExercise[];
      } catch (err) {
        throw new AgentLoopError(
          "subprocess_error",
          `failed to read agent result file: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      } finally {
        try {
          unlinkSync(resultPath);
        } catch {
          // ignore
        }
      }

      return {
        workout,
        iterations: assistantTurns || 1,
        toolCalls: toolCalls || workout.length,
      };
    },
  };
}
