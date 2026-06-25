import "server-only";
import { fetchFitnessSnapshot, fetchRhrBackfill } from "./garmin";
import { upsertFitnessSnapshot, upsertRhrPoints, countFitnessRows } from "./queries";

export interface FitnessSyncResult {
  snapshot: boolean; // today's snapshot stored
  rhrBackfilled: number; // RHR points seeded (only on a sparse table)
  errors: string[];
}

const BACKFILL_DAYS = 30;
// Seed RHR history only while the table is still sparse (first runs). Once we have a
// few weeks of real snapshots the backfill is redundant, so stop hitting get_stats 30×.
const BACKFILL_WHEN_ROWS_BELOW = 14;

/** Today's local date (USER_TZ) as YYYY-MM-DD. en-CA formats as ISO date. */
function todayYmd(now: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Pull today's Garmin fitness snapshot into Postgres, and on the first runs also
 * backfill resting-HR history so the chart isn't empty. Snapshot + backfill are caught
 * independently — a stale token failing the snapshot must not swallow the backfill.
 * Invoked from the shared agenda cron (lib/agenda/sync.ts).
 */
export async function runFitnessSync(now: Date = new Date()): Promise<FitnessSyncResult> {
  const tz = process.env.USER_TZ ?? "UTC";
  const today = todayYmd(now, tz);
  const result: FitnessSyncResult = { snapshot: false, rhrBackfilled: 0, errors: [] };

  try {
    const snap = await fetchFitnessSnapshot(today);
    await upsertFitnessSnapshot(snap);
    result.snapshot = true;
  } catch (err) {
    result.errors.push(`fitness snapshot: ${(err as Error).message}`);
  }

  try {
    if ((await countFitnessRows()) < BACKFILL_WHEN_ROWS_BELOW) {
      const points = await fetchRhrBackfill(BACKFILL_DAYS, today);
      await upsertRhrPoints(points);
      result.rhrBackfilled = points.length;
    }
  } catch (err) {
    result.errors.push(`rhr backfill: ${(err as Error).message}`);
  }

  if (result.errors.length) {
    console.warn("[fitness-sync] errors:", result.errors.join("; "));
  }
  return result;
}
