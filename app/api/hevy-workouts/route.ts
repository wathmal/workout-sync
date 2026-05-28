import { NextRequest, NextResponse } from "next/server";
import { getWorkoutsSince } from "@/lib/hevy/workouts-since";

/**
 * GET /api/hevy-workouts?since=<ISO>
 * Returns JoinedWorkout[] (Hevy raw exercises + matched catalog template).
 *
 * Uses the paginated /workouts endpoint via getWorkoutsSince so coverage
 * windows of >10 sessions render correctly. The default window is 14 days
 * ago when `since` is omitted.
 */
export async function GET(request: NextRequest) {
  const sinceParam = request.nextUrl.searchParams.get("since");
  const defaultSince = new Date();
  defaultSince.setDate(defaultSince.getDate() - 14);
  const sinceMs = sinceParam ? Date.parse(sinceParam) : defaultSince.getTime();

  if (!Number.isFinite(sinceMs)) {
    return NextResponse.json(
      { error: "since must be a valid ISO timestamp" },
      { status: 400 },
    );
  }

  const result = await getWorkoutsSince(sinceMs);
  if (!result.ok) {
    const status = result.error === "no-key" ? 500 : 502;
    const message =
      result.error === "no-key"
        ? "Hevy API key not configured"
        : "Failed to fetch workouts from Hevy";
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ workouts: result.workouts });
}
