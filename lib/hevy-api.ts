/**
 * Hevy API Integration
 * Handles transformation of workout data to Hevy's API format
 */

import { Workout, HevyWorkoutEvent } from "./types";
import { format } from "date-fns";

/**
 * Hevy API Workout Request Format
 */
export interface HevyWorkoutRequest {
  title?: string;
  description?: string;
  start_time: string;
  end_time?: string;
  is_private: boolean;
  exercises: HevyExercise[];
}

export interface HevyExercise {
  exercise_template_id: string;
  superset_id?: number | null;
  notes?: string;
  sets: HevySet[];
}

export interface HevySet {
  type: "normal" | "warmup" | "dropset" | "failure";
  weight_kg?: number;
  reps?: number;
  distance_meters?: number;
  duration_seconds?: number;
}

/**
 * Transform our workout format to Hevy's expected format
 */
export function transformToHevyFormat(workout: Workout): HevyWorkoutRequest {
  // Convert date to Date object if it's a string (from JSON parsing)
  const workoutDate = typeof workout.date === 'string' 
    ? new Date(workout.date) 
    : workout.date;
  
  // Convert date to ISO 8601 string
  const startTime = workoutDate.toISOString();
  
  // Calculate end time from start time + duration
  const endTime = new Date(
    workoutDate.getTime() + workout.duration_minutes * 60000
  ).toISOString();

  // Generate title with date
  const fallbackTitle = `Workout - ${format(workoutDate, "MMM dd, yyyy")}`;

  return {
    title: workout.caption || fallbackTitle,
    description: undefined,
    start_time: startTime,
    end_time: endTime,
    is_private: false,
    exercises: workout.exercises.map((workoutExercise) => ({
      exercise_template_id: workoutExercise.exercise.id,
      superset_id: null,
      notes: workoutExercise.notes || undefined,
      sets: workoutExercise.sets
        .filter(set => set.kg > 0 || set.reps > 0) // Only include sets with data
        .map((set) => ({
          type: "normal" as const,
          weight_kg: set.kg > 0 ? set.kg : undefined,
          reps: set.reps > 0 ? set.reps : undefined,
        })),
    })),
  };
}

/**
 * Get user-friendly error message based on status code
 */
export function getErrorMessage(status: number, errorData?: { message?: string }): string {
  switch (status) {
    case 401:
      return "Invalid Hevy API key. Please contact support.";
    case 400:
      return `Invalid workout data: ${errorData?.message || "Please try again"}`;
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
    case 502:
    case 503:
      return "Hevy service is temporarily unavailable. Please try again later.";
    default:
      return "Failed to sync to Hevy. Please try again.";
  }
}

/**
 * Validate workout has required data for Hevy sync
 */
export function validateWorkout(workout: Workout): { valid: boolean; error?: string } {
  if (!workout.date) {
    return { valid: false, error: "Workout date is required" };
  }

  // Validate date is valid
  const workoutDate = typeof workout.date === 'string' 
    ? new Date(workout.date) 
    : workout.date;
  
  if (isNaN(workoutDate.getTime())) {
    return { valid: false, error: "Invalid workout date" };
  }

  if (!workout.exercises || workout.exercises.length === 0) {
    return { valid: false, error: "Workout must have at least one exercise" };
  }

  // Check each exercise has valid sets
  for (const exercise of workout.exercises) {
    if (!exercise.exercise.id) {
      return { valid: false, error: "Exercise must have a valid ID" };
    }

    const validSets = exercise.sets.filter(set => set.kg > 0 || set.reps > 0);
    if (validSets.length === 0) {
      return {
        valid: false,
        error: `Exercise "${exercise.exercise.title}" has no valid sets`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check for duplicate workout on Hevy for a given date
 * Compares only the date (yyyy-MM-dd), not the time
 * Returns information about any duplicate workout found
 */
export async function checkForDuplicateWorkout(
  workoutDate: Date
): Promise<{
  hasDuplicate: boolean;
  duplicateWorkout?: {
    date: Date;
    time: string;
    name: string;
  };
  error?: string;
}> {
  try {
    // Use the workout date as the 'since' parameter (start of the day)
    const since = new Date(workoutDate);
    since.setHours(0, 0, 0, 0);
    const sinceParam = since.toISOString();

    // Call our API endpoint
    const response = await fetch(`/api/hevy-workouts?since=${encodeURIComponent(sinceParam)}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Error fetching workouts:", errorData);
      return {
        hasDuplicate: false,
        error: "Failed to check for duplicates",
      };
    }

    const data = await response.json();
    const events: HevyWorkoutEvent[] = data.events || [];

    // Filter for workouts on the same date (ignoring time)
    const workoutDateStr = format(workoutDate, "yyyy-MM-dd");
    
    const duplicates = events.filter((event) => {
      // Skip deleted events
      if (event.type === "deleted") return false;
      
      const workoutStartTime = new Date(event.workout.start_time);
      const workoutStartDateStr = format(workoutStartTime, "yyyy-MM-dd");
      
      return workoutStartDateStr === workoutDateStr;
    });

    if (duplicates.length > 0) {
      // Return the first duplicate found
      const duplicate = duplicates[0].workout;
      const duplicateDate = new Date(duplicate.start_time);
      
      return {
        hasDuplicate: true,
        duplicateWorkout: {
          date: duplicateDate,
          time: format(duplicateDate, "HH:mm"),
          name: duplicate.title || "Untitled Workout",
        },
      };
    }

    return { hasDuplicate: false };
  } catch (error) {
    console.error("Error checking for duplicate workout:", error);
    return {
      hasDuplicate: false,
      error: "Failed to check for duplicates",
    };
  }
}

