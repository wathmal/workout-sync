/**
 * "Suggest today's workout" engine — pure + isomorphic (runs client-side via the
 * useSuggestion hook). Given recent Hevy history, it picks Upper or Lower for
 * today and lists the muscles behind their weekly target plus a familiarity-first
 * exercise menu.
 *
 * Self-contained on purpose: it tracks its OWN 18-muscle set (delts split into
 * front/side/rear) and does NOT touch lib/dashboard/muscle-coverage.ts, the
 * providers, or the body SVG — those keep one `shoulders` bucket.
 *
 * Type-only import from the server-only workouts-since module is erased at
 * compile time, so this stays client-safe (same pattern as muscle-coverage.ts).
 */
import type { JoinedWorkout, HevyRawSet } from "../hevy/workouts-since";
import { getExercisesByMuscleGroup, type HevyExerciseTemplate } from "../hevy/catalog";
import {
  ENGINE_REGION,
  MUSCLE_TARGETS,
  PER_MUSCLE_SESSION_SETS,
  RECOVERY_WINDOW_H,
  type EngineMuscle,
  type EngineRegion,
} from "./config";

const PRIMARY_WEIGHT = 1.0;
const SECONDARY_WEIGHT = 0.5;
const MENU_SIZE = 4;
const HOUR_MS = 60 * 60 * 1000;

export interface MenuItem {
  templateId: string;
  title: string;
  fromHistory: boolean;
  lastWeightKg?: number;
  lastReps?: number;
}

export interface SuggestedMuscle {
  muscle: EngineMuscle;
  label: string;
  target: number;
  current: number; // effective sets this calendar week
  deficit: number; // target - current (>0), weekly remaining
  dose: number; // suggested sets to do for this muscle TODAY (<= deficit)
  menu: MenuItem[];
}

export interface SuggestedSession {
  region: EngineRegion;
  regionLabel: string;
  generatedAt: string;
  muscles: SuggestedMuscle[];
  totalSetsPlanned: number;
  note?: string;
}

export interface SuggestInput {
  now: Date;
  history: JoinedWorkout[]; // ~SUGGEST_HISTORY_DAYS of workouts
  targets?: Record<EngineMuscle, number>;
  recoveryWindowH?: number;
  perMuscleSets?: number; // per-session dose cap per muscle
  forceRegion?: EngineRegion; // user override — skip the auto upper/lower pick
}

// --- muscle resolution --------------------------------------------------------

const SIDE_DELT_RE = /lateral raise|upright row/i;
const REAR_DELT_RE = /reverse fly|rear delt|face pull|pull[\s-]?apart|y raise/i;

/** Map a `shoulders`-tagged exercise to a delt head by its title. */
export function classifyShoulder(
  title: string,
): "front_delts" | "side_delts" | "rear_delts" {
  if (SIDE_DELT_RE.test(title)) return "side_delts";
  if (REAR_DELT_RE.test(title)) return "rear_delts";
  return "front_delts"; // presses + front raises (also the secondary-shoulders default)
}

const ENGINE_MUSCLE_SET = new Set<string>(Object.keys(MUSCLE_TARGETS));

/**
 * Resolve a raw Hevy muscle-group string (+ owning exercise title for delts) to
 * a tracked EngineMuscle, or null for untracked groups (cardio/full_body/neck/other).
 */
export function resolveMuscle(
  rawGroup: string,
  title: string,
): EngineMuscle | null {
  if (rawGroup === "shoulders") return classifyShoulder(title);
  if (ENGINE_MUSCLE_SET.has(rawGroup)) return rawGroup as EngineMuscle;
  return null;
}

function primaryMuscleOf(t: HevyExerciseTemplate): EngineMuscle | null {
  return resolveMuscle(t.primary_muscle_group, t.title);
}

function setType(s: HevyRawSet): string {
  return (s.set_type ?? s.type ?? "normal").toLowerCase();
}

function workingSets(sets: HevyRawSet[]): HevyRawSet[] {
  return sets.filter((s) => setType(s) !== "warmup");
}

function humanLabel(m: EngineMuscle): string {
  return m
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// --- week / counting ----------------------------------------------------------

function startOfCalendarWeekMs(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  d.setDate(d.getDate() - ((day + 6) % 7)); // back to Monday
  return d.getTime();
}

/** Effective sets/muscle (primary 1.0 + secondary 0.5, warmups excluded). */
function countEffectiveSets(
  workouts: JoinedWorkout[],
): Map<EngineMuscle, number> {
  const counts = new Map<EngineMuscle, number>();
  const add = (m: EngineMuscle, n: number) =>
    counts.set(m, (counts.get(m) ?? 0) + n);

  for (const w of workouts) {
    for (const ex of w.exercises) {
      const t = ex.template;
      if (!t) continue;
      const working = workingSets(ex.sets).length;
      if (working === 0) continue;

      const primary = resolveMuscle(t.primary_muscle_group, t.title);
      if (primary) add(primary, working * PRIMARY_WEIGHT);

      for (const sec of t.secondary_muscle_groups ?? []) {
        const m = resolveMuscle(sec, t.title);
        if (m) add(m, working * SECONDARY_WEIGHT);
      }
    }
  }
  return counts;
}

/** Regions a workout trained, by PRIMARY mover only (defines real recovery). */
function regionsTrained(w: JoinedWorkout): Set<EngineRegion> {
  const regions = new Set<EngineRegion>();
  for (const ex of w.exercises) {
    const t = ex.template;
    if (!t) continue;
    if (workingSets(ex.sets).length === 0) continue;
    const m = primaryMuscleOf(t);
    if (m) regions.add(ENGINE_REGION[m]);
  }
  return regions;
}

function lastTrainedByRegion(
  workouts: JoinedWorkout[],
): Record<EngineRegion, number | null> {
  const last: Record<EngineRegion, number | null> = { upper: null, lower: null };
  for (const w of workouts) {
    const ms = Date.parse(w.start_time);
    if (!Number.isFinite(ms)) continue;
    for (const r of regionsTrained(w)) {
      if (last[r] == null || ms > last[r]!) last[r] = ms;
    }
  }
  return last;
}

// --- familiarity menu ---------------------------------------------------------

interface HistEntry {
  template: HevyExerciseTemplate;
  lastMs: number;
  lastWeightKg?: number;
  lastReps?: number;
  count: number;
}

/** Most-recent performance + session count per logged exercise, grouped by primary muscle. */
function historyByMuscle(
  history: JoinedWorkout[],
): Map<EngineMuscle, HistEntry[]> {
  const byId = new Map<string, HistEntry>();

  for (const w of history) {
    const ms = Date.parse(w.start_time);
    if (!Number.isFinite(ms)) continue;
    for (const ex of w.exercises) {
      const t = ex.template;
      if (!t) continue;
      const working = workingSets(ex.sets);
      if (working.length === 0) continue;

      const existing = byId.get(t.id);
      const last = working[working.length - 1];
      if (!existing) {
        byId.set(t.id, {
          template: t,
          lastMs: ms,
          lastWeightKg: last.weight_kg ?? undefined,
          lastReps: last.reps ?? undefined,
          count: 1,
        });
      } else {
        existing.count += 1;
        if (ms > existing.lastMs) {
          existing.lastMs = ms;
          existing.lastWeightKg = last.weight_kg ?? undefined;
          existing.lastReps = last.reps ?? undefined;
        }
      }
    }
  }

  const byMuscle = new Map<EngineMuscle, HistEntry[]>();
  for (const entry of byId.values()) {
    const m = primaryMuscleOf(entry.template);
    if (!m) continue;
    const arr = byMuscle.get(m) ?? [];
    arr.push(entry);
    byMuscle.set(m, arr);
  }
  return byMuscle;
}

/** Catalog exercises whose PRIMARY mover is this muscle (delts via title split). */
function catalogCandidates(muscle: EngineMuscle): HevyExerciseTemplate[] {
  const raw = muscle.endsWith("_delts")
    ? getExercisesByMuscleGroup("shoulders")
    : getExercisesByMuscleGroup(muscle);
  return raw.filter((t) => primaryMuscleOf(t) === muscle);
}

function buildMenu(
  muscle: EngineMuscle,
  byMuscle: Map<EngineMuscle, HistEntry[]>,
): MenuItem[] {
  const fromHist = (byMuscle.get(muscle) ?? [])
    .slice()
    .sort((a, b) => b.lastMs - a.lastMs || b.count - a.count)
    .slice(0, MENU_SIZE)
    .map<MenuItem>((e) => ({
      templateId: e.template.id,
      title: e.template.title,
      fromHistory: true,
      lastWeightKg: e.lastWeightKg,
      lastReps: e.lastReps,
    }));

  if (fromHist.length >= MENU_SIZE) return fromHist;

  const have = new Set(fromHist.map((i) => i.templateId));
  const fill = catalogCandidates(muscle)
    .filter((t) => !have.has(t.id))
    .sort((a, b) => Number(a.is_custom) - Number(b.is_custom)) // official first
    .slice(0, MENU_SIZE - fromHist.length)
    .map<MenuItem>((t) => ({
      templateId: t.id,
      title: t.title,
      fromHistory: false,
    }));

  return [...fromHist, ...fill];
}

// --- region pick helpers ------------------------------------------------------

const REGIONS: EngineRegion[] = ["upper", "lower"];

function pickByDeficit(
  regions: EngineRegion[],
  totals: Record<EngineRegion, number>,
): EngineRegion {
  // larger total deficit wins; deterministic tie-break favours upper.
  return regions
    .slice()
    .sort((a, b) => totals[b] - totals[a] || (a === "upper" ? -1 : 1))[0];
}

function pickByOldest(
  regions: EngineRegion[],
  last: Record<EngineRegion, number | null>,
): EngineRegion {
  // longest-rested wins (smallest lastTrained ms); null = never = most rested.
  return regions
    .slice()
    .sort((a, b) => (last[a] ?? -Infinity) - (last[b] ?? -Infinity))[0];
}

// --- main ---------------------------------------------------------------------

export function suggestSession(input: SuggestInput): SuggestedSession {
  const {
    now,
    history,
    targets = MUSCLE_TARGETS,
    recoveryWindowH = RECOVERY_WINDOW_H,
    perMuscleSets = PER_MUSCLE_SESSION_SETS,
    forceRegion,
  } = input;

  const nowMs = now.getTime();
  const weekStart = startOfCalendarWeekMs(now);
  const thisWeek = history.filter((w) => {
    const ms = Date.parse(w.start_time);
    return Number.isFinite(ms) && ms >= weekStart;
  });

  const counts = countEffectiveSets(thisWeek);
  const last = lastTrainedByRegion(history);
  const recovering: Record<EngineRegion, boolean> = {
    upper: last.upper != null && nowMs - last.upper < recoveryWindowH * HOUR_MS,
    lower: last.lower != null && nowMs - last.lower < recoveryWindowH * HOUR_MS,
  };

  // deficit per muscle + per-region totals
  const deficits = new Map<EngineMuscle, number>();
  const regionTotal: Record<EngineRegion, number> = { upper: 0, lower: 0 };
  for (const muscle of Object.keys(targets) as EngineMuscle[]) {
    const current = counts.get(muscle) ?? 0;
    const deficit = Math.max(0, targets[muscle] - current);
    deficits.set(muscle, deficit);
    if (deficit > 0) regionTotal[ENGINE_REGION[muscle]] += deficit;
  }

  const generatedAt = now.toISOString();
  const regionLabel = (r: EngineRegion) => (r === "upper" ? "Upper Day" : "Lower Day");

  // pick region — user override (forceRegion) wins; otherwise auto by recovery + deficit
  let region: EngineRegion;
  let note: string | undefined;

  if (forceRegion) {
    region = forceRegion;
    if (regionTotal[region] === 0) {
      note = "On target — nothing behind in this region this week.";
    }
  } else {
    const candidates = REGIONS.filter((r) => regionTotal[r] > 0);
    if (candidates.length === 0) {
      return {
        region: pickByOldest(REGIONS, last),
        regionLabel: regionLabel(pickByOldest(REGIONS, last)),
        generatedAt,
        muscles: [],
        totalSetsPlanned: 0,
        note: "You're on target for the week. Rest, or train whatever you fancy.",
      };
    }
    const fresh = candidates.filter((r) => !recovering[r]);
    if (fresh.length > 0) {
      region = pickByDeficit(fresh, regionTotal);
    } else {
      region = pickByOldest(candidates, last);
      note =
        "Both regions were trained recently — this is your most-rested option. Go lighter or rest.";
    }
  }

  // ALL behind muscles in the region, highest deficit first — no hard cap; the
  // user picks. Each muscle gets a realistic per-session dose (the rest of its
  // weekly volume is for another session this week).
  const behind = (Object.keys(targets) as EngineMuscle[])
    .filter((m) => ENGINE_REGION[m] === region && (deficits.get(m) ?? 0) > 0)
    .sort((a, b) => (deficits.get(b) ?? 0) - (deficits.get(a) ?? 0));

  const byMuscle = historyByMuscle(history);
  const muscles: SuggestedMuscle[] = behind.map((m) => {
    const deficit = deficits.get(m) ?? 0;
    return {
      muscle: m,
      label: humanLabel(m),
      target: targets[m],
      current: round1(counts.get(m) ?? 0),
      deficit: round1(deficit),
      dose: Math.max(1, Math.round(Math.min(deficit, perMuscleSets))),
      menu: buildMenu(m, byMuscle),
    };
  });

  return {
    region,
    regionLabel: regionLabel(region),
    generatedAt,
    muscles,
    totalSetsPlanned: muscles.reduce((s, m) => s + m.dose, 0),
    note,
  };
}
