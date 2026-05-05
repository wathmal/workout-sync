import "server-only";

import type { Exercise } from "../types";
import { matchExerciseImpl, type CosineLookup, type MatchingMode } from "./exercises";
import { getMatchingMode, computeCosines } from "../embeddings/match";
import { expandAbbreviations } from "../exercise-abbreviations";

/**
 * Server-only match. Resolves mode + cosines from the embedding pipeline,
 * then delegates to the isomorphic match implementation in ./exercises.
 *
 * Vector queries are expanded (BB → barbell, DB → dumbbell, ...) before
 * embedding so the embedder sees the same canonical form fuzzy uses.
 */
export async function matchExerciseWithEmbeddings(detectedName: string): Promise<Exercise> {
  let mode: MatchingMode = getMatchingMode();
  let cosines: CosineLookup | null = null;
  if (mode !== "fuzzy") {
    cosines = await computeCosines(expandAbbreviations(detectedName));
    if (mode === "vector" && !cosines) {
      console.warn("[matching] vector mode requested but embedding source unavailable, falling back to fuzzy");
      mode = "fuzzy";
    }
  }
  return matchExerciseImpl(detectedName, mode, cosines);
}
