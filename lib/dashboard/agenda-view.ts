/**
 * Pure presentation helpers for the weekly agenda — discipline encoding, day
 * grouping, and the week-level breakdown. Client-safe (no server deps) so both
 * the agenda grid and the overview-header summary can share them.
 */
import type { DayAgenda, Session, SessionDiscipline } from "./mock-data";

// Walking is the high-frequency / low-signal entry — kept deliberately QUIET
// (neutral grey, recessed) so the sessions that matter read first.
export const TYPE: Record<SessionDiscipline, { label: string; color: string }> = {
  walk: { label: "Walk", color: "var(--color-discipline-walk)" },
  run: { label: "Run", color: "var(--color-semantic-success)" },
  strength: { label: "Strength", color: "var(--color-semantic-info)" },
  hyrox: { label: "Hyrox", color: "var(--color-data-4)" },
};

export const ORDER: SessionDiscipline[] = ["strength", "run", "hyrox", "walk"];
const DEFAULT_TYPE: SessionDiscipline = "strength";

export const fmtH = (m: number): string => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm ? `${mm}m` : ""}`.trim() : `${mm}m`;
};

export function disciplineOf(s: Session): SessionDiscipline {
  return s.type ?? DEFAULT_TYPE;
}

export function dayMinutes(d: DayAgenda): number {
  return d.sessions.reduce((a, s) => a + (s.durationMin ?? 0), 0);
}

/** Same-name sessions in a day collapse to one row: count + summed minutes. */
export interface SessionGroup {
  name: string;
  type: SessionDiscipline;
  count: number;
  mins: number;
  hasDuration: boolean;
}

export function groupDay(d: DayAgenda): SessionGroup[] {
  const m = new Map<string, SessionGroup>();
  for (const s of d.sessions) {
    let g = m.get(s.name);
    if (!g) {
      g = { name: s.name, type: disciplineOf(s), count: 0, mins: 0, hasDuration: false };
      m.set(s.name, g);
    }
    g.count += 1;
    if (typeof s.durationMin === "number") {
      g.mins += s.durationMin;
      g.hasDuration = true;
    }
  }
  return [...m.values()];
}

export interface WeekBreakdown {
  byType: Partial<Record<SessionDiscipline, { count: number; mins: number }>>;
  totalMins: number;
  totalSessions: number;
  restDays: number;
}

export function weekBreakdown(days: DayAgenda[]): WeekBreakdown {
  const byType: WeekBreakdown["byType"] = {};
  let totalMins = 0;
  let totalSessions = 0;
  let restDays = 0;
  for (const d of days) {
    if (d.isRest || d.sessions.length === 0) restDays += 1;
    for (const s of d.sessions) {
      const t = disciplineOf(s);
      const bucket = (byType[t] ??= { count: 0, mins: 0 });
      bucket.count += 1;
      bucket.mins += s.durationMin ?? 0;
      totalMins += s.durationMin ?? 0;
      totalSessions += 1;
    }
  }
  return { byType, totalMins, totalSessions, restDays };
}
