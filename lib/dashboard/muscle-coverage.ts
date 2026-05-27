import type { JoinedWorkout, HevyRawSet } from "../hevy/workouts-since";

export type MuscleBucket = "met" | "below" | "untouched";

export const TRACKED_MUSCLES = [
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower_back",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
  "upper_back",
] as const;

export type TrackedMuscle = (typeof TRACKED_MUSCLES)[number];

const TRACKED_SET = new Set<string>(TRACKED_MUSCLES);

export interface MuscleCoverageEntry {
  group: TrackedMuscle;
  sets: number; // weighted set count
  bucket: MuscleBucket;
}

export interface AttentionRow {
  group: TrackedMuscle;
  label: string; // human-friendly name e.g. "Lower Back"
  meta: string;
  bucket: Exclude<MuscleBucket, "met">;
  sets: number;
}

export interface MuscleCoverageResult {
  entries: MuscleCoverageEntry[];
  attention: AttentionRow[];
}

const PRIMARY_WEIGHT = 1.0;
const SECONDARY_WEIGHT = 0.5;

function setType(s: HevyRawSet): string {
  return (s.set_type ?? s.type ?? "normal").toLowerCase();
}

function bucketFor(sets: number, target: number): MuscleBucket {
  if (sets <= 0) return "untouched";
  if (sets >= target) return "met";
  return "below";
}

function humanLabel(m: TrackedMuscle): string {
  return m
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatSets(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function computeMuscleCoverage(
  workouts: JoinedWorkout[],
  target: number,
): MuscleCoverageResult {
  const counts = new Map<TrackedMuscle, number>();
  for (const m of TRACKED_MUSCLES) counts.set(m, 0);

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const template = exercise.template;
      if (!template) continue;

      const workingSetCount = exercise.sets.filter(
        (s) => setType(s) !== "warmup",
      ).length;
      if (workingSetCount === 0) continue;

      const primary = template.primary_muscle_group;
      if (TRACKED_SET.has(primary)) {
        counts.set(
          primary as TrackedMuscle,
          (counts.get(primary as TrackedMuscle) ?? 0) +
            workingSetCount * PRIMARY_WEIGHT,
        );
      }

      for (const secondary of template.secondary_muscle_groups ?? []) {
        if (!TRACKED_SET.has(secondary)) continue;
        counts.set(
          secondary as TrackedMuscle,
          (counts.get(secondary as TrackedMuscle) ?? 0) +
            workingSetCount * SECONDARY_WEIGHT,
        );
      }
    }
  }

  const entries: MuscleCoverageEntry[] = TRACKED_MUSCLES.map((group) => {
    const sets = counts.get(group) ?? 0;
    return { group, sets, bucket: bucketFor(sets, target) };
  });

  const untouched = entries
    .filter((e) => e.bucket === "untouched")
    .sort((a, b) => a.group.localeCompare(b.group))
    .map<AttentionRow>((e) => ({
      group: e.group,
      label: humanLabel(e.group),
      meta: `0/${target}`,
      bucket: "untouched",
      sets: 0,
    }));

  const below = entries
    .filter((e) => e.bucket === "below")
    .sort((a, b) => a.sets - b.sets || a.group.localeCompare(b.group))
    .map<AttentionRow>((e) => ({
      group: e.group,
      label: humanLabel(e.group),
      meta: `${formatSets(e.sets)}/${target}`,
      bucket: "below",
      sets: e.sets,
    }));

  return { entries, attention: [...untouched, ...below] };
}
