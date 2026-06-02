/**
 * Pure agenda merge. Combines done workouts (Hevy + Garmin) and planned items
 * (Google Calendar) into the WeeklyAgenda `DayAgenda[]` for the current ISO week.
 *
 * Design + decisions: docs/agenda-integration.md. Key rules:
 *  - Per-day whole-day source switch at 21:00 in USER_TZ:
 *      future day                 -> calendar (PLANNED)
 *      today>=21:00 OR past day   -> Hevy + Garmin (DONE)
 *      today<21:00                -> DONE if anything logged yet, else PLANNED
 *      neither                    -> REST
 *  - De-dup: a Garmin activity whose time interval overlaps a Hevy workout's
 *    interval is the same session -> dropped (Hevy is SOT). Any type — a Hyrox sim
 *    or a run logged in both places is one session. Non-overlapping Garmin
 *    activities (standalone runs/walks) are kept.
 *  - No category badges (tag omitted). Done cards show duration only; planned
 *    cards show the verbatim calendar title, no meta.
 *
 * Everything is computed from the injected `now` + `tz`, so the module is pure
 * and unit-testable with no clock/DB/network.
 */
import type { DayAgenda, DayName, Session } from "./mock-data";
import type { JoinedWorkout } from "@/lib/hevy/workouts-since";
import type { GarminActivity, CalendarItem } from "@/lib/agenda/types";

const DAY_MS = 86_400_000;
const FLIP_HOUR = 21;
const CALENDAR_VERBS = /^(move|perform|race|track)\b/i;
const DAY_NAMES: DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface AgendaResult {
  days: DayAgenda[];
  rangeLabel: string;
}

/** Whitelist gate: a calendar title is a workout iff it starts with a known verb. */
export function matchesCalendarVerb(title: string): boolean {
  return CALENDAR_VERBS.test(title.trim());
}

export interface BuildAgendaInput {
  hevy: JoinedWorkout[];
  garmin: GarminActivity[];
  calendar: CalendarItem[];
  now: Date;
  tz: string;
  /**
   * Which week to render (any instant inside it). Defaults to `now`. The dashboard
   * week slider passes a past anchor; done/planned (the 21:00 flip) stays keyed off
   * the real `now`, so a past week renders entirely as actuals.
   */
  anchor?: Date;
}

// --- timezone-aware date parts (no Date-construction quirks) ---

// Intl.DateTimeFormat construction is costly and buildAgenda formats ~50 items
// per request — cache one formatter per (purpose, tz).
const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let f = dtfCache.get(key);
  if (!f) {
    f = make();
    dtfCache.set(key, f);
  }
  return f;
}

interface LocalParts {
  dateKey: string; // YYYY-MM-DD in tz
  hour: number; // 0-23 in tz
}

function localParts(date: Date, tz: string): LocalParts {
  const fmt = dtf(`parts:${tz}`, () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  );
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // hour can come back as "24" at midnight in some engines — normalise.
  const hour = Number(get("hour")) % 24;
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

function localDateKey(iso: string, tz: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return localParts(new Date(ms), tz).dateKey;
}

function keyToUTC(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  const dt = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Monday=0 … Sunday=6 for a YYYY-MM-DD key. */
function dowMon0(key: string): number {
  return (new Date(keyToUTC(key)).getUTCDay() + 6) % 7;
}

function monthShort(key: string): string {
  return dtf("month", () =>
    new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }),
  ).format(new Date(keyToUTC(key)));
}

// --- card helpers ---

function minutesBetween(startIso: string, endIso?: string): number | null {
  if (!endIso) return null;
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

function durationMeta(minutes: number | null): string | undefined {
  return minutes && minutes > 0 ? `${minutes}m` : undefined;
}

/** Local "HH:MM" for an ISO instant in `tz`. */
function localTimeLabel(iso: string, tz: string): string | undefined {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  return dtf(`time:${tz}`, () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  ).format(new Date(ms));
}

function humanizeType(activityType: string): string {
  return activityType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// --- merge ---

export function buildAgenda({
  hevy,
  garmin,
  calendar,
  now,
  tz,
  anchor,
}: BuildAgendaInput): AgendaResult {
  const { dateKey: todayKey, hour: nowHour } = localParts(now, tz);

  // 7 local day keys, Monday → Sunday, for the week containing `anchor` (now by default).
  const weekKeys = weekKeysFor(anchor ?? now, tz);

  // Bucket each source by local day key.
  const hevyByDay = bucket(hevy, (w) => localDateKey(w.start_time, tz));
  const garminByDay = bucket(garmin, (a) => localDateKey(a.startTime, tz));
  const calByDay = bucket(calendar, (c) => localDateKey(c.start, tz));

  const todayUTC = keyToUTC(todayKey);

  const days: DayAgenda[] = weekKeys.map((key, idx) => {
    const dayUTC = keyToUTC(key);
    const isToday = key === todayKey;
    const isPast = dayUTC < todayUTC;
    const done = () => doneSessions(hevyByDay.get(key) ?? [], garminByDay.get(key) ?? [], tz);
    const planned = () => plannedSessions(calByDay.get(key) ?? [], tz);

    let sessions: Session[];
    if (isPast || (isToday && nowHour >= FLIP_HOUR)) {
      // Past days, and today after the flip → actuals.
      sessions = done();
    } else if (isToday) {
      // Today before the flip → show actuals as soon as any are logged
      // (a morning run shouldn't wait until 21:00); otherwise show the plan.
      const d = done();
      sessions = d.length > 0 ? d : planned();
    } else {
      // Future days → planned.
      sessions = planned();
    }

    return {
      day: DAY_NAMES[idx],
      date: Number(key.slice(8, 10)),
      sessions,
      isToday: isToday || undefined,
      isRest: sessions.length === 0 || undefined,
    };
  });

  return { days, rangeLabel: rangeLabel(weekKeys) };
}

/** The 7 local YYYY-MM-DD keys (Mon→Sun) of the week containing `now` in `tz`. */
function weekKeysFor(now: Date, tz: string): string[] {
  const todayKey = localParts(now, tz).dateKey;
  const mondayUTC = keyToUTC(todayKey) - dowMon0(todayKey) * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => utcToKey(mondayUTC + i * DAY_MS));
}

/** Mon/Sun local date keys — for Garmin's by-date fetch args. */
export function currentWeekDateKeys(now: Date, tz: string): { mondayKey: string; sundayKey: string } {
  const keys = weekKeysFor(now, tz);
  return { mondayKey: keys[0], sundayKey: keys[6] };
}

/**
 * UTC ISO bounds that fully cover the local week (padded ±1 day so any tz offset
 * is included) — for the Postgres reads + calendar replace-window. buildAgenda
 * then buckets precisely, so the padding never leaks extra days into the output.
 */
export function currentWeekUtcRange(now: Date, tz: string): { fromIso: string; toIso: string } {
  const keys = weekKeysFor(now, tz);
  const mondayUTC = keyToUTC(keys[0]);
  return {
    fromIso: new Date(mondayUTC - DAY_MS).toISOString(),
    toIso: new Date(mondayUTC + 8 * DAY_MS).toISOString(),
  };
}

function bucket<T>(items: T[], keyOf: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    if (!k) continue;
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function doneSessions(hevy: JoinedWorkout[], garmin: GarminActivity[], tz: string): Session[] {
  // Hevy time intervals [start, end] (end falls back to start when absent).
  const hevyIntervals = hevy
    .map((w): [number, number] => {
      const s = Date.parse(w.start_time);
      const e = w.end_time ? Date.parse(w.end_time) : s;
      return [s, Number.isFinite(e) && e > s ? e : s];
    })
    .filter(([s]) => Number.isFinite(s));

  // Drop any Garmin activity whose interval overlaps a Hevy workout's — same
  // session, Hevy wins (SOT). Strict overlap so a run starting exactly when a
  // lift ends (back-to-back, not the same session) is kept.
  const keptGarmin = garmin.filter((a) => {
    const gs = Date.parse(a.startTime);
    if (!Number.isFinite(gs)) return true;
    const ge = a.durationS ? gs + a.durationS * 1000 : gs;
    return !hevyIntervals.some(([hs, he]) => gs < he && hs < ge);
  });

  const cards: { start: number; session: Session }[] = [];

  for (const w of hevy) {
    cards.push({
      start: Date.parse(w.start_time),
      session: {
        name: w.title || "Workout",
        source: "hevy",
        time: localTimeLabel(w.start_time, tz),
        meta: durationMeta(minutesBetween(w.start_time, w.end_time)),
        status: "done",
      },
    });
  }

  for (const a of keptGarmin) {
    cards.push({
      start: Date.parse(a.startTime),
      session: {
        name: a.name || humanizeType(a.activityType),
        source: "garmin",
        time: localTimeLabel(a.startTime, tz),
        meta: durationMeta(a.durationS ? Math.round(a.durationS / 60) : null),
        status: "done",
      },
    });
  }

  return cards.sort((x, y) => x.start - y.start).map((c) => c.session);
}

function plannedSessions(calendar: CalendarItem[], tz: string): Session[] {
  return calendar
    .filter((c) => matchesCalendarVerb(c.title))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((c) => ({
      name: c.title.trim(),
      source: "calendar" as const,
      time: localTimeLabel(c.start, tz),
      status: "planned" as const,
    }));
}

function rangeLabel(weekKeys: string[]): string {
  const first = weekKeys[0];
  const last = weekKeys[6];
  const startMonth = monthShort(first);
  const endMonth = monthShort(last);
  const startDay = Number(first.slice(8, 10));
  const endDay = Number(last.slice(8, 10));
  return startMonth === endMonth
    ? `${startMonth} ${startDay} – ${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}
