const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  const Anthropic = jest.fn(() => ({ messages: { create: mockCreate } }));
  Object.assign(Anthropic, { APIError });
  return { __esModule: true, default: Anthropic };
});

jest.mock("../../models/resolve", () => ({
  agentModelOpts: () => ({ provider: "anthropic", needs: { vision: true }, pinned: "claude-haiku-5-5" }),
  withModelRetry: (_o: unknown, fn: (m: string) => unknown) => fn("claude-haiku-5-5"),
}));

import { createAnthropicAgentProvider } from "./anthropic";
import { AgentLoopError, AgentMessage } from "../types";
import { AGENT_TOOLS } from "../tools";

const input = {
  image: "aGk=",
  mimeType: "image/jpeg",
  systemPrompt: "sys",
  userPrompt: "go",
  tools: AGENT_TOOLS,
};

function msg(stop_reason: string, content: unknown[]) {
  return { id: "m", role: "assistant", stop_reason, stop_details: null, content };
}

beforeEach(() => {
  mockCreate.mockReset();
  process.env.ANTHROPIC_API_KEY = "k";
});

describe("anthropic agent provider", () => {
  it("maps tool_use blocks to tool calls", async () => {
    mockCreate.mockResolvedValueOnce(
      msg("tool_use", [{ type: "tool_use", id: "t1", name: "searchCatalog", input: { query: "bench" } }]),
    );
    const p = createAnthropicAgentProvider();
    const turn = await p.startCall(input);
    expect(turn.finishReason).toBe("tool_use");
    expect(turn.toolCalls).toEqual([{ id: "t1", name: "searchCatalog", args: { query: "bench" } }]);
    expect(p.modelLabel).toBe("claude-haiku-5-5 · Anthropic (agent)");
    const req = mockCreate.mock.calls[0][0];
    expect(req.tool_choice).toEqual({ type: "auto" });
    expect(req.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", data: "aGk=" } });
  });

  it("replays assistant content verbatim and batches tool results in one user message", async () => {
    const first = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: "t1", name: "searchCatalog", input: {} },
      { type: "tool_use", id: "t2", name: "expandAbbreviations", input: {} },
    ];
    mockCreate
      .mockResolvedValueOnce(msg("tool_use", first))
      .mockResolvedValueOnce(msg("end_turn", [{ type: "text", text: "done" }]));
    const p = createAnthropicAgentProvider();
    await p.startCall(input);
    const history: AgentMessage[] = [
      {
        role: "tool",
        toolResults: [
          { id: "t1", name: "searchCatalog", result: { ok: true, data: [1] } },
          { id: "t2", name: "expandAbbreviations", result: { ok: false, error: "bad" } },
        ],
      },
    ];
    const turn = await p.continue(history, AGENT_TOOLS);
    expect(turn.finishReason).toBe("stop");
    expect(turn.rawText).toBe("done");

    const sent = mockCreate.mock.calls[1][0].messages;
    expect(sent[1]).toEqual({ role: "assistant", content: first });
    expect(sent[2].role).toBe("user");
    expect(sent[2].content).toEqual([
      { type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ ok: true, data: [1] }), is_error: false },
      { type: "tool_result", tool_use_id: "t2", content: JSON.stringify({ ok: false, error: "bad" }), is_error: true },
    ]);
  });

  it("maps max_tokens to length", async () => {
    mockCreate.mockResolvedValueOnce(msg("max_tokens", []));
    const turn = await createAnthropicAgentProvider().startCall(input);
    expect(turn.finishReason).toBe("length");
  });

  it("throws provider_error on refusal", async () => {
    mockCreate.mockResolvedValueOnce({
      ...msg("refusal", []),
      stop_details: { type: "refusal", category: "cyber", explanation: "nope" },
    });
    await expect(createAnthropicAgentProvider().startCall(input)).rejects.toMatchObject({
      name: "AgentLoopError",
      reason: "provider_error",
    });
    expect(AgentLoopError).toBeDefined();
  });
});
