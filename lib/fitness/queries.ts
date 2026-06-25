import "server-only";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyFitnessMetric, type DailyFitnessMetricRow } from "@/lib/db/schema/fitness";
import type { FitnessSnapshot, RhrPoint, FitnessPoint } from "./types";

// drizzle's `excluded` (the conflicting row's proposed values) via raw SQL.
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

/** date columns come back as 'YYYY-MM-DD' strings; coerce defensively just in case. */
function ymd(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function toPoint(r: DailyFitnessMetricRow): FitnessPoint {
  return {
    date: ymd(r.date),
    vo2maxRunning: r.vo2maxRunning,
    vo2maxComputedDate: r.vo2maxComputedDate ? ymd(r.vo2maxComputedDate) : null,
    racePred5kS: r.racePred5kS,
    racePred10kS: r.racePred10kS,
    racePredHmS: r.racePredHmS,
    racePredMS: r.racePredMS,
    restingHr: r.restingHr,
    trainingStatusCode: r.trainingStatusCode,
    weeklyLoad: r.weeklyLoad,
  };
}

/** Upsert a full snapshot keyed on date — re-syncs the same day overwrite, never dupe. */
export async function upsertFitnessSnapshot(snap: FitnessSnapshot): Promise<void> {
  await db
    .insert(dailyFitnessMetric)
    .values({
      date: snap.date,
      vo2maxRunning: snap.vo2maxRunning,
      vo2maxComputedDate: snap.vo2maxComputedDate,
      racePred5kS: snap.racePred5kS,
      racePred10kS: snap.racePred10kS,
      racePredHmS: snap.racePredHmS,
      racePredMS: snap.racePredMS,
      trainingStatusCode: snap.trainingStatusCode,
      fitnessTrendCode: snap.fitnessTrendCode,
      weeklyLoad: snap.weeklyLoad,
      restingHr: snap.restingHr,
      raw: (snap.raw ?? null) as Record<string, unknown> | null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dailyFitnessMetric.date,
      set: {
        vo2maxRunning: sqlExcluded("vo2max_running"),
        vo2maxComputedDate: sqlExcluded("vo2max_computed_date"),
        racePred5kS: sqlExcluded("race_pred_5k_s"),
        racePred10kS: sqlExcluded("race_pred_10k_s"),
        racePredHmS: sqlExcluded("race_pred_hm_s"),
        racePredMS: sqlExcluded("race_pred_m_s"),
        trainingStatusCode: sqlExcluded("training_status_code"),
        fitnessTrendCode: sqlExcluded("fitness_trend_code"),
        weeklyLoad: sqlExcluded("weekly_load"),
        restingHr: sqlExcluded("resting_hr"),
        raw: sqlExcluded("raw"),
        updatedAt: new Date(),
      },
    });
}

/**
 * Backfill resting-HR points. Sets ONLY resting_hr on conflict so it never clobbers a
 * day's VO2max / race-pred snapshot (RHR is the one metric Garmin serves historically).
 */
export async function upsertRhrPoints(points: RhrPoint[]): Promise<void> {
  const rows = points.filter((p) => p.restingHr != null);
  if (rows.length === 0) return;
  await db
    .insert(dailyFitnessMetric)
    .values(rows.map((p) => ({ date: p.date, restingHr: p.restingHr, updatedAt: new Date() })))
    .onConflictDoUpdate({
      target: dailyFitnessMetric.date,
      set: { restingHr: sqlExcluded("resting_hr"), updatedAt: new Date() },
    });
}

/** Last `days` days of metrics, oldest-first (chart order). */
export async function readFitnessSeries(days = 30): Promise<FitnessPoint[]> {
  const rows = await db
    .select()
    .from(dailyFitnessMetric)
    .orderBy(desc(dailyFitnessMetric.date))
    .limit(days);
  return rows.reverse().map(toPoint);
}

export async function countFitnessRows(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(dailyFitnessMetric);
  return row?.n ?? 0;
}
