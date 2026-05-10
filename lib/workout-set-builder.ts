import { Exercise, WorkoutSet } from "./types";

export interface CoercedSetInput {
  set_number: number;
  weight_kg?: number;
  reps?: number;
  duration_seconds?: number;
  distance_meters?: number;
}

/**
 * Build a WorkoutSet from numeric inputs already coerced to the right types.
 * Each caller is responsible for parsing raw user/model output into numbers
 * before calling this. The "previous_*" fields are populated to the same
 * value so the review UI can render the previous-set comparison.
 */
export function buildWorkoutSet(
  exerciseType: Exercise["type"],
  input: CoercedSetInput,
): WorkoutSet {
  const base: WorkoutSet = {
    set_number: input.set_number,
    completed: false,
  };

  switch (exerciseType) {
    case "weight_reps": {
      const weight = input.weight_kg ?? 0;
      const reps = input.reps ?? 0;
      base.weight_kg = weight;
      base.reps = reps;
      base.kg = weight;
      base.previous_weight_kg = weight;
      base.previous_reps = reps;
      return base;
    }
    case "reps_only": {
      const reps = input.reps ?? 0;
      base.reps = reps;
      base.previous_reps = reps;
      return base;
    }
    case "duration": {
      const duration = input.duration_seconds ?? 0;
      base.duration_seconds = duration;
      base.previous_duration_seconds = duration;
      return base;
    }
    case "distance_duration": {
      const distance = input.distance_meters ?? 0;
      const duration = input.duration_seconds ?? 0;
      base.distance_meters = distance;
      base.duration_seconds = duration;
      base.previous_distance_meters = distance;
      base.previous_duration_seconds = duration;
      return base;
    }
    default: {
      const weight = input.weight_kg ?? 0;
      const reps = input.reps ?? 0;
      base.weight_kg = weight;
      base.reps = reps;
      base.kg = weight;
      base.previous_weight_kg = weight;
      base.previous_reps = reps;
      return base;
    }
  }
}
