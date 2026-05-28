/**
 * Idempotent seed: insert one open-ended macro_target if the table is empty.
 *
 * Values mirror the legacy mock (kcal/protein/carbs/fat from
 * lib/dashboard/mock-data.ts). Tweak below to fit your current cut/bulk.
 */

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set. Source .env.local or pass --env-file.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const { rows: existing } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM macro_target",
  );
  if (Number(existing[0].count) > 0) {
    console.log("macro_target already seeded, skipping.");
    return;
  }

  // Start from the first day of the current month so future periods can be
  // added with a clean boundary.
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  await pool.query(
    `INSERT INTO macro_target (start_date, end_date, kcal, protein_g, carbs_g, fat_g, note)
     VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
    [startOfMonth, 2855, 180, 320, 95, "seed: starter target"],
  );

  console.log(`Seeded macro_target starting ${startOfMonth}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
