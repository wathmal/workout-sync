import "server-only";

// Canonical pool + drizzle instance now live in lib/db/client.ts (single DB
// home shared by every domain). Re-exported here for back-compat with existing
// `@/lib/food/db` imports.
export { db, pool } from "@/lib/db/client";
