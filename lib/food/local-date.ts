/**
 * Client-safe local-date helpers for the food log day navigator.
 * All work on `YYYY-MM-DD` strings interpreted in the browser's local zone,
 * which the app treats as the user's zone (same assumption as isoLocalNow).
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as YYYY-MM-DD in local time. */
export function todayLocalStr(): string {
  return fmt(new Date());
}

/** Shift a YYYY-MM-DD string by n days (calendar-safe via Date math). */
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

/** True when dateStr is strictly before today (local). */
export function isPastStr(dateStr: string): boolean {
  return dateStr < todayLocalStr();
}

/** Default log timestamp for a day: now when it's today, noon otherwise. */
export function defaultLoggedAtDate(dateStr: string): Date {
  return dateStr === todayLocalStr() ? new Date() : new Date(`${dateStr}T12:00:00`);
}

/** Human label: "Today" / "Yesterday" / "Mon, May 27". */
export function formatDayLabel(dateStr: string): string {
  const today = todayLocalStr();
  if (dateStr === today) return "Today";
  if (dateStr === addDaysStr(today, -1)) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
