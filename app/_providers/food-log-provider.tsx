"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DayAggregate,
  MacroTarget,
  MealBatchInput,
  MealItem,
  QuickAddSuggestion,
} from "@/lib/food/types";
import { todayLocalStr } from "@/lib/food/local-date";

interface FoodLogContextType {
  /** Actual today's meals — drives the dashboard, independent of navigation. */
  today: MealItem[];
  week: DayAggregate[];
  target: MacroTarget | null;
  quickAdd: QuickAddSuggestion[];
  lastFetched: number | null;
  loading: boolean;
  error: string | null;

  /** Day navigator (food page). `dayMeals` = meals for `selectedDate`. */
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dayMeals: MealItem[];
  dayLoading: boolean;

  addMeal: (batch: MealBatchInput) => Promise<MealItem[]>;
  deleteMeal: (batchId: string) => Promise<void>;
  editGrams: (itemId: string, grams: number) => Promise<MealItem | null>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<FoodLogContextType | undefined>(undefined);

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return body;
}

export function FoodLogProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<MealItem[]>([]);
  const [week, setWeek] = useState<DayAggregate[]>([]);
  const [target, setTarget] = useState<MacroTarget | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddSuggestion[]>([]);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => todayLocalStr());
  const [dayMeals, setDayMeals] = useState<MealItem[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, w, tg, qa] = await Promise.all([
        getJson<{ items: MealItem[] }>("/api/food/log"),
        getJson<{ week: DayAggregate[] }>("/api/food/log/week"),
        getJson<{ target: MacroTarget | null }>("/api/food/targets"),
        getJson<{ items: QuickAddSuggestion[] }>("/api/food/quick-add"),
      ]);
      setToday(t.items);
      setWeek(w.week);
      setTarget(tg.target);
      setQuickAdd(qa.items);
      setLastFetched(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch meals for an arbitrary day (the navigator's selected date).
  const reloadDay = useCallback(async (date: string) => {
    setDayLoading(true);
    try {
      const { items } = await getJson<{ items: MealItem[] }>(
        `/api/food/log?date=${encodeURIComponent(date)}`,
      );
      // Ignore stale responses if the user moved on to another date.
      if (selectedDateRef.current === date) setDayMeals(items);
    } catch (err) {
      if (selectedDateRef.current === date) setError((err as Error).message);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void reloadDay(selectedDate);
  }, [selectedDate, reloadDay]);

  const addMeal = useCallback(
    async (batch: MealBatchInput) => {
      const { items } = await getJson<{ items: MealItem[] }>("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      await Promise.all([refresh(), reloadDay(selectedDateRef.current)]);
      return items;
    },
    [refresh, reloadDay],
  );

  const deleteMeal = useCallback(
    async (batchId: string) => {
      await getJson(`/api/food/log?batch_id=${encodeURIComponent(batchId)}`, {
        method: "DELETE",
      });
      await Promise.all([refresh(), reloadDay(selectedDateRef.current)]);
    },
    [refresh, reloadDay],
  );

  const editGrams = useCallback(
    async (itemId: string, grams: number) => {
      const { item } = await getJson<{ item: MealItem }>(
        `/api/food/log/${encodeURIComponent(itemId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grams }),
        },
      );
      await Promise.all([refresh(), reloadDay(selectedDateRef.current)]);
      return item;
    },
    [refresh, reloadDay],
  );

  const value = useMemo(
    () => ({
      today,
      week,
      target,
      quickAdd,
      lastFetched,
      loading,
      error,
      selectedDate,
      setSelectedDate,
      dayMeals,
      dayLoading,
      addMeal,
      deleteMeal,
      editGrams,
      refresh,
    }),
    [today, week, target, quickAdd, lastFetched, loading, error, selectedDate, dayMeals, dayLoading, addMeal, deleteMeal, editGrams, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFoodLog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFoodLog must be used within FoodLogProvider");
  return ctx;
}
