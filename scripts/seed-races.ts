/**
 * Idempotent seed: insert the legacy mock race calendar if race_event is empty.
 *
 * Mirrors the old hardcoded list from lib/dashboard/mock-data.ts. The "road"
 * category was renamed to "running"; distance/division strings from the old
 * `meta` field land in `note`, venues in `location`.
 */

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set. Source .env.local or pass --env-file.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const RACES: {
  name: string;
  date: string;
  category: string;
  location?: string;
  note?: string;
  resultTime?: string;
}[] = [
  { name: "Hyrox Brisbane", date: "2026-04-11", category: "hyrox", note: "mixed doubles", resultTime: "1:25:00" },
  { name: "Bay 2 Bay Run", date: "2026-06-14", category: "running", note: "12 km" },
  { name: "Hyrox Sydney", date: "2026-07-05", category: "hyrox", note: "solo", location: "Sydney" },
  { name: "City 2 Surf", date: "2026-08-09", category: "running", note: "14 km", location: "Sydney" },
  { name: "REVL Team Games", date: "2026-10-24", category: "team", location: "Superordinary, BNE" },
  { name: "Hyrox Melbourne", date: "2026-12-15", category: "hyrox", note: "mixed doubles", location: "Melbourne" },
];

async function main() {
  const { rows: existing } = await pool.query<{ count: string }>(
    "SELECT count(*)::text FROM race_event",
  );
  if (Number(existing[0]?.count ?? 0) > 0) {
    console.log("race_event already seeded, skipping.");
    return;
  }

  for (const r of RACES) {
    await pool.query(
      `INSERT INTO race_event (name, date, category, location, note, result_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [r.name, r.date, r.category, r.location ?? null, r.note ?? null, r.resultTime ?? null],
    );
  }

  console.log(`Seeded ${RACES.length} races.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
