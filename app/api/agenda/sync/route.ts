import { NextRequest, NextResponse } from "next/server";
import { runAgendaSync } from "@/lib/agenda/sync";

/**
 * Cron entry point for the agenda sync (TrueNAS `curl -X POST` on a schedule).
 * Protected by a shared secret: when AGENDA_SYNC_SECRET is set, the `x-sync-secret`
 * header must match. The in-app Refresh button does NOT use this route — it calls
 * the same-origin server action (app/_actions/agenda.ts) instead, so it never needs
 * the secret. Production deploys exposed to the internet MUST set the secret.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AGENDA_SYNC_SECRET;
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runAgendaSync();
  const totalFailed = summary.garmin === null && summary.calendar === null;
  return NextResponse.json(summary, { status: totalFailed && summary.errors.length ? 502 : 200 });
}
