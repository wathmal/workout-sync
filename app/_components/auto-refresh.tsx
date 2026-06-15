"use client";

import { useEffect } from "react";
import { useAgenda } from "@/app/_providers/agenda-provider";
import { useFoodLog } from "@/app/_providers/food-log-provider";
import { useHevy } from "@/app/_providers/hevy-provider";
import { useRaces } from "@/app/_providers/race-provider";

/**
 * Periodically re-fetches the dashboard providers so the page stays current
 * without a manual reload. Mirrors vocab-app/admin's AutoRefresh, adapted to
 * this app's client-provider data model (router.refresh() wouldn't touch
 * provider state, which is client-fetched in useEffect).
 *
 * This is a *data read* refresh only: it calls each provider's refresh() — the
 * read endpoints (e.g. agenda GET /api/agenda reads Postgres) — and NOT the
 * agenda sync() server action, so it never triggers a Garmin/Calendar sync.
 *
 * The refresh fns are useCallback-stable in their providers, so the interval is
 * set once and not reset on unrelated state changes.
 */
export function AutoRefresh({ intervalMs = 900_000 }: { intervalMs?: number }) {
  const { refresh: refreshAgenda } = useAgenda();
  const { refresh: refreshFood } = useFoodLog();
  const { refresh: refreshHevy } = useHevy();
  const { refresh: refreshRaces } = useRaces();

  useEffect(() => {
    const id = setInterval(() => {
      void refreshAgenda();
      void refreshFood();
      void refreshHevy();
      void refreshRaces();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refreshAgenda, refreshFood, refreshHevy, refreshRaces]);

  return null;
}
