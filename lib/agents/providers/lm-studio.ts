import { IterativeAgentProvider } from "../types";
import { createOpenAIShapeSession } from "./openai-shape";
import { envInt, envFloat } from "../env";

const DEFAULT_URL = "http://localhost:1234/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3-nano-omni";

export function createLMStudioAgentProvider(): IterativeAgentProvider {
  const baseUrl = process.env.LM_STUDIO_URL || DEFAULT_URL;
  const model = process.env.LM_STUDIO_AGENT_MODEL || DEFAULT_MODEL;
  const maxTokens = envInt("LM_STUDIO_MAX_TOKENS", 8192);
  const temperature = envFloat("LM_STUDIO_TEMPERATURE", 0.1);

  const session = createOpenAIShapeSession({
    baseUrl,
    model,
    temperature,
    maxTokens,
    toolChoice: "required",
  });

  return {
    name: "lm-studio",
    kind: "iterative",
    modelLabel: `${model} · LM Studio (agent)`,
    startCall: (input) => session.startCall(input),
    continue: (history, tools) => session.continueTurn(history, tools),
  };
}
