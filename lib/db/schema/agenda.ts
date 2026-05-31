import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Cached agenda sources. The dashboard agenda reads these (plus live Hevy) and
 * merges them server-side — see lib/dashboard/agenda.ts. Sync writes them via
 * /api/agenda/sync (cron + top-nav refresh). The PK on each is the upstream id
 * so re-syncs upsert idempotently. `raw` keeps the untouched upstream payload
 * for debugging / future fields without a migration.
 */

export const garminActivity = pgTable(
  "garmin_activity",
  {
    garminId: text("garmin_id").primaryKey(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    activityType: text("activity_type").notNull(),
    name: text("name"),
    durationS: integer("duration_s"),
    distanceM: integer("distance_m"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("garmin_activity_start_time_idx").on(t.startTime)],
);

export const calendarEvent = pgTable(
  "calendar_event",
  {
    gcalId: text("gcal_id").primaryKey(),
    start: timestamp("start", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("calendar_event_start_idx").on(t.start)],
);

export type GarminActivityRow = typeof garminActivity.$inferSelect;
export type GarminActivityInsert = typeof garminActivity.$inferInsert;
export type CalendarEventRow = typeof calendarEvent.$inferSelect;
export type CalendarEventInsert = typeof calendarEvent.$inferInsert;
