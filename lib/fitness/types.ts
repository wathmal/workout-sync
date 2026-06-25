/** Shapes for the fitness-trend pipeline. Mirrors lib/agenda/types.ts. */

/** One snapshot emitted by `fetch.py --metrics` (camelCase, matches the Python). */
export interface FitnessSnapshot {
  date: string; // YYYY-MM-DD
  vo2maxRunning: number | null;
  vo2maxComputedDate: string | null;
  racePred5kS: number | null;
  racePred10kS: number | null;
  racePredHmS: number | null;
  racePredMS: number | null;
  trainingStatusCode: number | null;
  fitnessTrendCode: number | null;
  weeklyLoad: number | null;
  restingHr: number | null;
  raw?: unknown;
}

/** One resting-HR point from `fetch.py --backfill-rhr`. */
export interface RhrPoint {
  date: string;
  restingHr: number | null;
}

/** One day of the series the dashboard card reads. */
export interface FitnessPoint {
  date: string;
  vo2maxRunning: number | null;
  vo2maxComputedDate: string | null;
  racePred5kS: number | null;
  racePred10kS: number | null;
  racePredHmS: number | null;
  racePredMS: number | null;
  restingHr: number | null;
  trainingStatusCode: number | null;
  weeklyLoad: number | null;
}
