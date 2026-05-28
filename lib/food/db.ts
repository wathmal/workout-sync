import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL not set. Copy .env.example → .env.local and `docker compose up -d db`.",
  );
}

const globalForPg = globalThis as unknown as { __workoutPool?: Pool };

const pool =
  globalForPg.__workoutPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__workoutPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
