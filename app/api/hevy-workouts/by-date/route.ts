import { NextRequest, NextResponse } from "next/server";
import { getWorkoutsSince } from "@/lib/hevy/workouts-since";

/**
 * GET /api/hevy-workouts/by-date?date=YYYY-MM-DD
 * Returns JoinedWorkout[] whose start_time falls on the given calendar day
 * (local time of the server). Unlike the week-windowed /api/hevy-workouts,
 * this is used for duplicate-detection on arbitrary backfill dates.
 */
export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const [y, m, d] = dateParam.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  const result = await getWorkoutsSince(start.getTime(), true);
  if (!result.ok) {
    if (result.error === "no-key") {
      return NextResponse.json(
        { error: "Hevy API key not configured", code: "no-key" },
        { status: 500 },
      );
    }
    const upstream = result.status;
    const status = upstream && upstream >= 400 && upstream < 600 ? upstream : 502;
    return NextResponse.json(
      {
        error: "Failed to fetch workouts from Hevy",
        code: "fetch-fail",
        upstreamStatus: upstream,
      },
      { status },
    );
  }

  const endMs = end.getTime();
  const workouts = result.workouts.filter((w) => {
    const t = Date.parse(w.start_time);
    return Number.isFinite(t) && t < endMs;
  });

  return NextResponse.json({ workouts });
}
