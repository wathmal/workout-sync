"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Workout } from "@/lib/types";
import {
  computeMuscleCoverage,
  type MuscleCoverageResult,
} from "@/lib/dashboard/muscle-coverage";
import type {
  JoinedWorkout,
  HevyFetchErrorCode,
} from "@/lib/hevy/workouts-since";
import { WEEKLY_SET_TARGET } from "@/lib/dashboard/config";
import { findDuplicateOnDate, transformToHevyFormat } from "@/lib/hevy/api";
import type { DuplicateWorkoutInfo } from "@/lib/types";

export interface SyncSummary {
  date: Date;
  time: string | null;
  duration_minutes: number;
  total_volume_kg: number;
  total_sets: number;
  hevy_url?: string;
  caption?: string;
}

interface HevyContextType {
  workouts: JoinedWorkout[];
  coverage: MuscleCoverageResult;
  lastFetched: number | null;
  loading: boolean;
  error: string | null;
  errorCode: HevyFetchErrorCode | null;
  refresh: () => Promise<void>;
  commitWorkout: (workout: Workout) => Promise<SyncSummary>;
  findDuplicateForDate: (date: Date) => Promise<DuplicateWorkoutInfo | null>;
}

const Ctx = createContext<HevyContextType | undefined>(undefined);

const EMPTY_COVERAGE: MuscleCoverageResult = { entries: [], attention: [] };

/** Monday 00:00 local for the week containing `now`. Pure; safe to ship to clients. */
function startOfCalendarWeekIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.toISOString();
}

interface ApiError extends Error {
  code?: HevyFetchErrorCode;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: HevyFetchErrorCode;
  };
  if (!res.ok) {
    const err: ApiError = new Error(
      body.error ?? `${res.status} ${res.statusText}`,
    );
    err.code = body.code;
    throw err;
  }
  return body;
}

export function HevyProvider({ children }: { children: ReactNode }) {
  const [workouts, setWorkouts] = useState<JoinedWorkout[]>([]);
  const [coverage, setCoverage] = useState<MuscleCoverageResult>(EMPTY_COVERAGE);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<HevyFetchErrorCode | null>(null);

  const doRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const since = startOfCalendarWeekIso();
      const { workouts } = await getJson<{ workouts: JoinedWorkout[] }>(
        `/api/hevy-workouts?since=${encodeURIComponent(since)}`,
      );
      setWorkouts(workouts);
      setCoverage(computeMuscleCoverage(workouts, WEEKLY_SET_TARGET));
      setLastFetched(Date.now());
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      setErrorCode(apiErr.code ?? "fetch-fail");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      await doRefresh();
    } catch {
      // Swallow — error already stored in `error` / `errorCode` state for UI.
    }
  }, [doRefresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const commitWorkout = useCallback(
    async (workout: Workout): Promise<SyncSummary> => {
      const res = await fetch("/api/hevy-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workout),
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        workout?: {
          id?: string;
          workout?: { id?: string };
          workouts?: Array<{ id?: string }>;
        };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `${res.status} ${res.statusText}`);
      }

      const hevyId =
        body.workout?.id ??
        body.workout?.workout?.id ??
        body.workout?.workouts?.[0]?.id;

      // Set counts must match what Hevy actually stored — transformToHevyFormat
      // drops zero-weight/zero-reps sets before POST, so the raw workout.sets
      // count would overstate.
      const sent = transformToHevyFormat(workout);
      const total_sets = sent.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
      const total_volume_kg = sent.exercises.reduce(
        (sum, ex) =>
          sum + ex.sets.reduce((s, set) => s + (set.weight_kg ?? 0) * (set.reps ?? 0), 0),
        0,
      );

      const startDate = new Date(workout.date);
      const time = startDate.toTimeString().slice(0, 5);

      const summary: SyncSummary = {
        date: startDate,
        time,
        duration_minutes: workout.duration_minutes,
        total_volume_kg,
        total_sets,
        caption: workout.caption,
        hevy_url: hevyId ? `https://hevy.com/workout/${hevyId}` : undefined,
      };

      // Refresh failures are surfaced via provider error state (MuscleCoverage
      // etc.) rather than failing the sync — the workout DID land on Hevy.
      // Duplicate-check is unaffected because findDuplicateForDate fetches
      // its own fresh per-date window.
      await refresh();
      return summary;
    },
    [refresh],
  );

  const findDuplicateForDate = useCallback(
    async (workoutDate: Date): Promise<DuplicateWorkoutInfo | null> => {
      const y = workoutDate.getFullYear();
      const m = String(workoutDate.getMonth() + 1).padStart(2, "0");
      const d = String(workoutDate.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      const { workouts } = await getJson<{ workouts: JoinedWorkout[] }>(
        `/api/hevy-workouts/by-date?date=${dateStr}`,
      );
      return findDuplicateOnDate(workoutDate, workouts);
    },
    [],
  );

  const value = useMemo<HevyContextType>(
    () => ({
      workouts,
      coverage,
      lastFetched,
      loading,
      error,
      errorCode,
      refresh,
      commitWorkout,
      findDuplicateForDate,
    }),
    [
      workouts,
      coverage,
      lastFetched,
      loading,
      error,
      errorCode,
      refresh,
      commitWorkout,
      findDuplicateForDate,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHevy() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHevy must be used within HevyProvider");
  return ctx;
}
