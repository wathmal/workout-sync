// Per-muscle weekly working-set target. Below this triggers "needs attention".
// Configurable later via dashboard settings UI; for now a constant.
// Used by the always-on muscle-coverage card (single `shoulders` bucket).
export const WEEKLY_SET_TARGET = 10;

// --- Workout suggester ("suggest today's workout") config ---------------------
// The suggester engine tracks 18 muscles: the 16 coverage-card muscles minus
// `shoulders`, plus the three delt heads split out (front/side/rear). The split
// lives only inside the engine so the coverage card + body SVG stay unchanged.
// Targets are effective sets/week (primary 1.0 + secondary 0.5), evidence-based
// (per-muscle differs; small/assisted muscles lower because compounds feed them).
// Tune by editing here + redeploy.

export type EngineMuscle =
  | "abdominals"
  | "abductors"
  | "adductors"
  | "biceps"
  | "calves"
  | "chest"
  | "forearms"
  | "front_delts"
  | "glutes"
  | "hamstrings"
  | "lats"
  | "lower_back"
  | "quadriceps"
  | "rear_delts"
  | "side_delts"
  | "traps"
  | "triceps"
  | "upper_back";

export const MUSCLE_TARGETS: Record<EngineMuscle, number> = {
  chest: 14,
  lats: 16,
  upper_back: 12,
  quadriceps: 16,
  hamstrings: 12,
  glutes: 12,
  lower_back: 8,
  abductors: 8,
  adductors: 8,
  front_delts: 6, // overfed by all pressing -> low direct target
  side_delts: 16, // isolation-only, tolerates high volume, common weak point
  rear_delts: 12, // chronically neglected
  biceps: 12,
  triceps: 12,
  calves: 12,
  traps: 10,
  abdominals: 10,
  forearms: 8,
};

export type EngineRegion = "upper" | "lower";

export const ENGINE_REGION: Record<EngineMuscle, EngineRegion> = {
  chest: "upper",
  lats: "upper",
  upper_back: "upper",
  front_delts: "upper",
  side_delts: "upper",
  rear_delts: "upper",
  biceps: "upper",
  triceps: "upper",
  traps: "upper",
  forearms: "upper",
  abdominals: "upper", // core shown with upper by default
  quadriceps: "lower",
  hamstrings: "lower",
  glutes: "lower",
  calves: "lower",
  abductors: "lower",
  adductors: "lower",
  lower_back: "lower", // posterior chain, trained with deadlifts / leg day
};

// History window for familiarity menu (last-used loads) + recovery detection.
export const SUGGEST_HISTORY_DAYS = 75;
// A region is "recovering" if trained within this many hours. ~36-48h between
// hard sessions for the same region.
export const RECOVERY_WINDOW_H = 42;
// Realistic sets to do for ONE muscle in ONE session. The rest of that muscle's
// weekly volume is spread across your other sessions (2x/week frequency). The
// suggester shows every behind muscle with this per-session dose (capped by the
// muscle's weekly remaining) rather than dumping the full weekly deficit on one day.
export const PER_MUSCLE_SESSION_SETS = 6;
