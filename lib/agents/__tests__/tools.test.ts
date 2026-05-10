import { dispatchTool, AGENT_TOOLS, toOpenAITools, toCliBashAllowlist } from "../tools";
import { HEVY_EXERCISES } from "../../hevy/exercises";

describe("agent tool registry", () => {
  it("exposes the four expected tools", () => {
    expect(AGENT_TOOLS.map((t) => t.name).sort()).toEqual([
      "expandAbbreviations",
      "getExerciseDetails",
      "proposeWorkout",
      "searchCatalog",
    ]);
    expect(AGENT_TOOLS.find((t) => t.name === "proposeWorkout")?.terminal).toBe(true);
  });

  it("derives OpenAI-shaped tool defs", () => {
    const out = toOpenAITools();
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ type: "function", function: { name: expect.any(String) } });
  });

  it("derives a CLI bash allowlist with kebab-case paths", () => {
    const list = toCliBashAllowlist();
    expect(list).toContain("Bash(node scripts/agent-tools/search-catalog.ts:*)");
    expect(list).toContain("Bash(node scripts/agent-tools/get-exercise-details.ts:*)");
    expect(list).toContain("Bash(node scripts/agent-tools/expand-abbreviations.ts:*)");
    expect(list).toContain("Bash(node scripts/agent-tools/propose-workout.ts:*)");
  });
});

describe("searchCatalog tool", () => {
  it("returns scored matches for a known abbreviation", async () => {
    const r = await dispatchTool("searchCatalog", { query: "BB Bench Press", limit: 5 });
    expect(r.ok).toBe(true);
    const data = (r as { data: { results: Array<{ title: string; score: number }> } }).data;
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.length).toBeLessThanOrEqual(5);
    expect(data.results[0].score).toBeGreaterThanOrEqual(60);
  });

  it("rejects missing query", async () => {
    const r = await dispatchTool("searchCatalog", {});
    expect(r.ok).toBe(false);
  });

  it("rejects bad kind", async () => {
    const r = await dispatchTool("searchCatalog", { query: "curl", kind: "bogus" });
    expect(r.ok).toBe(false);
  });
});

describe("getExerciseDetails tool", () => {
  it("returns details for a known id", async () => {
    const id = HEVY_EXERCISES[0].id;
    const r = await dispatchTool("getExerciseDetails", { id });
    expect(r.ok).toBe(true);
    const data = (r as { data: { id: string; equipment: string } }).data;
    expect(data.id).toBe(id);
    expect(typeof data.equipment).toBe("string");
  });

  it("errors on unknown id", async () => {
    const r = await dispatchTool("getExerciseDetails", { id: "not-a-real-uuid" });
    expect(r.ok).toBe(false);
  });
});

describe("expandAbbreviations tool", () => {
  it("expands BB to barbell", async () => {
    const r = await dispatchTool("expandAbbreviations", { text: "BB Bench Press" });
    expect(r.ok).toBe(true);
    const data = (r as { data: { expanded: string } }).data;
    expect(data.expanded).toContain("barbell");
  });
});

describe("proposeWorkout tool", () => {
  function findByType(type: string) {
    return HEVY_EXERCISES.find((e) => e.type === type);
  }

  it("rejects empty exercises array", async () => {
    const r = await dispatchTool("proposeWorkout", { exercises: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown exercise_id", async () => {
    const r = await dispatchTool("proposeWorkout", {
      exercises: [{ exercise_id: "not-a-real-id", sets: [{ kg: 0, reps: 5 }] }],
    });
    expect(r.ok).toBe(false);
  });

  it("builds a weight_reps WorkoutExercise correctly", async () => {
    const ex = findByType("weight_reps");
    if (!ex) {
      console.warn("no weight_reps exercise in catalog — skipping");
      return;
    }
    const r = await dispatchTool("proposeWorkout", {
      exercises: [
        {
          exercise_id: ex.id,
          raw_detection: "BB Bench",
          sets: [
            { set_number: 1, kg: 60, reps: 10 },
            { set_number: 2, kg: 80, reps: 5 },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
    const out = (r as { workout: Array<{ sets: Array<{ weight_kg?: number; reps?: number }>; exercise: { id: string } }> }).workout;
    expect(out).toHaveLength(1);
    expect(out[0].exercise.id).toBe(ex.id);
    expect(out[0].sets).toHaveLength(2);
    expect(out[0].sets[0].weight_kg).toBe(60);
    expect(out[0].sets[0].reps).toBe(10);
  });
});

describe("dispatchTool", () => {
  it("rejects unknown tool name", async () => {
    const r = await dispatchTool("notARealTool", {});
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toMatch(/unknown tool/);
  });
});
