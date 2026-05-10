import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { ToolCall, ToolHandlerResult, TerminalToolResult, AgentTurn } from "./types";

const DEBUG_LOG = process.env.AGENT_DEBUG_LOG === "1";
const DEBUG_DIR = ".agent-runs";

interface TelemetryEvent {
  ts: string;
  runId: string;
  kind: "start" | "turn" | "tool_call" | "tool_result" | "finalize" | "error";
  data: unknown;
}

interface ToolBreakdownEntry {
  total: number;
  ok: number;
  err: number;
}

export interface TelemetryLogger {
  logTurn(index: number, turn: AgentTurn): void;
  logToolCall(call: ToolCall): void;
  logToolResult(call: ToolCall, result: ToolHandlerResult | TerminalToolResult): void;
  logError(reason: string, err: unknown): void;
  finalize(extras: { iterations: number; status: "ok" | "error" }): string;
  readonly toolCallCount: number;
}

function summarizeArgs(args: unknown, max = 500): string {
  let s: string;
  try {
    s = typeof args === "string" ? args : JSON.stringify(args);
  } catch {
    s = String(args);
  }
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function summarizeResult(result: ToolHandlerResult | TerminalToolResult): string {
  if (!result.ok) return `err: ${result.error}`;
  if ("workout" in result) return `ok: workout(${result.workout.length} exercises)`;
  const data = result.data as { results?: unknown[] } | undefined;
  if (data && Array.isArray(data.results)) {
    return `ok: ${data.results.length} results`;
  }
  return "ok";
}

export function createTelemetryLogger(runId: string): TelemetryLogger {
  const events: TelemetryEvent[] = [];
  const toolBreakdown = new Map<string, ToolBreakdownEntry>();
  const startedAt = Date.now();
  let toolCallCount = 0;
  let logFile: string | null = null;

  if (DEBUG_LOG) {
    try {
      mkdirSync(DEBUG_DIR, { recursive: true });
      logFile = join(DEBUG_DIR, `${runId}.jsonl`);
    } catch {
      logFile = null;
    }
  }

  function record(event: TelemetryEvent) {
    events.push(event);
    if (logFile) {
      try {
        appendFileSync(logFile, JSON.stringify(event) + "\n");
      } catch {
        // swallow file errors — telemetry must not break the run
      }
    }
  }

  function emit(kind: TelemetryEvent["kind"], data: unknown) {
    record({ ts: new Date().toISOString(), runId, kind, data });
  }

  emit("start", { startedAt });

  return {
    get toolCallCount() {
      return toolCallCount;
    },
    logTurn(index, turn) {
      const summary = {
        index,
        finishReason: turn.finishReason,
        toolCallCount: turn.toolCalls.length,
        rawTextPreview:
          turn.rawText && turn.rawText.length > 0
            ? summarizeArgs(turn.rawText, 200)
            : null,
      };
      console.log(`[agent:${runId}] turn ${index} ${turn.finishReason} toolCalls=${turn.toolCalls.length}`);
      emit("turn", summary);
    },
    logToolCall(call) {
      toolCallCount++;
      const argsPreview = summarizeArgs(call.args);
      console.log(`[agent:${runId}] → ${call.name}(${argsPreview})`);
      emit("tool_call", { name: call.name, argsPreview });
    },
    logToolResult(call, result) {
      const summary = summarizeResult(result);
      const entry = toolBreakdown.get(call.name) ?? { total: 0, ok: 0, err: 0 };
      entry.total++;
      if (result.ok) entry.ok++;
      else entry.err++;
      toolBreakdown.set(call.name, entry);
      console.log(`[agent:${runId}] ← ${call.name} ${summary}`);
      emit("tool_result", { name: call.name, summary });
    },
    logError(reason, err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agent:${runId}] ERROR ${reason}: ${msg}`);
      emit("error", { reason, message: msg });
    },
    finalize({ iterations, status }) {
      const latencyMs = Date.now() - startedAt;
      const breakdown = Object.fromEntries(toolBreakdown);
      emit("finalize", { iterations, latencyMs, breakdown, status });
      const lines: string[] = [];
      lines.push(`agent run ${runId} ${status}`);
      lines.push(`iterations: ${iterations}`);
      lines.push(`tool calls: ${toolCallCount}`);
      lines.push(`latency: ${latencyMs}ms`);
      for (const [name, entry] of toolBreakdown) {
        lines.push(`  ${name}: ${entry.total} (ok=${entry.ok}, err=${entry.err})`);
      }
      if (logFile) lines.push(`log: ${logFile}`);
      return lines.join("\n");
    },
  };
}
