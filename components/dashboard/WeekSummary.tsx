"use client";

import { useDashboardWeek } from "@/app/_providers/dashboard-week-provider";

// Session classified by its name — independent of source (Garmin or Hevy).
const RUN_RE = /\b(runs?|running|jog(?:s|ging)?|parkrun)\b/i;
const WALK_RE = /\b(walks?|walking|hikes?|hiking)\b/i;

/**
 * Replaces the old hardcoded heading blurb with a live summary of the selected
 * week's completed sessions: runs (inferred per session from its name, whether
 * tracked in Garmin or Hevy) and workouts (everything that isn't a run or a walk).
 * Walks count as neither. Planned calendar items are not counted. Rewinds with
 * the week slider.
 */
export function WeekSummary() {
  const { agendaDays, agendaLoading } = useDashboardWeek();

  let workouts = 0;
  let runs = 0;
  for (const day of agendaDays) {
    for (const s of day.sessions) {
      if (s.status !== "done") continue; // skip planned/rest
      if (RUN_RE.test(s.name)) runs++;
      else if (WALK_RE.test(s.name)) continue; // walks excluded from workouts
      else workouts++;
    }
  }

  if (agendaLoading && workouts === 0 && runs === 0) {
    return <span style={{ color: "var(--color-text-tertiary)", fontWeight: 400 }}>Summarising…</span>;
  }

  return (
    <>
      {workouts} {workouts === 1 ? "workout" : "workouts"}
      {", "}
      <span style={{ color: "var(--color-text-tertiary)", fontWeight: 400 }}>
        {runs} {runs === 1 ? "run" : "runs"}
      </span>
    </>
  );
}
