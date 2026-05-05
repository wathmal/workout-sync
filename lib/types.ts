// Hevy API Exercise Template Structure
export interface Exercise {
  id: string;
  title: string;
  type: "weight_reps" | "reps_only" | "duration" | "distance_duration";
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  is_custom: boolean;
}

// Workout Set
export interface WorkoutSet {
  set_number: number;
  // For weight_reps type
  weight_kg?: number;
  reps?: number;
  // For reps_only type (reps only)
  // For duration type
  duration_seconds?: number;
  // For distance_duration type
  distance_meters?: number;
  // Legacy fields for backward compatibility (will be migrated)
  kg?: number;
  // Previous values for comparison
  previous_weight_kg?: number;
  previous_reps?: number;
  previous_duration_seconds?: number;
  previous_distance_meters?: number;
  completed: boolean;
}

// Exercise within a workout
export interface WorkoutExercise {
  exercise: Exercise;
  sets: WorkoutSet[];
  notes?: string;
  rest_timer_enabled: boolean;
  /** 0-150 scale score from the matcher; surfaced as % in the UI. */
  matchScore?: number;
  /** Original string Groq detected, before any matching/normalization. */
  rawDetection?: string;
}

// Complete Workout
export interface Workout {
  id: string;
  duration_minutes: number;
  total_volume_kg: number;
  total_sets: number;
  exercises: WorkoutExercise[];
  date: Date;
  photo_url?: string;
  caption?: string;
  sync_to_hevy: boolean;
  share_to_instagram: boolean;
}

// Sync Status
export type SyncStatus = "pending" | "syncing" | "synced" | "error";

// Exercise Sync State
export interface ExerciseSyncState {
  exercise_id: string;
  status: SyncStatus;
}

// Connected Account
export interface ConnectedAccount {
  id: string;
  name: string;
  type: "hevy" | "strava" | "other";
  status: "active" | "inactive" | "pending";
  icon_color: string;
}

// Hevy Workout Event (from /v1/workouts/events endpoint)
export interface HevyWorkoutEvent {
  type: "updated" | "deleted";
  workout: {
    id: string;
    title: string;
    routine_id: string | null;
    description: string;
    start_time: string; // ISO 8601 string with timezone
    end_time: string; // ISO 8601 string with timezone
    updated_at: string;
    created_at: string;
    exercises: any[]; // Full exercise data structure
  };
}

// Duplicate Workout Check Result
export interface DuplicateWorkoutInfo {
  date: Date;
  time: string;
  name: string;
}

