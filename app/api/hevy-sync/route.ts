import { NextRequest, NextResponse } from "next/server";
import { transformToHevyFormat, validateWorkout, getErrorMessage } from "@/lib/hevy-api";
import { Workout } from "@/lib/types";

/**
 * POST /api/hevy-sync
 * Sync workout to Hevy API
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate Hevy API key exists
    const apiKey = process.env.HEVY_API_KEY;
    if (!apiKey) {
      console.error("❌ HEVY_API_KEY not configured");
      return NextResponse.json(
        { error: "Hevy API key not configured. Please add HEVY_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    // 2. Parse request body
    const workout: Workout = await request.json();
    console.log("🔄 Syncing workout to Hevy API");
    console.log("📊 Workout:", {
      id: workout.id,
      date: workout.date,
      exercises: workout.exercises.length,
      duration: workout.duration_minutes,
    });

    // 3. Validate workout data
    const validation = validateWorkout(workout);
    if (!validation.valid) {
      console.error("❌ Workout validation failed:", validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 4. Transform to Hevy format
    const hevyWorkout = transformToHevyFormat(workout);
    console.log("📤 Transformed data:", JSON.stringify(workout, null, 2));

    // 5. Make API request to Hevy
    const response = await fetch("https://api.hevyapp.com/v1/workouts", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({workout:hevyWorkout}),
    });

    // 6. Handle response
    if (!response.ok) {
      // Read body as text first (can only read once)
      const errorText = await response.text();
      let errorData;
      try {
        // Try to parse as JSON
        errorData = JSON.parse(errorText);
      } catch {
        // If not JSON, use raw text
        errorData = { message: errorText };
      }

      console.error("❌ Hevy API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      const errorMessage = getErrorMessage(response.status, errorData);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // 7. Success - parse and return response
    const result = await response.json();
    console.log("✅ Workout synced successfully to Hevy!");
    console.log("📥 Hevy response:", result);

    return NextResponse.json({
      success: true,
      workout: result,
    });
  } catch (error) {
    console.error("❌ Error syncing to Hevy:", error);
    
    // Check for network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        { error: "Network error. Please check your internet connection." },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

