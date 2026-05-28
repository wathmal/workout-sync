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
import type { JoinedWorkout } from "@/lib/hevy/workouts-since";
import { WEEKLY_SET_TARGET } from "@/lib/dashboard/config";

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
  refresh: () => Promise<void>;
  commitWorkout: (workout: Workout) => Promise<SyncSummary>;
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

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return body;
}

export function HevyProvider({ children }: { children: ReactNode }) {
  const [workouts, setWorkouts] = useState<JoinedWorkout[]>([]);
  const [coverage, setCoverage] = useState<MuscleCoverageResult>(EMPTY_COVERAGE);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = startOfCalendarWeekIso();
      const { workouts } = await getJson<{ workouts: JoinedWorkout[] }>(
        `/api/hevy-workouts?since=${encodeURIComponent(since)}`,
      );
      setWorkouts(workouts);
      setCoverage(computeMuscleCoverage(workouts, WEEKLY_SET_TARGET));
      setLastFetched(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

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
        workout?: { id?: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `${res.status} ${res.statusText}`);
      }

      const startDate = new Date(workout.date);
      const time = startDate.toTimeString().slice(0, 5);
      const total_sets = workout.exercises.reduce(
        (sum, ex) => sum + ex.sets.length,
        0,
      );
      const total_volume_kg = workout.exercises.reduce(
        (sum, ex) =>
          sum +
          ex.sets.reduce(
            (s, set) =>
              s + (set.weight_kg ?? set.kg ?? 0) * (set.reps ?? 0),
            0,
          ),
        0,
      );

      const summary: SyncSummary = {
        date: startDate,
        time,
        duration_minutes: workout.duration_minutes,
        total_volume_kg,
        total_sets,
        caption: workout.caption,
        hevy_url: body.workout?.id
          ? `https://hevy.com/workout/${body.workout.id}`
          : undefined,
      };

      await refresh();
      return summary;
    },
    [refresh],
  );

  const value = useMemo<HevyContextType>(
    () => ({
      workouts,
      coverage,
      lastFetched,
      loading,
      error,
      refresh,
      commitWorkout,
    }),
    [workouts, coverage, lastFetched, loading, error, refresh, commitWorkout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHevy() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHevy must be used within HevyProvider");
  return ctx;
}
