import { suggestSession, classifyShoulder } from "./suggest-engine";
import { MUSCLE_TARGETS, type EngineMuscle } from "./config";
import type { JoinedWorkout, HevyRawSet } from "../hevy/workouts-since";
import type { HevyExerciseTemplate } from "../hevy/catalog";

function tpl(
  primary: string,
  opts: {
    secondary?: string[];
    id?: string;
    title?: string;
    equipment?: string;
    custom?: boolean;
  } = {},
): HevyExerciseTemplate {
  const title = opts.title ?? opts.id ?? primary;
  return {
    id: opts.id ?? title,
    title,
    type: "weight_reps",
    primary_muscle_group: primary,
    secondary_muscle_groups: opts.secondary ?? [],
    equipment: opts.equipment ?? "barbell",
    is_custom: opts.custom ?? false,
  };
}

function set(opts: { type?: HevyRawSet["set_type"]; weight?: number; reps?: number } = {}): HevyRawSet {
  return { set_type: opts.type ?? "normal", weight_kg: opts.weight ?? 50, reps: opts.reps ?? 8 };
}

function workoutAt(
  nowMs: number,
  hoursAgo: number,
  exercises: { template: HevyExerciseTemplate | null; sets: HevyRawSet[] }[],
  id = `w-${hoursAgo}`,
): JoinedWorkout {
  return {
    id,
    title: "w",
    start_time: new Date(nowMs - hoursAgo * 3_600_000).toISOString(),
    exercises: exercises.map((e) => ({
      exercise_template_id: e.template?.id ?? "?",
      template: e.template,
      sets: e.sets,
    })),
  };
}

/** All engine muscles at 0 except the overrides — isolates muscles under test. */
function targetsWith(overrides: Partial<Record<EngineMuscle, number>>): Record<EngineMuscle, number> {
  const base = {} as Record<EngineMuscle, number>;
  for (const m of Object.keys(MUSCLE_TARGETS) as EngineMuscle[]) base[m] = 0;
  return { ...base, ...overrides };
}

// A mid-week Wednesday and a Monday, both local.
const WED = new Date("2026-06-17T12:00:00");
const MON = new Date("2026-06-15T08:00:00");

describe("classifyShoulder", () => {
  it("routes laterals/upright rows to side delts", () => {
    expect(classifyShoulder("Lateral Raise (Dumbbell)")).toBe("side_delts");
    expect(classifyShoulder("Upright Row (Cable)")).toBe("side_delts");
  });
  it("routes reverse fly / face pull / pullaparts to rear delts", () => {
    expect(classifyShoulder("Rear Delt Reverse Fly (Machine)")).toBe("rear_delts");
    expect(classifyShoulder("Face Pull")).toBe("rear_delts");
    expect(classifyShoulder("Band Pullaparts")).toBe("rear_delts");
  });
  it("defaults presses + anything else to front delts", () => {
    expect(classifyShoulder("Overhead Press (Barbell)")).toBe("front_delts");
    expect(classifyShoulder("Bench Press")).toBe("front_delts");
  });
});

describe("suggestSession — delt split counting", () => {
  it("splits shoulders by title: laterals -> side, bench secondary -> front", () => {
    const wk = workoutAt(WED.getTime(), 2, [
      { template: tpl("shoulders", { id: "lr", title: "Lateral Raise (Dumbbell)" }), sets: [set(), set(), set(), set()] },
      { template: tpl("chest", { id: "bench", title: "Bench Press", secondary: ["shoulders"] }), sets: [set(), set(), set(), set()] },
    ]);
    const out = suggestSession({
      now: WED,
      history: [wk],
      targets: targetsWith({ side_delts: 16, front_delts: 6 }),
    });
    const side = out.muscles.find((m) => m.muscle === "side_delts")!;
    const front = out.muscles.find((m) => m.muscle === "front_delts")!;
    expect(side.current).toBe(4); // 4 primary sets
    expect(front.current).toBe(2); // 4 bench secondary * 0.5
    expect(side.deficit).toBe(12);
    expect(front.deficit).toBe(4);
  });
});

describe("suggestSession — region pick", () => {
  it("picks the larger-deficit region on a blank week (Monday)", () => {
    const out = suggestSession({ now: MON, history: [] });
    // upper targets sum (128) > lower (76)
    expect(out.region).toBe("upper");
    expect(out.muscles.length).toBeGreaterThan(0);
    expect(out.note).toBeUndefined();
  });

  it("avoids a region trained within the recovery window (trained upper -> picks lower)", () => {
    const upperYesterday = workoutAt(WED.getTime(), 20, [
      { template: tpl("chest", { id: "bench", title: "Bench Press" }), sets: [set(), set(), set()] },
    ]);
    const out = suggestSession({ now: WED, history: [upperYesterday] });
    expect(out.region).toBe("lower");
  });

  it("when both regions are freshly trained, picks the most-rested + warns", () => {
    const history = [
      workoutAt(WED.getTime(), 10, [{ template: tpl("chest", { id: "bench", title: "Bench Press" }), sets: [set(), set(), set()] }], "u"),
      workoutAt(WED.getTime(), 20, [{ template: tpl("quadriceps", { id: "squat", title: "Squat" }), sets: [set(), set(), set()] }], "l"),
    ];
    const out = suggestSession({ now: WED, history });
    expect(out.region).toBe("lower"); // trained 20h ago vs upper 10h ago
    expect(out.note).toMatch(/most-rested/i);
  });

  it("reports on-target when nothing is behind", () => {
    const wk = workoutAt(WED.getTime(), 2, [
      { template: tpl("biceps", { id: "curl", title: "Bicep Curl" }), sets: [set(), set(), set()] },
    ]);
    const out = suggestSession({ now: WED, history: [wk], targets: targetsWith({ biceps: 2 }) });
    expect(out.muscles).toHaveLength(0);
    expect(out.note).toMatch(/on target/i);
  });
});

describe("suggestSession — menu", () => {
  it("surfaces a logged exercise with its last load, most recent first", () => {
    const history = [
      workoutAt(WED.getTime(), 200, [
        { template: tpl("quadriceps", { id: "legpress", title: "Leg Press" }), sets: [set({ weight: 100, reps: 8 })] },
      ], "old"),
      workoutAt(WED.getTime(), 5, [
        { template: tpl("quadriceps", { id: "legpress", title: "Leg Press" }), sets: [set({ weight: 110, reps: 9 }), set({ weight: 120, reps: 10 })] },
      ], "new"),
    ];
    const out = suggestSession({ now: WED, history, targets: targetsWith({ quadriceps: 16 }) });
    const quads = out.muscles.find((m) => m.muscle === "quadriceps")!;
    const legPress = quads.menu[0];
    expect(legPress.title).toBe("Leg Press");
    expect(legPress.fromHistory).toBe(true);
    expect(legPress.lastWeightKg).toBe(120); // last working set of most recent session
    expect(legPress.lastReps).toBe(10);
  });

  it("falls back to catalog exercises when there's no history for a muscle", () => {
    const out = suggestSession({ now: WED, history: [], targets: targetsWith({ quadriceps: 16 }) });
    const quads = out.muscles.find((m) => m.muscle === "quadriceps")!;
    expect(quads.menu.length).toBeGreaterThan(0);
    expect(quads.menu.every((i) => i.fromHistory === false)).toBe(true);
  });
});

describe("suggestSession — per-session dosing", () => {
  it("shows every behind group (no hard cap) ordered by deficit", () => {
    const out = suggestSession({
      now: WED,
      history: [],
      targets: targetsWith({ side_delts: 16, chest: 14, front_delts: 6 }),
    });
    const picked = out.muscles.map((m) => m.muscle);
    expect(picked).toEqual(["side_delts", "chest", "front_delts"]); // all, desc by deficit
  });

  it("doses each muscle to a realistic per-session amount, not the full weekly deficit", () => {
    const out = suggestSession({
      now: WED,
      history: [],
      targets: targetsWith({ quadriceps: 16, hamstrings: 12 }),
      perMuscleSets: 6,
    });
    const quads = out.muscles.find((m) => m.muscle === "quadriceps")!;
    expect(quads.deficit).toBe(16); // full weekly remaining
    expect(quads.dose).toBe(6); // but only ~6 today
    expect(out.totalSetsPlanned).toBe(12); // 6 + 6 across both groups
  });

  it("caps the dose at the weekly remaining when that's smaller", () => {
    const out = suggestSession({
      now: WED,
      history: [],
      targets: targetsWith({ abductors: 4 }),
      perMuscleSets: 6,
    });
    const abd = out.muscles.find((m) => m.muscle === "abductors")!;
    expect(abd.dose).toBe(4); // min(deficit 4, cap 6)
  });
});
