import "server-only";
import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";
import { matchesCalendarVerb } from "@/lib/dashboard/agenda";
import type { CalendarItem } from "./types";

/**
 * Google Calendar reader. Auth = service account (GOOGLE_SA_KEY) with the target
 * calendar (GCAL_ID) shared read-only to the SA email — no OAuth consent, no
 * refresh token, no expiry. Recurring events are expanded (singleEvents) so each
 * occurrence in the window becomes its own item. Only workout titles
 * (Move/Perform/Race/Track …) are returned; personal events never leave Google.
 */

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SA_KEY;
  if (!raw) throw new Error("GOOGLE_SA_KEY not set");
  const t = raw.trim();
  let json: string;
  if (t.startsWith("{")) {
    json = t;
  } else {
    const decoded = (() => {
      try {
        return Buffer.from(t, "base64").toString("utf8").trim();
      } catch {
        return "";
      }
    })();
    json = decoded.startsWith("{") ? decoded : readFileSync(t, "utf8");
  }
  const key = JSON.parse(json) as ServiceAccount;
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_SA_KEY missing client_email/private_key");
  }
  return key;
}

let cachedClient: JWT | null = null;
function getClient(): JWT {
  if (cachedClient) return cachedClient;
  const key = loadServiceAccount();
  cachedClient = new JWT({ email: key.client_email, key: key.private_key, scopes: [SCOPE] });
  return cachedClient;
}

interface GCalEvent {
  id?: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
}
interface GCalListResponse {
  items?: GCalEvent[];
}

/** Fetch + whitelist-filter calendar workout events in [fromIso, toIso). */
export async function fetchCalendarWindow(fromIso: string, toIso: string): Promise<CalendarItem[]> {
  const calId = process.env.GCAL_ID;
  if (!calId) throw new Error("GCAL_ID not set");

  const params = new URLSearchParams({
    timeMin: fromIso,
    timeMax: toIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calId,
  )}/events?${params.toString()}`;

  const res = await getClient().request<GCalListResponse>({ url });
  const items = res.data.items ?? [];

  const out: CalendarItem[] = [];
  for (const ev of items) {
    if (ev.status === "cancelled" || !ev.id || !ev.summary) continue;
    if (!matchesCalendarVerb(ev.summary)) continue;
    const start = ev.start?.dateTime ?? ev.start?.date; // date = all-day YYYY-MM-DD
    if (!start) continue;
    out.push({ gcalId: ev.id, start, title: ev.summary.trim() });
  }
  return out;
}
