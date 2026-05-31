import { pgTable, uuid, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Race calendar. One row per event. `category` is stored as plain text — the
 * known values live in a client-side enum (lib/race/types.ts) so adding a
 * category never needs a migration. Status (past/next/upcoming), days-until
 * and the timeline lane are all derived at read time, never stored.
 */
export const raceEvent = pgTable(
  "race_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    date: date("date").notNull(),
    category: text("category").notNull(),
    eventTarget: text("event_target"),
    location: text("location"),
    note: text("note"),
    resultTime: text("result_time"),
    resultPlacement: text("result_placement"),
    resultNote: text("result_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("race_event_date_idx").on(t.date)],
);

export type RaceEventRow = typeof raceEvent.$inferSelect;
export type RaceEventInsert = typeof raceEvent.$inferInsert;
