import "server-only";

import { WorkoutExercise, WorkoutSet } from "../types";
import { matchExerciseWithEmbeddings } from "../hevy/match-server";

/**
 * Parse the Groq API response and convert to WorkoutExercise array.
 * Uses Hevy exercise database with fuzzy + embedding matching.
 */
export async function parseGroqResponse(responseText: string): Promise<WorkoutExercise[]> {
  try {
    const parsed = JSON.parse(responseText);

    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error("Invalid response format: missing exercises array");
    }

    console.log(`📋 Parsing ${parsed.exercises.length} exercise(s) from Groq response...`);

    const workoutExercises: WorkoutExercise[] = await Promise.all(parsed.exercises.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (ex: any, index: number) => {
        const detectedName = ex.name || ex.exercise_name || "Unknown Exercise";
        console.log(`\n[Exercise ${index + 1}/${parsed.exercises.length}]`);

        const exercise = await matchExerciseWithEmbeddings(detectedName);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sets: WorkoutSet[] = (ex.sets || []).map((set: any, setIndex: number) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const baseSet: any = {
            set_number: set.set_number || setIndex + 1,
            completed: false,
          };

          switch (exercise.type) {
            case "weight_reps":
              const weight = parseFloat(set.kg || set.weight || set.weight_kg || "0");
              const reps = parseInt(set.reps || set.repetitions || "0", 10);
              baseSet.weight_kg = weight;
              baseSet.reps = reps;
              baseSet.kg = weight;
              baseSet.previous_weight_kg = weight;
              baseSet.previous_reps = reps;
              break;
            case "reps_only":
              const repsOnly = parseInt(set.reps || set.repetitions || "0", 10);
              baseSet.reps = repsOnly;
              baseSet.previous_reps = repsOnly;
              break;
            case "duration":
              let durationSeconds = 0;
              if (set.duration_seconds) {
                durationSeconds = parseInt(set.duration_seconds || "0", 10);
              } else if (set.duration) {
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
    ));

    console.log(`\n✅ Successfully parsed ${workoutExercises.length} exercise(s)`);

    return workoutExercises;
  } catch (error) {
    console.error("❌ Error parsing Groq response:", error);
    throw new Error(`Failed to parse workout data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
