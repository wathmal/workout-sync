"use server";

import { runAgendaSync, type SyncSummary } from "@/lib/agenda/sync";

/**
 * In-app trigger for the agenda sync, used by the top-nav Refresh button via the
 * agenda provider. Server actions are same-origin + CSRF-protected by Next, so
 * (unlike the cron route) this needs no shared secret — the client never holds one.
 */
export async function syncAgendaAction(): Promise<SyncSummary> {
  return runAgendaSync();
}
