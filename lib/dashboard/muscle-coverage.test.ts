import { computeMuscleCoverage } from "./muscle-coverage";
import type { JoinedWorkout, HevyRawSet } from "../hevy/workouts-since";
import type { HevyExerciseTemplate } from "../hevy/catalog";

function tpl(
  primary: string,
  secondary: string[] = [],
  id = primary,
): HevyExerciseTemplate {
  return {
    id,
    title: id,
    type: "weight_reps",
    primary_muscle_group: primary,
    secondary_muscle_groups: secondary,
    equipment: "barbell",
    is_custom: false,
  };
}

function set(type: HevyRawSet["set_type"] = "normal"): HevyRawSet {
  return { set_type: type, weight_kg: 50, reps: 8 };
}

function workout(exercises: { template: HevyExerciseTemplate | null; sets: HevyRawSet[] }[]): JoinedWorkout {
  return {
    id: "w1",
    title: "w",
    start_time: new Date().toISOString(),
    exercises: exercises.map((e) => ({
      exercise_template_id: e.template?.id ?? "?",
      template: e.template,
      sets: e.sets,
    })),
  };
}

describe("computeMuscleCoverage", () => {
  it("counts primary at 1.0 and secondary at 0.5 per working set", () => {
    const w = workout([
      { template: tpl("chest", ["triceps", "shoulders"]), sets: [set(), set(), set(), set()] },
    ]);
    const { entries } = computeMuscleCoverage([w], 10);
    const chest = entries.find((e) => e.group === "chest")!;
    const triceps = entries.find((e) => e.group === "triceps")!;
    const shoulders = entries.find((e) => e.group === "shoulders")!;
    expect(chest.sets).toBe(4);
    expect(triceps.sets).toBe(2);
    expect(shoulders.sets).toBe(2);
  });

  it("excludes warmup sets from counts", () => {
    const w = workout([
      {
        template: tpl("biceps"),
        sets: [set("warmup"), set("warmup"), set("normal"), set("normal"), set("normal")],
      },
    ]);
    const { entries } = computeMuscleCoverage([w], 10);
    expect(entries.find((e) => e.group === "biceps")!.sets).toBe(3);
  });

  it("counts dropset and failure sets", () => {
    const w = workout([
      {
        template: tpl("lats"),
        sets: [set("normal"), set("dropset"), set("failure")],
      },
    ]);
    const { entries } = computeMuscleCoverage([w], 10);
    expect(entries.find((e) => e.group === "lats")!.sets).toBe(3);
  });

  it("skips exercises with unknown templates", () => {
    const w = workout([{ template: null, sets: [set(), set()] }]);
    const { entries } = computeMuscleCoverage([w], 10);
    expect(entries.every((e) => e.sets === 0)).toBe(true);
  });

  it("ignores muscles outside the tracked set (cardio/full_body/neck/other)", () => {
    const w = workout([
      { template: tpl("cardio", ["full_body", "neck", "other"]), sets: [set()] },
    ]);
    const { entries } = computeMuscleCoverage([w], 10);
    expect(entries.every((e) => e.sets === 0)).toBe(true);
  });

  it("buckets: met ≥ target, below 0<sets<target, untouched == 0", () => {
    const w = workout([
      { template: tpl("chest"), sets: Array(10).fill(set()) },
      { template: tpl("biceps"), sets: Array(3).fill(set()) },
    ]);
    const { entries } = computeMuscleCoverage([w], 10);
    expect(entries.find((e) => e.group === "chest")!.bucket).toBe("met");
    expect(entries.find((e) => e.group === "biceps")!.bucket).toBe("below");
    expect(entries.find((e) => e.group === "calves")!.bucket).toBe("untouched");
  });

  it("attention list: untouched alpha first, then below by sets asc", () => {
    const w = workout([
      { template: tpl("chest"), sets: Array(12).fill(set()) }, // met
      { template: tpl("biceps"), sets: Array(2).fill(set()) }, // below 2
      { template: tpl("triceps"), sets: Array(5).fill(set()) }, // below 5
    ]);
    const { attention } = computeMuscleCoverage([w], 10);
    // untouched group entries alpha, then below ascending
    const untouchedGroups = attention.filter((a) => a.bucket === "untouched").map((a) => a.group);
    const belowGroups = attention.filter((a) => a.bucket === "below").map((a) => a.group);

    expect(untouchedGroups).toEqual([...untouchedGroups].sort());
    expect(belowGroups).toEqual(["biceps", "triceps"]);
    expect(attention.find((a) => a.group === "biceps")!.meta).toBe("2/10");
    // untouched comes before below
    expect(attention[0].bucket).toBe("untouched");
    expect(attention[attention.length - 1].bucket).toBe("below");
  });

  it("handles both set_type and type field names", () => {
    const w = workout([
      {
        template: tpl("chest"),
        sets: [
          { type: "warmup" } as HevyRawSet,
          { set_type: "warmup" } as HevyRawSet,
          { type: "normal" } as HevyRawSet,
        ],
      },
    ]);
    const { entries } = computeMuscleCoverage([w], 10);
    expect(entries.find((e) => e.group === "chest")!.sets).toBe(1);
  });
});
