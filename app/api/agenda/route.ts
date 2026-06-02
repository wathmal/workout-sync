import { NextRequest, NextResponse } from "next/server";
import { getWorkoutsSince } from "@/lib/hevy/workouts-since";
import { readGarmin, readCalendar } from "@/lib/agenda/queries";
import { buildAgenda, currentWeekUtcRange } from "@/lib/dashboard/agenda";

/**
 * Assembles the week agenda: reads cached Garmin + Calendar from Postgres, fetches
 * the current week's Hevy workouts live, then merges with the pure buildAgenda
 * (which applies the 21:00 USER_TZ day-switch + de-dup). No Garmin/Google calls
 * here — those happen on the sync path. See docs/agenda-integration.md.
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const tz = process.env.USER_TZ ?? "UTC";

    // ?week=YYYY-MM-DD selects a past week (dashboard slider). Noon UTC keeps the
    // anchor on the intended civil day regardless of tz offset. now stays real, so
    // the 21:00 done/planned flip is unaffected.
    const weekParam = request.nextUrl.searchParams.get("week");
    const anchorMs = weekParam ? Date.parse(`${weekParam}T12:00:00Z`) : NaN;
    const anchor = Number.isFinite(anchorMs) ? new Date(anchorMs) : now;
    const { fromIso, toIso } = currentWeekUtcRange(anchor, tz);

    const [hevyRes, garmin, calendar] = await Promise.all([
      getWorkoutsSince(Date.parse(fromIso), true),
      readGarmin(fromIso, toIso),
      readCalendar(fromIso, toIso),
    ]);

    const hevy = hevyRes.ok ? hevyRes.workouts : [];
    return NextResponse.json(buildAgenda({ hevy, garmin, calendar, now, tz, anchor }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
