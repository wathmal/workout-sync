import { IterativeAgentProvider } from "../types";
import { createOpenAIShapeSession, OpenAIShapeConfig } from "./openai-shape";
import { agentModelOpts, withModelRetry } from "../../models/resolve";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export function createGroqAgentProvider(): IterativeAgentProvider {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set — required for AGENT_HARNESS_PROVIDER=groq",
    );
  }
  const opts = agentModelOpts("groq");

  // Held by reference: openai-shape reads cfg.model at request-build time, so the
  // resolver can swap it before startCall (which resets session state).
  const cfg: OpenAIShapeConfig = {
    baseUrl: GROQ_BASE_URL,
    apiKey,
    model: opts.pinned,
    temperature: 0.2,
    maxTokens: 2048,
    toolChoice: "required",
  };
  const session = createOpenAIShapeSession(cfg);

  return {
    name: "groq",
    kind: "iterative",
    get modelLabel() {
      return `${cfg.model} · Groq (agent)`;
    },
    startCall: (input) =>
      withModelRetry(opts, (model) => {
        cfg.model = model;
        return session.startCall(input);
      }),
    continue: (history, tools) => session.continueTurn(history, tools),
  };
}
