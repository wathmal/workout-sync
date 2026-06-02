// Runtime migrator for the production image — applies pending Drizzle migrations
// against DATABASE_URL on container start, before server.js launches. Uses
// drizzle-orm's migrator (a runtime dep) + pg, so no drizzle-kit (devDep) is
// needed in the standalone image. Idempotent: drizzle tracks applied migrations
// in drizzle.__drizzle_migrations, so re-runs are no-ops. Forward-only SQL from
// ./drizzle — additive migrations never drop data.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL not set — refusing to start");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("migrate: schema up to date");
} catch (err) {
  console.error("migrate: failed", err);
  process.exit(1);
} finally {
  await pool.end();
}
