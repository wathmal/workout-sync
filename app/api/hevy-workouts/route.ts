import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/hevy-workouts
 * Fetch workout events from Hevy API
 * Query params:
 *   - since: ISO 8601 timestamp (optional, defaults to 7 days ago)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Validate Hevy API key exists
    const apiKey = process.env.HEVY_API_KEY;
    if (!apiKey) {
      console.error("❌ HEVY_API_KEY not configured");
      return NextResponse.json(
        { error: "Hevy API key not configured" },
        { status: 500 }
      );
    }

    // 2. Get 'since' parameter from query string
    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get("since");
    
    // Default to 14 days ago if not provided
    const defaultSince = new Date();
    defaultSince.setDate(defaultSince.getDate() - 14);
    const sinceParam = since || defaultSince.toISOString();

    console.log("🔍 Fetching workout events from Hevy API");
    console.log("📅 Since:", sinceParam);

    // 3. Build Hevy API URL with query parameters
    const hevyUrl = new URL("https://api.hevyapp.com/v1/workouts/events");
    hevyUrl.searchParams.set("since", sinceParam);
    hevyUrl.searchParams.set("pageSize", "10"); // Max allowed

    // 4. Make API request to Hevy
    const response = await fetch(hevyUrl.toString(), {
      method: "GET",
      headers: {
        "api-key": apiKey,
      },
    });

    // 5. Handle response
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error("❌ Hevy API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      return NextResponse.json(
        { error: "Failed to fetch workouts from Hevy" },
        { status: response.status }
      );
    }

    // 6. Success - parse and return response
    const result = await response.json();
    console.log("✅ Workout events fetched successfully");
    console.log("📊 Events count:", result.events?.length || 0);

    return NextResponse.json({
      success: true,
      events: result.events || [],
      page: result.page || 1,
      page_count: result.page_count || 1,
    });
  } catch (error) {
    console.error("❌ Error fetching workouts from Hevy:", error);
    
    // Check for network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        { error: "Network error. Please check your connection." },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

