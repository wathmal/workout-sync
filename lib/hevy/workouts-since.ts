import "server-only";
import { cache } from "react";
import { getHevyTemplateById, type HevyExerciseTemplate } from "./catalog";

const HEVY_BASE = "https://api.hevyapp.com/v1";
const PAGE_SIZE = 10;
const MAX_PAGES = 5;
const REVALIDATE_SECONDS = 300;
export const HEVY_WORKOUTS_TAG = "hevy:workouts";

export type HevySetType = "normal" | "warmup" | "dropset" | "failure";

export interface HevyRawSet {
  index?: number;
  set_type?: HevySetType;
  type?: HevySetType; // some payloads use `type`
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
}

export interface HevyRawExercise {
  exercise_template_id: string;
  title?: string;
  superset_id?: number | null;
  notes?: string;
  sets: HevyRawSet[];
}

export interface HevyRawWorkout {
  id: string;
  title?: string;
  start_time: string;
  end_time?: string;
  exercises: HevyRawExercise[];
}

interface WorkoutsListResponse {
  page?: number;
  page_count?: number;
  workouts?: HevyRawWorkout[];
}

export interface JoinedExercise {
  exercise_template_id: string;
  template: HevyExerciseTemplate | null;
  sets: HevyRawSet[];
}

export interface JoinedWorkout {
  id: string;
  title: string;
  start_time: string;
  exercises: JoinedExercise[];
}

export type HevyFetchErrorCode = "no-key" | "fetch-fail";

export type GetWorkoutsResult =
  | { ok: true; workouts: JoinedWorkout[] }
  | { ok: false; error: HevyFetchErrorCode; status?: number };

class HevyFetchError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function fetchPage(
  page: number,
  apiKey: string,
  fresh: boolean,
): Promise<WorkoutsListResponse> {
  const url = `${HEVY_BASE}/workouts?page=${page}&pageSize=${PAGE_SIZE}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "api-key": apiKey },
    ...(fresh
      ? { cache: "no-store" as const }
      : { next: { tags: [HEVY_WORKOUTS_TAG], revalidate: REVALIDATE_SECONDS } }),
  });
  if (!res.ok) {
    throw new HevyFetchError(res.status, `Hevy /workouts page ${page} → ${res.status}`);
  }
  return (await res.json()) as WorkoutsListResponse;
}

function joinWorkout(raw: HevyRawWorkout): JoinedWorkout {
  return {
    id: raw.id,
    title: raw.title ?? "",
    start_time: raw.start_time,
    exercises: raw.exercises.map((ex) => ({
      exercise_template_id: ex.exercise_template_id,
      template: getHevyTemplateById(ex.exercise_template_id),
      sets: ex.sets ?? [],
    })),
  };
}

async function loadWorkoutsSince(
  sinceMs: number,
  fresh = false,
): Promise<GetWorkoutsResult> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) return { ok: false, error: "no-key" };

  const cutoffMs = sinceMs;
  const collected: JoinedWorkout[] = [];

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await fetchPage(page, apiKey, fresh);
      const list = data.workouts ?? [];
      if (list.length === 0) break;

      let oldestInPageMs = Infinity;
      for (const raw of list) {
        const t = Date.parse(raw.start_time);
        if (!Number.isFinite(t)) continue;
        oldestInPageMs = Math.min(oldestInPageMs, t);
        if (t >= cutoffMs) collected.push(joinWorkout(raw));
      }

      const pageCount = data.page_count ?? page;
      if (oldestInPageMs < cutoffMs) break;
      if (page >= pageCount) break;
    }
    return { ok: true, workouts: collected };
  } catch (err) {
    console.error("Hevy workouts fetch failed:", err);
    const status = err instanceof HevyFetchError ? err.status : undefined;
    return { ok: false, error: "fetch-fail", status };
  }
}

export const getWorkoutsSince = cache(loadWorkoutsSince);

/**
 * Start of the current calendar week (Monday 00:00 local time) as ms timestamp.
 * Used as the `sinceMs` arg to `getWorkoutsSince` for week-aligned windows.
 */
export function startOfCalendarWeekMs(now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0, Sun=6
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}
