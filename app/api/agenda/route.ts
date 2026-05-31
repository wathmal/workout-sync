import { NextResponse } from "next/server";
import { getWorkoutsSince } from "@/lib/hevy/workouts-since";
import { readGarmin, readCalendar } from "@/lib/agenda/queries";
import { buildAgenda, currentWeekUtcRange } from "@/lib/dashboard/agenda";

/**
 * Assembles the week agenda: reads cached Garmin + Calendar from Postgres, fetches
 * the current week's Hevy workouts live, then merges with the pure buildAgenda
 * (which applies the 21:00 USER_TZ day-switch + de-dup). No Garmin/Google calls
 * here — those happen on the sync path. See docs/agenda-integration.md.
 */
export async function GET() {
  try {
    const now = new Date();
    const tz = process.env.USER_TZ ?? "UTC";
    const { fromIso, toIso } = currentWeekUtcRange(now, tz);

    const [hevyRes, garmin, calendar] = await Promise.all([
      getWorkoutsSince(Date.parse(fromIso), true),
      readGarmin(fromIso, toIso),
      readCalendar(fromIso, toIso),
    ]);

    const hevy = hevyRes.ok ? hevyRes.workouts : [];
    return NextResponse.json(buildAgenda({ hevy, garmin, calendar, now, tz }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
