"use client";

import { useCallback, useRef, useState } from "react";
import type { JoinedWorkout } from "@/lib/hevy/workouts-since";
import { suggestSession, type SuggestedSession } from "@/lib/dashboard/suggest-engine";
import { SUGGEST_HISTORY_DAYS, type EngineRegion } from "@/lib/dashboard/config";

const DAY_MS = 24 * 60 * 60 * 1000;

interface SuggestionState {
  suggestion: SuggestedSession | null;
  loading: boolean;
  error: string | null;
}

/**
 * Lazily fetches ~SUGGEST_HISTORY_DAYS of Hevy history (only when the user asks)
 * and runs the pure suggest engine. Independent of the week provider — the
 * suggester needs a longer window for familiarity + recovery.
 */
export function useSuggestion() {
  const [state, setState] = useState<SuggestionState>({
    suggestion: null,
    loading: false,
    error: null,
  });
  // Keep the fetched history so the user can switch region without a re-fetch.
  const historyRef = useRef<JoinedWorkout[]>([]);

  const generate = useCallback(async (force = false) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // Bucket the window start to local midnight so the 6h server cache key is
      // stable across the day (a raw now-75d changes every ms → never a hit).
      // The engine's `now` below stays precise; only the fetch start is bucketed.
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const since = new Date(start.getTime() - SUGGEST_HISTORY_DAYS * DAY_MS).toISOString();
      const res = await fetch(
        `/api/hevy-workouts?since=${encodeURIComponent(since)}&maxPages=12&cache=1${
          force ? "&refresh=1" : ""
        }`,
      );
      const body = (await res.json().catch(() => ({}))) as {
        workouts?: JoinedWorkout[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `${res.status} ${res.statusText}`);
      }
      historyRef.current = body.workouts ?? [];
      const suggestion = suggestSession({ now: new Date(), history: historyRef.current });
      setState({ suggestion, loading: false, error: null });
    } catch (err) {
      setState({ suggestion: null, loading: false, error: (err as Error).message });
    }
  }, []);

  // Re-run the engine for a user-chosen region against the already-fetched history.
  const selectRegion = useCallback((region: EngineRegion) => {
    setState((s) => ({
      ...s,
      suggestion: suggestSession({
        now: new Date(),
        history: historyRef.current,
        forceRegion: region,
      }),
    }));
  }, []);

  return { ...state, generate, selectRegion };
}
