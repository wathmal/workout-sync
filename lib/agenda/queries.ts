import "server-only";
import { and, asc, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  garminActivity,
  calendarEvent,
  type GarminActivityRow,
  type CalendarEventRow,
} from "@/lib/db/schema/agenda";
import type { GarminActivity, CalendarItem } from "./types";

function toGarmin(r: GarminActivityRow): GarminActivity {
  return {
    garminId: r.garminId,
    startTime: r.startTime.toISOString(),
    activityType: r.activityType,
    name: r.name,
    durationS: r.durationS,
    distanceM: r.distanceM,
  };
}

function toCalendar(r: CalendarEventRow): CalendarItem {
  return {
    gcalId: r.gcalId,
    start: r.start.toISOString(),
    title: r.title,
  };
}

/** Idempotent upsert keyed on garmin_id — re-syncs never duplicate. */
export async function upsertGarmin(activities: GarminActivity[]): Promise<void> {
  if (activities.length === 0) return;
  await db
    .insert(garminActivity)
    .values(
      activities.map((a) => ({
        garminId: a.garminId,
        startTime: new Date(a.startTime),
        activityType: a.activityType,
        name: a.name,
        durationS: a.durationS,
        distanceM: a.distanceM,
        raw: a as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })),
    )
    .onConflictDoUpdate({
      target: garminActivity.garminId,
      set: {
        startTime: sqlExcluded("start_time"),
        activityType: sqlExcluded("activity_type"),
        name: sqlExcluded("name"),
        durationS: sqlExcluded("duration_s"),
        distanceM: sqlExcluded("distance_m"),
        raw: sqlExcluded("raw"),
        updatedAt: new Date(),
      },
    });
}

/**
 * Calendar events move and get deleted upstream, so we replace the whole window
 * rather than upsert: delete everything in [from, to) then insert fresh. Keeps
 * deletions honest. Wrapped in a transaction so a read never sees an empty gap.
 */
export async function replaceCalendarWindow(
  events: CalendarItem[],
  fromIso: string,
  toIso: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(calendarEvent)
      .where(
        and(
          gte(calendarEvent.start, new Date(fromIso)),
          lt(calendarEvent.start, new Date(toIso)),
        ),
      );
    if (events.length > 0) {
      await tx.insert(calendarEvent).values(
        events.map((e) => ({
          gcalId: e.gcalId,
          start: new Date(e.start),
          title: e.title,
          raw: e as unknown as Record<string, unknown>,
        })),
      );
    }
  });
}

export async function readGarmin(fromIso: string, toIso: string): Promise<GarminActivity[]> {
  const rows = await db
    .select()
    .from(garminActivity)
    .where(
      and(
        gte(garminActivity.startTime, new Date(fromIso)),
        lt(garminActivity.startTime, new Date(toIso)),
      ),
    )
    .orderBy(asc(garminActivity.startTime));
  return rows.map(toGarmin);
}

export async function readCalendar(fromIso: string, toIso: string): Promise<CalendarItem[]> {
  const rows = await db
    .select()
    .from(calendarEvent)
    .where(
      and(
        gte(calendarEvent.start, new Date(fromIso)),
        lt(calendarEvent.start, new Date(toIso)),
      ),
    )
    .orderBy(asc(calendarEvent.start));
  return rows.map(toCalendar);
}

// drizzle's `excluded` (the conflicting row's proposed values) via raw SQL.
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
