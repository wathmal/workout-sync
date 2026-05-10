import { runAgentMatchLoop } from "./match-loop";
import { AGENT_TOOLS } from "./tools";
import { AGENT_SYSTEM_PROMPT, AGENT_USER_PROMPT } from "./prompts";
import { createGroqAgentProvider } from "./providers/groq";
import { createLMStudioAgentProvider } from "./providers/lm-studio";
import { createClaudeCliAgentProvider } from "./providers/claude-cli";
import { AgentProvider, AgentRunResult, AgentProviderName } from "./types";

export type AgentHarnessProvider = "off" | AgentProviderName;

export function getAgentHarnessProvider(): AgentHarnessProvider {
  const raw = (process.env.AGENT_HARNESS_PROVIDER || "off").toLowerCase();
  if (raw === "off" || raw === "groq" || raw === "lm-studio" || raw === "claude-cli") {
    return raw;
  }
  console.warn(
    `[agents] unknown AGENT_HARNESS_PROVIDER="${raw}", falling back to "off"`,
  );
  return "off";
}

export function isAgentHarnessEnabled(): boolean {
  return getAgentHarnessProvider() !== "off";
}

function buildProvider(name: AgentProviderName): AgentProvider {
  switch (name) {
    case "groq":
      return createGroqAgentProvider();
    case "lm-studio":
      return createLMStudioAgentProvider();
    case "claude-cli":
      return createClaudeCliAgentProvider();
  }
}

export async function runAgent(
  image: string,
  mimeType: string,
): Promise<AgentRunResult> {
  const which = getAgentHarnessProvider();
  if (which === "off") {
    throw new Error("runAgent called but AGENT_HARNESS_PROVIDER is off");
  }
  const provider = buildProvider(which);
  return runAgentMatchLoop({
    provider,
    image,
    mimeType,
    systemPrompt: AGENT_SYSTEM_PROMPT,
    userPrompt: AGENT_USER_PROMPT,
    tools: AGENT_TOOLS,
  });
}

export { AGENT_TOOLS } from "./tools";
export { AGENT_SYSTEM_PROMPT, AGENT_USER_PROMPT } from "./prompts";
export type { AgentRunResult, AgentProvider } from "./types";
