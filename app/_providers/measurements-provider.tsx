"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { BodyMeasurementsInput } from "@/lib/body/measurements";

const STORAGE_KEY = "workout-sync:measurements:v3";

interface MeasurementsContextType {
  inputs: BodyMeasurementsInput | null;
  setInputs: (next: BodyMeasurementsInput | null) => void;
  hydrated: boolean;
}

const Ctx = createContext<MeasurementsContextType | undefined>(undefined);

export function MeasurementsProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputsState] = useState<BodyMeasurementsInput | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setInputsState(JSON.parse(raw) as BodyMeasurementsInput);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const setInputs = useCallback((next: BodyMeasurementsInput | null) => {
    setInputsState(next);
    try {
      if (next) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore quota / private mode
    }
  }, []);

  return (
    <Ctx.Provider value={{ inputs, setInputs, hydrated }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMeasurements() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMeasurements must be used within MeasurementsProvider");
  return ctx;
}
