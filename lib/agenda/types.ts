/**
 * Agenda domain shapes shared by the fetchers (garmin/calendar), the queries
 * layer, and the pure merge (lib/dashboard/agenda.ts). Times are ISO strings so
 * the merge module stays free of `Date`-construction quirks and is unit-testable.
 */

export interface GarminActivity {
  garminId: string;
  startTime: string; // ISO 8601
  activityType: string;
  name: string | null;
  durationS: number | null;
  distanceM: number | null;
}

export interface CalendarItem {
  gcalId: string;
  start: string; // ISO 8601
  title: string;
}
