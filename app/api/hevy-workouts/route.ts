import { NextRequest, NextResponse } from "next/server";
import { getWorkoutsCached, getWorkoutsSince } from "@/lib/hevy/workouts-since";

/**
 * GET /api/hevy-workouts?since=<ISO>&until=<ISO>
 * Returns JoinedWorkout[] (Hevy raw exercises + matched catalog template).
 *
 * `until` (optional) bounds the upper edge — the dashboard week slider needs a
 * closed [since, until) window so muscle coverage for a past week excludes later
 * workouts. getWorkoutsSince is since-only, so the upper bound is filtered here.
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

  const untilParam = request.nextUrl.searchParams.get("until");
  const untilMs = untilParam ? Date.parse(untilParam) : null;
  if (untilParam && !Number.isFinite(untilMs)) {
    return NextResponse.json(
      { error: "until must be a valid ISO timestamp", code: "bad-request" },
      { status: 400 },
    );
  }

  // Longer windows (e.g. the 75-day suggester history) need more pages than the
  // default 5*10=50-workout cap. Clamp to a sane ceiling.
  const maxPagesParam = Number(request.nextUrl.searchParams.get("maxPages"));
  const maxPages = Number.isFinite(maxPagesParam)
    ? Math.min(20, Math.max(1, Math.trunc(maxPagesParam)))
    : undefined;

  // Opt-in 6h TTL cache for large historical windows (the suggester). Week
  // coverage / by-date / agenda omit `cache` and stay fresh. `refresh=1` forces
  // a cold pull (the /suggest Refresh button).
  const useCache = request.nextUrl.searchParams.get("cache") === "1";
  const force = request.nextUrl.searchParams.get("refresh") === "1";
  const result = useCache
    ? await getWorkoutsCached(sinceMs, maxPages ?? 12, { force })
    : await getWorkoutsSince(sinceMs, true, maxPages);
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

  const workouts =
    untilMs != null
      ? result.workouts.filter((w) => Date.parse(w.start_time) < untilMs)
      : result.workouts;

  return NextResponse.json({ workouts });
}
