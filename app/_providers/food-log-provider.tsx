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
import type {
  DayAggregate,
  MacroTarget,
  MealBatchInput,
  MealItem,
  QuickAddSuggestion,
} from "@/lib/food/types";

interface FoodLogContextType {
  today: MealItem[];
  week: DayAggregate[];
  target: MacroTarget | null;
  quickAdd: QuickAddSuggestion[];
  loading: boolean;
  error: string | null;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addMeal = useCallback(
    async (batch: MealBatchInput) => {
      const { items } = await getJson<{ items: MealItem[] }>("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      await refresh();
      return items;
    },
    [refresh],
  );

  const deleteMeal = useCallback(
    async (batchId: string) => {
      await getJson(`/api/food/log?batch_id=${encodeURIComponent(batchId)}`, {
        method: "DELETE",
      });
      await refresh();
    },
    [refresh],
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
      await refresh();
      return item;
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ today, week, target, quickAdd, loading, error, addMeal, deleteMeal, editGrams, refresh }),
    [today, week, target, quickAdd, loading, error, addMeal, deleteMeal, editGrams, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFoodLog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFoodLog must be used within FoodLogProvider");
  return ctx;
}
