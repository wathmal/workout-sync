import "server-only";

import { WorkoutExercise, WorkoutSet } from "../types";
import { matchExerciseWithEmbeddingsScored } from "../hevy/match-server";
import { buildWorkoutSet, CoercedSetInput } from "../workout-set-builder";

function parseDurationSeconds(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw === "string") {
    if (raw.includes(":")) {
      const [mins, secs] = raw.split(":").map(Number);
      return (mins || 0) * 60 + (secs || 0);
    }
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseFloatField(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseIntField(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

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

        const { exercise, score: matchScore } = await matchExerciseWithEmbeddingsScored(detectedName);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sets: WorkoutSet[] = (ex.sets || []).map((set: any, setIndex: number) => {
          const coerced: CoercedSetInput = {
            set_number: set.set_number || setIndex + 1,
            weight_kg: parseFloatField(set.kg ?? set.weight ?? set.weight_kg),
            reps: parseIntField(set.reps ?? set.repetitions),
            duration_seconds: parseDurationSeconds(set.duration_seconds ?? set.duration),
            distance_meters: parseFloatField(set.distance ?? set.distance_meters),
          };
          return buildWorkoutSet(exercise.type, coerced);
        });

        console.log(`   Sets: ${sets.length}`);

        return {
          exercise,
          sets,
          notes: ex.notes || "",
          rest_timer_enabled: false,
          matchScore,
          rawDetection: detectedName,
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
