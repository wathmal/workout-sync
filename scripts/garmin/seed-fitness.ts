/**
 * Manual seed/backfill for the fitness-trend table. Runs the same runFitnessSync the
 * nightly cron uses (today's snapshot + one-time RHR backfill). Useful for first-boot
 * seeding and local testing.
 *
 *   NODE_OPTIONS=--conditions=react-server \
 *   GARMIN_PYTHON=/path/to/python-with-garminconnect \
 *   tsx --env-file-if-exists=.env.local scripts/garmin/seed-fitness.ts
 */
import { runFitnessSync } from "../../lib/fitness/sync";

(async () => {
  const res = await runFitnessSync();
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.snapshot || res.rhrBackfilled > 0 ? 0 : 1);
})();
