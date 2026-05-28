"use client";

import { useEffect, useState, useCallback } from "react";

export type FoodLocale = "en" | "en-AU" | "en-US" | "fr";

const KEY = "workout-sync:food-locale";

export const FOOD_LOCALES: ReadonlyArray<{ value: FoodLocale; label: string; hint: string }> = [
  { value: "en", label: "Auto", hint: "No preference" },
  { value: "en-AU", label: "Australia", hint: "AFDC" },
  { value: "en-US", label: "USA", hint: "FDC" },
  { value: "fr", label: "France", hint: "AGRIBALYSE" },
];

export function useFoodLocale() {
  const [locale, setLocaleState] = useState<FoodLocale>("en");

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY) as FoodLocale | null;
      if (v && FOOD_LOCALES.some((l) => l.value === v)) setLocaleState(v);
    } catch {
      // localStorage unavailable (SSR, private mode) — keep default
    }
  }, []);

  const setLocale = useCallback((v: FoodLocale) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // ignore
    }
    setLocaleState(v);
  }, []);

  return { locale, setLocale };
}
