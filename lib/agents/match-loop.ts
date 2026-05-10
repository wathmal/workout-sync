import { dispatchTool, isTerminalCall } from "./tools";
import {
  AgentLoopError,
  AgentMessage,
  AgentRunResult,
  AgentToolResult,
  IterativeAgentProvider,
  SelfHostedAgentProvider,
  ToolDefinition,
} from "./types";
import { createTelemetryLogger, TelemetryLogger } from "./telemetry";
import { envInt } from "./env";
import { WorkoutExercise } from "../types";

const DEFAULT_MAX_ITERATIONS = 30;
const MAX_PROPOSE_RETRIES = 3;

function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface RunIterativeOpts {
  provider: IterativeAgentProvider;
  image: string;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
  tools: ToolDefinition[];
  telemetry: TelemetryLogger;
  maxIterations: number;
}

async function runIterative(opts: RunIterativeOpts): Promise<{
  workout: WorkoutExercise[];
  iterations: number;
}> {
  const { provider, image, mimeType, systemPrompt, userPrompt, tools, telemetry, maxIterations } = opts;
  const history: AgentMessage[] = [];
  let proposeFailures = 0;

  let turn = await provider.startCall({ image, mimeType, systemPrompt, userPrompt, tools });
  history.push({ role: "assistant", turn });

  for (let i = 0; i < maxIterations; i++) {
    telemetry.logTurn(i, turn);

    if (turn.toolCalls.length === 0) {
      const preview = (turn.rawText ?? "").slice(0, 800);
      throw new AgentLoopError(
        "no_tool_calls",
        `model produced no tool calls and no final answer at turn ${i} (finishReason=${turn.finishReason}). Raw text preview: ${preview || "<empty>"}`,
      );
    }

    const toolResults: AgentToolResult[] = [];
    let proposed: WorkoutExercise[] | null = null;

    for (const call of turn.toolCalls) {
      telemetry.logToolCall(call);
      const result = await dispatchTool(call.name, call.args);
      telemetry.logToolResult(call, result);
      toolResults.push({ id: call.id, name: call.name, result });

      if (isTerminalCall(call.name)) {
        if (result.ok && "workout" in result) {
          proposed = result.workout;
        } else if (!result.ok) {
          proposeFailures++;
          if (proposeFailures >= MAX_PROPOSE_RETRIES) {
            throw new AgentLoopError(
              "propose_validation_failed",
              `proposeWorkout failed validation ${proposeFailures} times: ${result.error}`,
            );
          }
        }
      }
    }

    if (proposed) {
      return { workout: proposed, iterations: i + 1 };
    }

    history.push({ role: "tool", toolResults });

    turn = await provider.continue(history, tools);
    history.push({ role: "assistant", turn });
  }

  throw new AgentLoopError(
    "max_iterations",
    `loop exceeded ${maxIterations} iterations without a successful proposeWorkout`,
  );
}

export async function runAgentMatchLoop(input: {
  provider: IterativeAgentProvider | SelfHostedAgentProvider;
  image: string;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
  tools?: ToolDefinition[];
  maxIterations?: number;
  runId?: string;
}): Promise<AgentRunResult> {
  const runId = input.runId ?? newRunId();
  const telemetry = createTelemetryLogger(runId);
  const maxIterations = input.maxIterations ?? envInt("AGENT_MAX_ITERATIONS", DEFAULT_MAX_ITERATIONS);

  try {
    if (input.provider.kind === "self-hosted-loop") {
      const out = await input.provider.runOnce(input.image, input.mimeType, {
        onTurn: (i, turn) => telemetry.logTurn(i, turn),
        onToolCall: (call) => telemetry.logToolCall(call),
        onToolResult: (call, result) => telemetry.logToolResult(call, result),
      });
      const summary = telemetry.finalize({ iterations: out.iterations, status: "ok" });
      return {
        workout: out.workout,
        modelLabel: input.provider.modelLabel,
        iterations: out.iterations,
        toolCalls: out.toolCalls,
        telemetrySummary: summary,
      };
    }

    const tools = input.tools ?? (await import("./tools")).AGENT_TOOLS;
    const result = await runIterative({
      provider: input.provider,
      image: input.image,
      mimeType: input.mimeType,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      tools,
      telemetry,
      maxIterations,
    });
    const summary = telemetry.finalize({ iterations: result.iterations, status: "ok" });
    return {
      workout: result.workout,
      modelLabel: input.provider.modelLabel,
      iterations: result.iterations,
      toolCalls: telemetry.toolCallCount,
      telemetrySummary: summary,
    };
  } catch (err) {
    telemetry.logError(
      err instanceof AgentLoopError ? err.reason : "provider_error",
      err,
    );
    telemetry.finalize({ iterations: 0, status: "error" });
    throw err;
  }
}
