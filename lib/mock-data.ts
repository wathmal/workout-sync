import { Exercise, Workout, WorkoutExercise, ConnectedAccount } from "./types";

// Mock Exercise Templates (Hevy API structure)
export const MOCK_EXERCISES: Exercise[] = [
  {
    id: "b459cba5-cd6d-463c-abd6-54f8eafcadcb",
    title: "Bench Press (Barbell)",
    type: "weight_reps",
    primary_muscle_group: "chest",
    secondary_muscle_groups: ["triceps", "shoulders"],
    is_custom: false,
  },
  {
    id: "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    title: "Push Press",
    type: "weight_reps",
    primary_muscle_group: "shoulders",
    secondary_muscle_groups: ["triceps", "core"],
    is_custom: false,
  },
  {
    id: "c3d4e5f6-a7b8-4c5d-9e8f-7a6b5c4d3e2f",
    title: "Lat Pulldown",
    type: "weight_reps",
    primary_muscle_group: "back",
    secondary_muscle_groups: ["biceps"],
    is_custom: false,
  },
  {
    id: "e5f6a7b8-c9d0-4e5f-a7b8-c9d0e1f2a3b4",
    title: "Squat (Barbell)",
    type: "weight_reps",
    primary_muscle_group: "legs",
    secondary_muscle_groups: ["glutes", "core"],
    is_custom: false,
  },
  {
    id: "f7a8b9c0-d1e2-4f5a-b7c8-d9e0f1a2b3c4",
    title: "Deadlift (Barbell)",
    type: "weight_reps",
    primary_muscle_group: "back",
    secondary_muscle_groups: ["legs", "glutes", "core"],
    is_custom: false,
  },
];

import { convertFileToBase64, validateImageFile } from "./groq-helpers";

// Result type for image processing
export interface ProcessWorkoutImageResult {
  exercises: WorkoutExercise[];
  extractedDate: Date | null;
  workoutStartDate: Date | null;
  workoutStartTime: string | null;
}

// Mock image processing function with fallback
export async function processWorkoutImage(imageFile: File): Promise<ProcessWorkoutImageResult> {
  try {
    // Validate the image file
    const validation = validateImageFile(imageFile);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    console.log("📸 Converting image to base64...");
    // Convert image to base64
    const base64Image = await convertFileToBase64(imageFile);
    
    console.log("🚀 Calling Groq Vision API...");
    // Call the API route
    const response = await fetch("/api/process-workout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64Image,
        mimeType: imageFile.type,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error || "Failed to process image";
      const errorDetails = errorData.details || "";
      
      console.error("❌ API Error:", errorMessage);
      if (errorDetails) {
        console.error("Details:", errorDetails);
      }
      
      // Throw specific error based on status code
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a moment.");
      } else if (response.status === 500 && errorMessage.includes("configuration")) {
        throw new Error("API configuration error. Please add your GROQ_API_KEY.");
      } else if (response.status === 422) {
        throw new Error("Image processing failed. The image may not contain valid workout data.");
      } else {
        throw new Error(errorMessage);
      }
    }

    const data = await response.json();
    
    console.log("✅ Successfully processed image with Groq Vision API");
    console.log("📊 Extracted exercises:", data.exercises);

    if (data.exercises && data.exercises.length > 0) {
      return {
        exercises: data.exercises,
        extractedDate: data.extractedDate ? new Date(data.extractedDate) : null,
        workoutStartDate: data.workoutStartDate ? new Date(data.workoutStartDate) : null,
        workoutStartTime: data.workoutStartTime || null,
      };
    }

    // If no exercises found, throw error to trigger fallback
    throw new Error("No exercises detected in image");
  } catch (error) {
    console.error("⚠️ Error processing image with Groq API:", error);
    console.log("🔄 Falling back to mock data...");
    
    // Re-throw validation errors (don't fall back for these)
    if (error instanceof Error && (
      error.message.includes("Invalid file type") || 
      error.message.includes("size exceeds")
    )) {
      throw error;
    }
    
    // Fallback to mock data for API failures
    return {
      exercises: getMockWorkoutData(),
      extractedDate: null,
      workoutStartDate: null,
      workoutStartTime: null,
    };
  }
}

// Separate mock data function for fallback
function getMockWorkoutData(): WorkoutExercise[] {
  const pushPressExercise = MOCK_EXERCISES.find(e => e.title === "Push Press")!;
  
  return [
    {
      exercise: pushPressExercise,
      sets: [
        { 
          set_number: 1, 
          weight_kg: 15, 
          reps: 6, 
          kg: 15, // Legacy field
          previous_weight_kg: 15, 
          previous_reps: 6, 
          completed: false 
        },
        { 
          set_number: 2, 
          weight_kg: 15, 
          reps: 6, 
          kg: 15, // Legacy field
          previous_weight_kg: 15, 
          previous_reps: 6, 
          completed: false 
        },
        { 
          set_number: 3, 
          weight_kg: 15, 
          reps: 6, 
          kg: 15, // Legacy field
          previous_weight_kg: 15, 
          previous_reps: 6, 
          completed: false 
        },
        { 
          set_number: 4, 
          weight_kg: 15, 
          reps: 6, 
          kg: 15, // Legacy field
          previous_weight_kg: 15, 
          previous_reps: 6, 
          completed: false 
        },
        { 
          set_number: 5, 
          weight_kg: 15, 
          reps: 6, 
          kg: 15, // Legacy field
          previous_weight_kg: 15, 
          previous_reps: 6, 
          completed: false 
        },
      ],
      notes: "",
      rest_timer_enabled: false,
    },
  ];
}

/**
 * Sync workout to Hevy via API route
 * Calls server-side API route which handles Hevy API authentication
 */
export async function syncWorkoutToHevy(workout: Workout): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log("🔄 Syncing workout to Hevy via API...");
    
    const response = await fetch("/api/hevy-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(workout),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Hevy sync failed:", errorData);
      return {
        success: false,
        error: errorData.error || "Failed to sync to Hevy",
      };
    }

    const result = await response.json();
    console.log("✅ Workout synced successfully!", result);
    return { success: true };
  } catch (error) {
    console.error("❌ Network error syncing to Hevy:", error);
    return {
      success: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

// Mock function to sync individual exercise with delay
export async function syncExerciseWithDelay(exerciseId: string, delay: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Mock connected accounts
export const MOCK_CONNECTED_ACCOUNTS: ConnectedAccount[] = [
  {
    id: "hevy-account",
    name: "Hevy",
    type: "hevy",
    status: "active",
    icon_color: "#0066FF",
  },
  {
    id: "strava-account",
    name: "Strava",
    type: "strava",
    status: "inactive",
    icon_color: "#FC4C02",
  },
];

// Helper function to calculate workout metrics
export function calculateWorkoutMetrics(exercises: WorkoutExercise[]): {
  duration_minutes: number;
  total_volume_kg: number;
  total_sets: number;
} {
  let total_volume_kg = 0;
  let total_sets = 0;

  exercises.forEach(exercise => {
    const exerciseType = exercise.exercise.type;
    
    exercise.sets.forEach(set => {
      let isValidSet = false;
      
      switch (exerciseType) {
        case "weight_reps":
          const weight = set.weight_kg ?? set.kg ?? 0;
          const reps = set.reps ?? 0;
          if (weight > 0 && reps > 0) {
            total_volume_kg += weight * reps;
            isValidSet = true;
          }
          break;
        case "reps_only":
          if ((set.reps ?? 0) > 0) {
            isValidSet = true;
          }
          break;
        case "duration":
          if ((set.duration_seconds ?? 0) > 0) {
            isValidSet = true;
          }
          break;
        case "distance_duration":
          if ((set.distance_meters ?? 0) > 0 || (set.duration_seconds ?? 0) > 0) {
            isValidSet = true;
          }
          break;
      }
      
      if (isValidSet) {
        total_sets++;
      }
    });
  });

  // Mock duration (could be calculated from actual workout time)
  const duration_minutes = 72; // 1h 12m as shown in the UI

  return {
    duration_minutes,
    total_volume_kg,
    total_sets,
  };
}

// Format duration for display
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Format volume for display
export function formatVolume(kg: number): string {
  return kg.toLocaleString();
}


