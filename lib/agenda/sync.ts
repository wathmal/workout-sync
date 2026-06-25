import "server-only";
import { fetchGarminWindow } from "./garmin";
import { fetchCalendarWindow } from "./calendar";
import { upsertGarmin, replaceCalendarWindow } from "./queries";
import { runFitnessSync, type FitnessSyncResult } from "@/lib/fitness/sync";
import { currentWeekUtcRange, currentWeekDateKeys } from "@/lib/dashboard/agenda";

export interface SyncSummary {
  garmin: number | null; // activities synced, or null if it failed
  calendar: number | null; // events synced, or null if it failed
  fitness: FitnessSyncResult | null; // daily metric snapshot, or null if it failed
  errors: string[];
  lastRun: string; // ISO
}

/**
 * Pull Garmin + Calendar for the current week into Postgres. The two sources are
 * independent — one failing (e.g. Garmin token expired) must not block the other,
 * so each is caught separately and reported in `errors`. Shared by the cron route
 * (/api/agenda/sync) and the in-app server action.
 */
export async function runAgendaSync(now: Date = new Date()): Promise<SyncSummary> {
  const tz = process.env.USER_TZ ?? "UTC";
  const { fromIso, toIso } = currentWeekUtcRange(now, tz);
  const { mondayKey, sundayKey } = currentWeekDateKeys(now, tz);

  const summary: SyncSummary = {
    garmin: null,
    calendar: null,
    fitness: null,
    errors: [],
    lastRun: now.toISOString(),
  };

  await Promise.all([
    (async () => {
      try {
        const acts = await fetchGarminWindow(mondayKey, sundayKey);
        await upsertGarmin(acts);
        summary.garmin = acts.length;
      } catch (err) {
        summary.errors.push(`garmin: ${(err as Error).message}`);
      }
    })(),
    (async () => {
      try {
        const events = await fetchCalendarWindow(fromIso, toIso);
        await replaceCalendarWindow(events, fromIso, toIso);
        summary.calendar = events.length;
      } catch (err) {
        summary.errors.push(`calendar: ${(err as Error).message}`);
      }
    })(),
    (async () => {
      try {
        const res = await runFitnessSync(now);
        summary.fitness = res;
        summary.errors.push(...res.errors);
      } catch (err) {
        summary.errors.push(`fitness: ${(err as Error).message}`);
      }
    })(),
  ]);

  if (summary.errors.length) {
    console.warn("[agenda-sync] errors:", summary.errors.join("; "));
  }

  return summary;
}
