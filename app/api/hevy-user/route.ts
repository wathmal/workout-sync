import { NextResponse } from "next/server";

/**
 * GET /api/hevy-user
 *
 * Proxies Hevy's GET /v1/user/info so the sidebar can show the connected
 * account name without leaking HEVY_API_KEY to the client.
 *
 * Hevy responds with { data: { id, name, url } }. We re-emit those fields
 * directly. Returns 503 if the key is missing or Hevy is unreachable.
 */
export async function GET() {
  if (!process.env.HEVY_API_KEY) {
    return NextResponse.json(
      { connected: false, error: "HEVY_API_KEY not configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch("https://api.hevyapp.com/v1/user/info", {
      headers: { "api-key": process.env.HEVY_API_KEY },
      // Avoid Next caching the user info beyond a short window.
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { connected: false, error: `Hevy returned ${res.status}` },
        { status: res.status === 401 ? 401 : 502 },
      );
    }

    const json = (await res.json()) as { data?: { id: string; name: string; url: string } };
    if (!json.data) {
      return NextResponse.json(
        { connected: false, error: "Unexpected Hevy response shape" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      connected: true,
      id: json.data.id,
      name: json.data.name,
      url: json.data.url,
    });
  } catch (err) {
    console.error("[hevy-user] fetch failed:", err);
    return NextResponse.json(
      { connected: false, error: "Network error reaching Hevy" },
      { status: 503 },
    );
  }
}
