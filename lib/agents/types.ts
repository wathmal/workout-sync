import { WorkoutExercise } from "../types";

export type AgentProviderName = "groq" | "lm-studio" | "anthropic";

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export type ToolHandlerResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type TerminalToolResult =
  | { ok: true; data: unknown; workout: WorkoutExercise[] }
  | { ok: false; error: string };

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: unknown) => Promise<ToolHandlerResult | TerminalToolResult>;
  terminal?: boolean;
}

export interface AgentTurn {
  rawText?: string;
  toolCalls: ToolCall[];
  finishReason: "tool_use" | "stop" | "length" | "error";
  raw?: unknown;
}

export interface AgentToolResult {
  id: string;
  name: string;
  result: ToolHandlerResult | TerminalToolResult;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  turn?: AgentTurn;
  toolResults?: AgentToolResult[];
}

export interface AgentStartInput {
  image: string;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
  tools: ToolDefinition[];
}

export interface IterativeAgentProvider {
  name: AgentProviderName;
  modelLabel: string;
  kind: "iterative";
  startCall(input: AgentStartInput): Promise<AgentTurn>;
  continue(history: AgentMessage[], tools: ToolDefinition[]): Promise<AgentTurn>;
}

export type AgentProvider = IterativeAgentProvider;

export interface AgentRunResult {
  workout: WorkoutExercise[];
  modelLabel: string;
  iterations: number;
  toolCalls: number;
  telemetrySummary: string;
}

export class AgentLoopError extends Error {
  constructor(
    public reason:
      | "no_tool_calls"
      | "max_iterations"
      | "propose_validation_failed"
      | "timeout"
      | "provider_error",
    message: string,
    public cause?: unknown,
  ) {
    super(`${reason}: ${message}`);
    this.name = "AgentLoopError";
  }
}
