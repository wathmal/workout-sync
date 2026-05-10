import { IterativeAgentProvider } from "../types";
import { createOpenAIShapeSession } from "./openai-shape";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export function createGroqAgentProvider(): IterativeAgentProvider {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set — required for AGENT_HARNESS_PROVIDER=groq",
    );
  }
  const model = process.env.GROQ_AGENT_MODEL || DEFAULT_MODEL;

  const session = createOpenAIShapeSession({
    baseUrl: GROQ_BASE_URL,
    apiKey,
    model,
    temperature: 0.2,
    maxTokens: 2048,
    toolChoice: "required",
  });

  return {
    name: "groq",
    kind: "iterative",
    modelLabel: `${humanModelLabel(model)} · Groq (agent)`,
    startCall: (input) => session.startCall(input),
    continue: (history, tools) => session.continueTurn(history, tools),
  };
}

function humanModelLabel(model: string): string {
  if (model.includes("llama-4-scout")) return "Llama 4 Scout";
  if (model.includes("llama-4-maverick")) return "Llama 4 Maverick";
  return model;
}
