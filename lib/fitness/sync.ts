import "server-only";
import { fetchFitnessSnapshot, fetchRhrBackfill, fetchActivityLoad } from "./garmin";
import {
  upsertFitnessSnapshot,
  upsertRhrPoints,
  upsertDailyLoad,
  countFitnessRows,
  countDaysWithLoad,
} from "./queries";
import { hrTss } from "./trimp";

export interface FitnessSyncResult {
  snapshot: boolean; // today's snapshot stored
  rhrBackfilled: number; // RHR points seeded (only on a sparse table)
  loadDays: number; // days of training load upserted
  errors: string[];
}

const RHR_BACKFILL_DAYS = 30;
const RHR_BACKFILL_WHEN_ROWS_BELOW = 14;
// CTL is a 42-day EWMA, so it needs a long lead-in to settle. Seed the load history
// 120 days deep on first runs, then top up a short trailing window each night (also
// fills any missed-sync gaps so the EWMA spine stays continuous).
const LOAD_BACKFILL_DAYS = 120;
const LOAD_DAILY_DAYS = 7;
const LOAD_BACKFILL_WHEN_DAYS_BELOW = 60;

function ymdInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function shiftDays(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Pull today's Garmin fitness snapshot + training-load history into Postgres. On the
 * first runs it backfills resting-HR (for the sparklines) and a deep window of daily
 * training load (so the CTL curve is settled, not ramping from zero). Each source is
 * caught independently. Invoked from the shared agenda cron (lib/agenda/sync.ts).
 */
export async function runFitnessSync(now: Date = new Date()): Promise<FitnessSyncResult> {
  const tz = process.env.USER_TZ ?? "UTC";
  const today = ymdInTz(now, tz);
  const result: FitnessSyncResult = { snapshot: false, rhrBackfilled: 0, loadDays: 0, errors: [] };

  try {
    const snap = await fetchFitnessSnapshot(today);
    await upsertFitnessSnapshot(snap);
    result.snapshot = true;
  } catch (err) {
    result.errors.push(`fitness snapshot: ${(err as Error).message}`);
  }

  try {
    if ((await countFitnessRows()) < RHR_BACKFILL_WHEN_ROWS_BELOW) {
      const points = await fetchRhrBackfill(RHR_BACKFILL_DAYS, today);
      await upsertRhrPoints(points);
      result.rhrBackfilled = points.length;
    }
  } catch (err) {
    result.errors.push(`rhr backfill: ${(err as Error).message}`);
  }

  try {
    const deep = (await countDaysWithLoad()) < LOAD_BACKFILL_WHEN_DAYS_BELOW;
    const fromYmd = shiftDays(today, -(deep ? LOAD_BACKFILL_DAYS : LOAD_DAILY_DAYS));
    const activities = await fetchActivityLoad(fromYmd, today);

    // Sum each day's activities' hrTSS, bucketed by the activity's local (USER_TZ) day.
    const loadByDate = new Map<string, number>();
    for (const a of activities) {
      if (a.durationS == null) continue;
      const day = ymdInTz(new Date(a.startTime), tz);
      loadByDate.set(day, (loadByDate.get(day) ?? 0) + hrTss(a.durationS, a.avgHr));
    }
    await upsertDailyLoad(loadByDate, fromYmd, today);
    result.loadDays = activities.length;
  } catch (err) {
    result.errors.push(`training load: ${(err as Error).message}`);
  }

  if (result.errors.length) {
    console.warn("[fitness-sync] errors:", result.errors.join("; "));
  }
  return result;
}
