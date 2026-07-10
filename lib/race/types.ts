/**
 * Race calendar domain types + pure derivation helpers. No server-only deps —
 * imported by both the API/queries layer and client components.
 *
 * `category` is free text in the DB; the known values live in this client-side
 * enum so the dropdown + colour map stay in sync without a migration.
 */

export const RACE_CATEGORIES = ["hyrox", "running", "team"] as const;
export type RaceCategory = (typeof RACE_CATEGORIES)[number];

export const RACE_CATEGORY_LABELS: Record<RaceCategory, string> = {
  hyrox: "Hyrox",
  running: "Running",
  team: "Team games",
};

const RACE_CATEGORY_COLORS: Record<RaceCategory, string> = {
  hyrox: "var(--color-data-4)",
  running: "var(--color-semantic-error)",
  team: "var(--color-data-5)",
};

export function isRaceCategory(v: string): v is RaceCategory {
  return (RACE_CATEGORIES as readonly string[]).includes(v);
}

/** Display label for a (possibly unknown) category. */
export function categoryLabel(category: string): string {
  return RACE_CATEGORY_LABELS[category as RaceCategory] ?? category;
}

/** Brand/data colour for a category; muted fallback for unknown values. */
export function categoryColor(category: string): string {
  return RACE_CATEGORY_COLORS[category as RaceCategory] ?? "var(--color-text-muted)";
}

/** A race row mapped to the client. Dates are ISO strings. */
export interface RaceEvent {
  id: string;
  name: string;
  date: string; // ISO YYYY-MM-DD (whole day)
  category: string; // free text, usually a RaceCategory
  eventTarget: string | null;
  location: string | null;
  note: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  resultNote: string | null;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Create payload. */
export interface RaceEventInput {
  name: string;
  date: string;
  category: string;
  eventTarget?: string | null;
  location?: string | null;
  note?: string | null;
  resultTime?: string | null;
  resultPlacement?: string | null;
  resultNote?: string | null;
}

/** Partial edit / result-update payload. */
export type RaceEventPatch = Partial<RaceEventInput>;

export type RaceStatus = "past" | "next" | "upcoming";

/** A race plus the values we compute at render time (never stored). */
export interface RaceView extends RaceEvent {
  status: RaceStatus;
  completed: boolean;
  daysUntil: number; // whole days from today; negative = in the past
  dateLabel: string; // e.g. "Jun 14"
}

function parseDateOnly(iso: string): Date {
  // Treat the YYYY-MM-DD as a local civil date so day math has no TZ drift.
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

function formatDateLabel(iso: string): string {
  return parseDateOnly(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isCompleted(r: RaceEvent): boolean {
  return r.resultTime != null && r.resultTime.trim() !== "";
}

/**
 * Sort by date (then created order) and tag each race with derived status.
 *   past     = date is before today, OR a result has been entered
 *   next     = the earliest race that is not past
 *   upcoming = every other not-past race
 */
export function deriveRaceViews(races: RaceEvent[], todayIso: string): RaceView[] {
  const today = parseDateOnly(todayIso).getTime();
  const sorted = [...races].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );

  let nextId: string | null = null;
  for (const r of sorted) {
    const past = parseDateOnly(r.date).getTime() < today || isCompleted(r);
    if (!past) {
      nextId = r.id;
      break;
    }
  }

  return sorted.map((r) => {
    const completed = isCompleted(r);
    const daysUntil = Math.round((parseDateOnly(r.date).getTime() - today) / 86400000);
    const past = daysUntil < 0 || completed;
    const status: RaceStatus = past ? "past" : r.id === nextId ? "next" : "upcoming";
    return { ...r, completed, daysUntil, status, dateLabel: formatDateLabel(r.date) };
  });
}

export function nextRaceView(views: RaceView[]): RaceView | null {
  return views.find((v) => v.status === "next") ?? null;
}

/**
 * Parse a duration in minutes out of free text (eventTarget / resultTime):
 * "2:02:11" → 122, "1:50" → 110 (H:MM), "45:00" → 45 (MM:SS — two-part with
 * an implausible hour count, >12, reads as minutes), "sub 2h" → 120,
 * "90 min" → 90. Null when nothing parseable.
 */
export function parseDurationMin(text: string | null | undefined): number | null {
  if (!text) return null;
  const colon = text.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (colon) {
    const a = Number(colon[1]);
    const b = Number(colon[2]);
    if (colon[3] != null) return Math.round(a * 60 + b + Number(colon[3]) / 60); // H:MM:SS
    return a <= 12 ? a * 60 + b : Math.round(a + b / 60); // H:MM vs MM:SS
  }
  const h = text.match(/(\d+(?:\.\d+)?)\s*h/i);
  if (h) return Math.round(Number(h[1]) * 60);
  const m = text.match(/(\d+)\s*m/i);
  if (m) return Number(m[1]);
  return null;
}

/**
 * The athlete's most recent completed result duration in a category — the
 * expected-duration fallback when the upcoming race has no parseable target.
 */
export function lastResultDurationMin(races: RaceEvent[], category: string): number | null {
  const done = races
    .filter((r) => r.category === category && r.resultTime?.trim())
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const r of done) {
    const min = parseDurationMin(r.resultTime);
    if (min != null) return min;
  }
  return null;
}
