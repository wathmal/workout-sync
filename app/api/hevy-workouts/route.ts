import { NextRequest, NextResponse } from "next/server";
import { getWorkoutsSince } from "@/lib/hevy/workouts-since";

/**
 * GET /api/hevy-workouts?since=<ISO>
 * Returns JoinedWorkout[] (Hevy raw exercises + matched catalog template).
 *
 * Client-driven endpoint — always fetches fresh from Hevy (no Next data cache)
 * so manual refresh and post-sync refresh see new workouts immediately.
 */
export async function GET(request: NextRequest) {
  const sinceParam = request.nextUrl.searchParams.get("since");
  const defaultSince = new Date();
  defaultSince.setDate(defaultSince.getDate() - 14);
  const sinceMs = sinceParam ? Date.parse(sinceParam) : defaultSince.getTime();

  if (!Number.isFinite(sinceMs)) {
    return NextResponse.json(
      { error: "since must be a valid ISO timestamp", code: "bad-request" },
      { status: 400 },
    );
  }

  const result = await getWorkoutsSince(sinceMs, true);
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

  return NextResponse.json({ workouts: result.workouts });
}
