"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DayAgenda } from "@/lib/dashboard/mock-data";
import { syncAgendaAction } from "@/app/_actions/agenda";

interface AgendaContextType {
  days: DayAgenda[];
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  /** Re-read the assembled agenda from Postgres + Hevy (fast). */
  refresh: () => Promise<void>;
  /** Pull Garmin + Calendar into Postgres, then re-read (slow — Garmin login). */
  sync: () => Promise<void>;
}

const Ctx = createContext<AgendaContextType | undefined>(undefined);

export function AgendaProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<DayAgenda[]>([]);
  const [rangeLabel, setRangeLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agenda", { cache: "no-store" });
      if (!res.ok) throw new Error(`agenda fetch failed: ${res.status}`);
      const data = (await res.json()) as { days?: DayAgenda[]; rangeLabel?: string };
      setDays(data.days ?? []);
      setRangeLabel(data.rangeLabel ?? "");
      setLastFetched(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    try {
      await syncAgendaAction();
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ days, rangeLabel, loading, error, lastFetched, refresh, sync }),
    [days, rangeLabel, loading, error, lastFetched, refresh, sync],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgenda() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAgenda must be used within AgendaProvider");
  return ctx;
}
