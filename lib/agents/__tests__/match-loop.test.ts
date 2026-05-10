import { runAgentMatchLoop } from "../match-loop";
import { AGENT_TOOLS } from "../tools";
import {
  AgentLoopError,
  AgentTurn,
  IterativeAgentProvider,
  ToolCall,
} from "../types";
import { HEVY_EXERCISES } from "../../hevy/exercises";

function findWeightRepsExercise() {
  const ex = HEVY_EXERCISES.find((e) => e.type === "weight_reps");
  if (!ex) throw new Error("test fixture missing: no weight_reps exercise in catalog");
  return ex;
}

interface ScriptedTurn {
  rawText?: string;
  calls: Array<{ name: string; args: unknown }>;
  finishReason?: AgentTurn["finishReason"];
}

function makeProvider(script: ScriptedTurn[]): IterativeAgentProvider {
  let i = 0;
  let callIdSeq = 0;
  const next = (): AgentTurn => {
    const t = script[i++];
    if (!t) throw new Error("scripted provider exhausted");
    const toolCalls: ToolCall[] = t.calls.map((c) => ({
      id: `call_${++callIdSeq}`,
      name: c.name,
      args: c.args,
    }));
    return {
      rawText: t.rawText,
      toolCalls,
      finishReason: t.finishReason ?? (toolCalls.length > 0 ? "tool_use" : "stop"),
    };
  };
  return {
    name: "groq",
    kind: "iterative",
    modelLabel: "mock",
    startCall: async () => next(),
    continue: async () => next(),
  };
}

describe("runAgentMatchLoop", () => {
  it("terminates on a successful proposeWorkout", async () => {
    const ex = findWeightRepsExercise();
    const provider = makeProvider([
      { calls: [{ name: "searchCatalog", args: { query: ex.title, limit: 3 } }] },
      {
        calls: [
          {
            name: "proposeWorkout",
            args: {
              exercises: [
                {
                  exercise_id: ex.id,
                  raw_detection: ex.title,
                  sets: [{ set_number: 1, kg: 60, reps: 10 }],
                },
              ],
            },
          },
        ],
      },
    ]);

    const result = await runAgentMatchLoop({
      provider,
      image: "AAAA",
      mimeType: "image/jpeg",
      systemPrompt: "test",
      userPrompt: "test",
      tools: AGENT_TOOLS,
      maxIterations: 5,
    });

    expect(result.workout).toHaveLength(1);
    expect(result.workout[0].exercise.id).toBe(ex.id);
    expect(result.iterations).toBe(2);
    expect(result.toolCalls).toBeGreaterThanOrEqual(2);
    expect(result.telemetrySummary).toContain("ok");
  });

  it("recovers from a tool-call error and continues", async () => {
    const ex = findWeightRepsExercise();
    const provider = makeProvider([
      { calls: [{ name: "doesNotExist", args: {} }] },
      {
        calls: [
          {
            name: "proposeWorkout",
            args: {
              exercises: [
                {
                  exercise_id: ex.id,
                  sets: [{ set_number: 1, kg: 50, reps: 5 }],
                },
              ],
            },
          },
        ],
      },
    ]);
    const result = await runAgentMatchLoop({
      provider,
      image: "AAAA",
      mimeType: "image/jpeg",
      systemPrompt: "test",
      userPrompt: "test",
      tools: AGENT_TOOLS,
      maxIterations: 5,
    });
    expect(result.workout).toHaveLength(1);
  });

  it("throws AgentLoopError on max iterations", async () => {
    const provider = makeProvider(
      Array.from({ length: 5 }, () => ({
        calls: [{ name: "searchCatalog", args: { query: "curl" } }],
      })),
    );
    await expect(
      runAgentMatchLoop({
        provider,
        image: "AAAA",
        mimeType: "image/jpeg",
        systemPrompt: "test",
        userPrompt: "test",
        tools: AGENT_TOOLS,
        maxIterations: 3,
      }),
    ).rejects.toMatchObject({ name: "AgentLoopError", reason: "max_iterations" });
  });

  it("throws AgentLoopError when model emits no tool calls", async () => {
    const provider = makeProvider([{ calls: [], finishReason: "stop" }]);
    await expect(
      runAgentMatchLoop({
        provider,
        image: "AAAA",
        mimeType: "image/jpeg",
        systemPrompt: "test",
        userPrompt: "test",
        tools: AGENT_TOOLS,
        maxIterations: 3,
      }),
    ).rejects.toBeInstanceOf(AgentLoopError);
  });

  it("bails after MAX_PROPOSE_RETRIES validation failures", async () => {
    const badPropose = {
      calls: [
        {
          name: "proposeWorkout",
          args: { exercises: [{ exercise_id: "missing", sets: [] }] },
        },
      ],
    };
    const provider = makeProvider([badPropose, badPropose, badPropose]);
    await expect(
      runAgentMatchLoop({
        provider,
        image: "AAAA",
        mimeType: "image/jpeg",
        systemPrompt: "test",
        userPrompt: "test",
        tools: AGENT_TOOLS,
        maxIterations: 10,
      }),
    ).rejects.toMatchObject({
      name: "AgentLoopError",
      reason: "propose_validation_failed",
    });
  });
});
