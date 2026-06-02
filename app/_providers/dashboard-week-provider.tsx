"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DayAggregate, MacroTarget, MealItem } from "@/lib/food/types";
import type { DayAgenda } from "@/lib/dashboard/mock-data";
import type {
  JoinedWorkout,
  HevyFetchErrorCode,
} from "@/lib/hevy/workouts-since";
import {
  computeMuscleCoverage,
  type MuscleCoverageResult,
} from "@/lib/dashboard/muscle-coverage";
import { WEEKLY_SET_TARGET } from "@/lib/dashboard/config";
import { addDaysStr, todayLocalStr } from "@/lib/food/local-date";
import { useFoodLog } from "./food-log-provider";
import { useHevy } from "./hevy-provider";
import { useAgenda } from "./agenda-provider";

/**
 * Owns the dashboard week slider's offset and the week-scoped datasets the three
 * weekly widgets render. At offset 0 it mirrors the live providers (no extra
 * fetch); for a past week it fetches that week itself. The food page and the
 * underlying providers are untouched — this is a read-through navigation layer.
 */
interface DashboardWeekContextType {
  weekOffset: number; // 0 = current week, -1 = last week, …
  prev: () => void;
  next: () => void;
  canGoNext: boolean;
  isCurrent: boolean;
  rangeLabel: string;
  weekStart: string; // Monday YYYY-MM-DD of the selected week
  weekEnd: string; // Sunday YYYY-MM-DD of the selected week

  // Food (CalorieSummary)
  foodWeek: DayAggregate[];
  today: MealItem[]; // only meaningful when isCurrent
  target: MacroTarget | null;
  foodLoading: boolean;

  // Hevy muscle coverage (MuscleCoverage)
  coverage: MuscleCoverageResult;
  coverageLoading: boolean;
  coverageError: string | null;
  coverageErrorCode: HevyFetchErrorCode | null;
  coverageLastFetched: number | null;

  // Agenda (WeeklyAgendaLive)
  agendaDays: DayAgenda[];
  agendaRangeLabel: string;
  agendaLoading: boolean;
}

const Ctx = createContext<DashboardWeekContextType | undefined>(undefined);

const EMPTY_COVERAGE: MuscleCoverageResult = { entries: [], attention: [] };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return body;
}

/** Monday (YYYY-MM-DD, local) of the week containing `dateStr`. */
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const back = (dt.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDaysStr(dateStr, -back);
}

/** Local-midnight ISO instant for a YYYY-MM-DD key (matches startOfCalendarWeekMs). */
function localMidnightIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

function weekRangeLabel(offset: number, monday: string, sunday: string): string {
  if (offset === 0) return "This Week";
  if (offset === -1) return "Last Week";
  const toDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const mon = toDate(monday);
  const sun = toDate(sunday);
  const mShort = (dt: Date) => dt.toLocaleDateString(undefined, { month: "short" });
  return mon.getMonth() === sun.getMonth()
    ? `${mShort(mon)} ${mon.getDate()} – ${sun.getDate()}`
    : `${mShort(mon)} ${mon.getDate()} – ${mShort(sun)} ${sun.getDate()}`;
}

export function DashboardWeekProvider({ children }: { children: ReactNode }) {
  const food = useFoodLog();
  const hevy = useHevy();
  const agenda = useAgenda();

  const [weekOffset, setWeekOffset] = useState(0);
  const offsetRef = useRef(0);
  offsetRef.current = weekOffset;

  // Selected (past) week data — only populated when weekOffset !== 0.
  const [selFoodWeek, setSelFoodWeek] = useState<DayAggregate[]>([]);
  const [selCoverage, setSelCoverage] = useState<MuscleCoverageResult>(EMPTY_COVERAGE);
  const [selAgendaDays, setSelAgendaDays] = useState<DayAgenda[]>([]);
  const [selAgendaLabel, setSelAgendaLabel] = useState("");
  const [selLoading, setSelLoading] = useState(false);
  const [selError, setSelError] = useState<string | null>(null);

  const anchorDateStr = useMemo(
    () => addDaysStr(todayLocalStr(), weekOffset * 7),
    [weekOffset],
  );
  const monday = useMemo(() => mondayOf(anchorDateStr), [anchorDateStr]);
  const sunday = useMemo(() => addDaysStr(monday, 6), [monday]);

  const loadWeek = useCallback(
    async (offset: number, anchor: string, mon: string) => {
      setSelLoading(true);
      setSelError(null);
      try {
        const since = localMidnightIso(mon);
        const until = localMidnightIso(addDaysStr(mon, 7));
        const [foodRes, hevyRes, agendaRes] = await Promise.all([
          getJson<{ week: DayAggregate[] }>(
            `/api/food/log/week?date=${encodeURIComponent(anchor)}`,
          ),
          getJson<{ workouts: JoinedWorkout[] }>(
            `/api/hevy-workouts?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
          ),
          getJson<{ days?: DayAgenda[]; rangeLabel?: string }>(
            `/api/agenda?week=${encodeURIComponent(anchor)}`,
          ),
        ]);
        // Ignore stale responses if the user moved to another week meanwhile.
        if (offsetRef.current !== offset) return;
        setSelFoodWeek(foodRes.week);
        setSelCoverage(computeMuscleCoverage(hevyRes.workouts, WEEKLY_SET_TARGET));
        setSelAgendaDays(agendaRes.days ?? []);
        setSelAgendaLabel(agendaRes.rangeLabel ?? "");
      } catch (err) {
        if (offsetRef.current === offset) setSelError((err as Error).message);
      } finally {
        if (offsetRef.current === offset) setSelLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (weekOffset === 0) return; // offset 0 reads live providers — no fetch
    void loadWeek(weekOffset, anchorDateStr, monday);
  }, [weekOffset, anchorDateStr, monday, loadWeek]);

  const prev = useCallback(() => setWeekOffset((o) => o - 1), []);
  const next = useCallback(() => setWeekOffset((o) => Math.min(0, o + 1)), []);

  const isCurrent = weekOffset === 0;

  const value = useMemo<DashboardWeekContextType>(() => {
    return {
      weekOffset,
      prev,
      next,
      canGoNext: weekOffset < 0,
      isCurrent,
      rangeLabel: weekRangeLabel(weekOffset, monday, sunday),
      weekStart: monday,
      weekEnd: sunday,

      foodWeek: isCurrent ? food.week : selFoodWeek,
      today: food.today,
      target: food.target,
      foodLoading: isCurrent ? food.loading : selLoading,

      coverage: isCurrent ? hevy.coverage : selCoverage,
      coverageLoading: isCurrent ? hevy.loading : selLoading,
      coverageError: isCurrent ? hevy.error : selError,
      coverageErrorCode: isCurrent ? hevy.errorCode : selError ? "fetch-fail" : null,
      coverageLastFetched: isCurrent ? hevy.lastFetched : selLoading ? null : Date.now(),

      agendaDays: isCurrent ? agenda.days : selAgendaDays,
      agendaRangeLabel: isCurrent ? agenda.rangeLabel : selAgendaLabel,
      agendaLoading: isCurrent ? agenda.loading : selLoading,
    };
  }, [
    weekOffset,
    prev,
    next,
    isCurrent,
    monday,
    sunday,
    food.week,
    food.today,
    food.target,
    food.loading,
    hevy.coverage,
    hevy.loading,
    hevy.error,
    hevy.errorCode,
    hevy.lastFetched,
    agenda.days,
    agenda.rangeLabel,
    agenda.loading,
    selFoodWeek,
    selCoverage,
    selAgendaDays,
    selAgendaLabel,
    selLoading,
    selError,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardWeek() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardWeek must be used within DashboardWeekProvider");
  return ctx;
}
