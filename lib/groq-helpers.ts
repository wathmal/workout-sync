import { WorkoutExercise, WorkoutSet } from "./types";
import { matchExerciseWithFuzzy } from "./hevy-exercises";

/**
 * Convert a File object to base64 string
 */
export async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = base64String.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Parse the Groq API response and convert to WorkoutExercise array
 * Now uses Hevy exercise database with fuzzy matching
 */
export function parseGroqResponse(responseText: string): WorkoutExercise[] {
  try {
    const parsed = JSON.parse(responseText);
    
    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error("Invalid response format: missing exercises array");
    }
    
    console.log(`📋 Parsing ${parsed.exercises.length} exercise(s) from Groq response...`);
    
    const workoutExercises: WorkoutExercise[] = parsed.exercises.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ex: any, index: number) => {
        const detectedName = ex.name || ex.exercise_name || "Unknown Exercise";
        console.log(`\n[Exercise ${index + 1}/${parsed.exercises.length}]`);
        
        // Use Hevy database fuzzy matching
        const exercise = matchExerciseWithFuzzy(detectedName);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sets: WorkoutSet[] = (ex.sets || []).map((set: any, setIndex: number) => {
          const baseSet: any = {
            set_number: set.set_number || setIndex + 1,
            completed: false,
          };

          // Parse sets based on exercise type
          switch (exercise.type) {
            case "weight_reps":
              const weight = parseFloat(set.kg || set.weight || set.weight_kg || "0");
              const reps = parseInt(set.reps || set.repetitions || "0", 10);
              baseSet.weight_kg = weight;
              baseSet.reps = reps;
              baseSet.kg = weight; // Legacy field
              baseSet.previous_weight_kg = weight;
              baseSet.previous_reps = reps;
              break;
            case "reps_only":
              const repsOnly = parseInt(set.reps || set.repetitions || "0", 10);
              baseSet.reps = repsOnly;
              baseSet.previous_reps = repsOnly;
              break;
            case "duration":
              // Parse duration - could be in seconds or MM:SS format
              let durationSeconds = 0;
              if (set.duration_seconds) {
                durationSeconds = parseInt(set.duration_seconds || "0", 10);
              } else if (set.duration) {
                // Try to parse MM:SS format
                const durationStr = String(set.duration);
                if (durationStr.includes(":")) {
                  const [mins, secs] = durationStr.split(":").map(Number);
                  durationSeconds = (mins || 0) * 60 + (secs || 0);
                } else {
                  durationSeconds = parseInt(durationStr || "0", 10);
                }
              }
              baseSet.duration_seconds = durationSeconds;
              baseSet.previous_duration_seconds = durationSeconds;
              break;
            case "distance_duration":
              const distance = parseFloat(set.distance || set.distance_meters || "0");
              let distanceDurationSeconds = 0;
              if (set.duration_seconds) {
                distanceDurationSeconds = parseInt(set.duration_seconds || "0", 10);
              } else if (set.duration) {
                const durationStr = String(set.duration);
                if (durationStr.includes(":")) {
                  const [mins, secs] = durationStr.split(":").map(Number);
                  distanceDurationSeconds = (mins || 0) * 60 + (secs || 0);
                } else {
                  distanceDurationSeconds = parseInt(durationStr || "0", 10);
                }
              }
              baseSet.distance_meters = distance;
              baseSet.duration_seconds = distanceDurationSeconds;
              baseSet.previous_distance_meters = distance;
              baseSet.previous_duration_seconds = distanceDurationSeconds;
              break;
            default:
              // Fallback to weight_reps for unknown types
              const fallbackWeight = parseFloat(set.kg || set.weight || "0");
              const fallbackReps = parseInt(set.reps || set.repetitions || "0", 10);
              baseSet.weight_kg = fallbackWeight;
              baseSet.reps = fallbackReps;
              baseSet.kg = fallbackWeight;
              baseSet.previous_weight_kg = fallbackWeight;
              baseSet.previous_reps = fallbackReps;
          }

          return baseSet;
        });
        
        console.log(`   Sets: ${sets.length}`);
        
        return {
          exercise,
          sets,
          notes: ex.notes || "",
          rest_timer_enabled: false,
        };
      }
    );
    
    console.log(`\n✅ Successfully parsed ${workoutExercises.length} exercise(s)`);
    
    return workoutExercises;
  } catch (error) {
    console.error("❌ Error parsing Groq response:", error);
    throw new Error(`Failed to parse workout data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Validate image file before processing
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 20 * 1024 * 1024; // 20MB
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a JPEG, PNG, or WebP image.",
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File size exceeds 20MB limit. Please upload a smaller image.",
    };
  }
  
  return { valid: true };
}

