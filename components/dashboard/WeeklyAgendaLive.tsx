"use client";

import { useMemo } from "react";
import { useDashboardWeek } from "@/app/_providers/dashboard-week-provider";
import type { DayAgenda, DayName } from "@/lib/dashboard/mock-data";
import { WeeklyAgenda } from "./WeeklyAgenda";

const DAY_NAMES: DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Blank Mon–Sun skeleton for the loading / fetch-failed state — real day headers,
 * no sessions, no "Rest" label (sessions omitted but isRest left unset). Computed
 * from the browser clock; it's only a placeholder until /api/agenda responds with
 * the authoritative (USER_TZ) week. Deliberately NOT mock workouts — empty means
 * "not loaded", not fabricated data.
 */
function emptyWeek(): DayAgenda[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const todayStr = now.toDateString();
  return DAY_NAMES.map((day, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      day,
      date: dt.getDate(),
      sessions: [],
      isToday: dt.toDateString() === todayStr || undefined,
    };
  });
}

/**
 * Feeds the live agenda (Hevy + Garmin + Calendar merge) into WeeklyAgenda. Shows
 * a blank week while loading or if the fetch fails — never fabricated data.
 */
export function WeeklyAgendaLive() {
  const { agendaDays: days } = useDashboardWeek();
  const placeholder = useMemo(() => emptyWeek(), []);
  const ready = days.length > 0;
  return <WeeklyAgenda days={ready ? days : placeholder} />;
}
