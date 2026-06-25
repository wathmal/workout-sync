import { pgTable, text, integer, real, date, timestamp, jsonb, serial, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Fitness-trend snapshots pulled from Garmin. Garmin's VO2max / race-predictions
 * are "latest-only" (the API returns the most-recent value regardless of the date
 * queried), so history CANNOT be backfilled — we capture one row per local day and
 * build the series ourselves. Written by /api/fitness/sync (folded into the agenda
 * cron). See docs/fitness-trends.md for the confirmed metric scope (FR245M).
 *
 * `raw` keeps the untouched upstream subset for debugging / future fields without a
 * migration, same convention as garmin_activity.
 */
export const dailyFitnessMetric = pgTable(
  "daily_fitness_metric",
  {
    date: date("date").primaryKey(), // YYYY-MM-DD in USER_TZ
    vo2maxRunning: real("vo2max_running"),
    vo2maxComputedDate: date("vo2max_computed_date"), // Garmin's calendarDate — staleness signal
    uthVo2max: real("uth_vo2max"), // RHR-derived proxy (P2), filler when native VO2max is stale
    racePred5kS: integer("race_pred_5k_s"),
    racePred10kS: integer("race_pred_10k_s"),
    racePredHmS: integer("race_pred_hm_s"),
    racePredMS: integer("race_pred_m_s"),
    trainingStatusCode: integer("training_status_code"),
    fitnessTrendCode: integer("fitness_trend_code"),
    weeklyLoad: integer("weekly_load"),
    restingHr: integer("resting_hr"),
    fitnessIndex: real("fitness_index"), // composite (P2)
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("daily_fitness_metric_date_idx").on(t.date)],
);

/**
 * Hyrox station times measured from sim .fit files (data/activities/*_sim.fit) — not
 * daily Garmin. Seeds the predictor's station model. Sled/carry times depend on weight
 * so it is stored. `racePosition` (1-8) lets the predictor grade fatigue by where the
 * station falls in the race. Used in P3.
 */
export const hyroxStationBenchmark = pgTable("hyrox_station_benchmark", {
  id: serial("id").primaryKey(),
  station: text("station").notNull(), // ski|sled_push|sled_pull|bbj|row|farmers|lunge|wallball
  timeS: integer("time_s").notNull(),
  weightKg: integer("weight_kg"),
  distanceM: integer("distance_m"),
  racePosition: integer("race_position"),
  sourceFit: text("source_fit"),
  measuredAt: timestamp("measured_at", { withTimezone: true }),
  notes: text("notes"),
});

/**
 * Hyrox projection snapshots. Stored per-day so the PREDICTION itself becomes a trend
 * line (drops as the run engine — race predictions — improves). Used in P3.
 */
export const hyroxProjection = pgTable("hyrox_projection", {
  date: date("date").primaryKey(),
  division: text("division").notNull(), // open | pro
  predictedTotalS: integer("predicted_total_s").notNull(),
  rangeLowS: integer("range_low_s"),
  rangeHighS: integer("range_high_s"),
  runPaceSPerKm: integer("run_pace_s_per_km"),
  segments: jsonb("segments"),
  basis: jsonb("basis"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type DailyFitnessMetricRow = typeof dailyFitnessMetric.$inferSelect;
export type DailyFitnessMetricInsert = typeof dailyFitnessMetric.$inferInsert;
export type HyroxStationBenchmarkRow = typeof hyroxStationBenchmark.$inferSelect;
export type HyroxProjectionRow = typeof hyroxProjection.$inferSelect;
