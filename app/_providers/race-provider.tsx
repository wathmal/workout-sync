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
import {
  deriveRaceViews,
  nextRaceView,
  type RaceEvent,
  type RaceEventInput,
  type RaceEventPatch,
  type RaceView,
} from "@/lib/race/types";
import { todayLocalStr } from "@/lib/food/local-date";

export type ResultPatch = Pick<
  RaceEventPatch,
  "resultTime" | "resultPlacement" | "resultNote"
>;

interface RaceContextType {
  /** All races, derived + sorted by date. */
  views: RaceView[];
  /** Distinct years that have races (plus current year), newest first. */
  years: number[];
  /** Selected calendar year (view filter). */
  year: number;
  setYear: (y: number) => void;
  /** Derived races limited to the selected year. */
  yearViews: RaceView[];
  /** The nearest non-past race across all years. */
  nextRace: RaceView | null;

  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  refresh: () => Promise<void>;
  addRace: (input: RaceEventInput) => Promise<RaceEvent>;
  editRace: (id: string, patch: RaceEventPatch) => Promise<RaceEvent | null>;
  setResult: (id: string, result: ResultPatch) => Promise<RaceEvent | null>;
  removeRace: (id: string) => Promise<void>;
}

const Ctx = createContext<RaceContextType | undefined>(undefined);

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return body;
}

export function RaceProvider({ children }: { children: ReactNode }) {
  const [races, setRaces] = useState<RaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [year, setYear] = useState<number>(() => Number(todayLocalStr().slice(0, 4)));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { races: fetched } = await getJson<{ races: RaceEvent[] }>("/api/races");
      setRaces(fetched);
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

  const views = useMemo(() => deriveRaceViews(races, todayLocalStr()), [races]);

  const years = useMemo(() => {
    const set = new Set<number>(views.map((v) => Number(v.date.slice(0, 4))));
    set.add(Number(todayLocalStr().slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [views]);

  const yearViews = useMemo(
    () => views.filter((v) => Number(v.date.slice(0, 4)) === year),
    [views, year],
  );

  const nextRace = useMemo(() => nextRaceView(views), [views]);

  const addRace = useCallback(async (input: RaceEventInput) => {
    const { race } = await getJson<{ race: RaceEvent }>("/api/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    await refresh();
    return race;
  }, [refresh]);

  const editRace = useCallback(async (id: string, patch: RaceEventPatch) => {
    const { race } = await getJson<{ race: RaceEvent }>(
      `/api/races/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    await refresh();
    return race;
  }, [refresh]);

  const setResult = useCallback(
    (id: string, result: ResultPatch) => editRace(id, result),
    [editRace],
  );

  const removeRace = useCallback(async (id: string) => {
    await getJson(`/api/races/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      views,
      years,
      year,
      setYear,
      yearViews,
      nextRace,
      loading,
      error,
      lastFetched,
      refresh,
      addRace,
      editRace,
      setResult,
      removeRace,
    }),
    [views, years, year, yearViews, nextRace, loading, error, lastFetched, refresh, addRace, editRace, setResult, removeRace],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRaces() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRaces must be used within RaceProvider");
  return ctx;
}
