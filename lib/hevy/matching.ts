/**
 * Hevy exercise matching kernel.
 *
 * Exact → compound (slash-split) → fuzzy+threshold → best-available fallback.
 * Isomorphic. For embedding-enhanced matching, see ./match-server.ts.
 */

import { Exercise } from "../types";
import { normalizeExerciseName } from "./fuzzy-match";
import {
  HEVY_EXERCISES,
  convertHevyToExercise,
  type HevyExerciseTemplate,
} from "./catalog";
import {
  type CosineLookup,
  type MatchingMode,
  type ScoredExercise,
  EQUIPMENT_WORDS,
  SCORE_CAP,
  SCORE_THRESHOLD,
  scoreAll,
  sortMatches,
} from "./scoring";

/**
 * Pure fuzzy search. For embedding-enhanced search, see ./match-server.ts.
 */
export async function searchExercises(query: string, limit = 10): Promise<HevyExerciseTemplate[]> {
  const scored = scoreAll(query, "fuzzy", null)
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((item) => item.exercise);
}

/**
 * Pure fuzzy search returning scored matches with the raw 0-150 score so the
 * picker UI can render match-confidence percentages.
 *
 * `kind` filters: 'all' = both, 'official' = is_custom=false, 'custom' = is_custom=true.
 * Empty query returns the full list (sorted by official, alpha) up to `limit`.
 */
export function searchExercisesScored(
  query: string,
  opts: { limit?: number; kind?: "all" | "official" | "custom" } = {},
): ScoredExercise[] {
  const { limit = 50, kind = "all" } = opts;
  const trimmed = query.trim();

  let pool: ScoredExercise[];
  if (trimmed.length === 0) {
    pool = HEVY_EXERCISES.map((ex) => ({ exercise: ex, score: 0 }));
  } else {
    pool = scoreAll(trimmed, "fuzzy", null).filter((m) => m.score > 0);
  }

  if (kind === "official") pool = pool.filter((m) => !m.exercise.is_custom);
  if (kind === "custom") pool = pool.filter((m) => m.exercise.is_custom);

  return sortMatches(pool).slice(0, limit);
}

/**
 * Pure fuzzy match (no embeddings). Server callers wanting embedding boost
 * should use `matchExerciseWithEmbeddings` from ./match-server.ts.
 */
export async function matchExerciseWithFuzzy(detectedName: string): Promise<Exercise> {
  return matchExerciseImpl(detectedName, "fuzzy", null);
}

/**
 * Internal: shared match flow. Caller chooses mode and supplies cosines (or
 * null for fuzzy). Used directly by `matchExerciseWithEmbeddings` after it
 * loads cosines from the server-only embedding module.
 */
export async function matchExerciseImpl(
  detectedName: string,
  mode: MatchingMode,
  cosines: CosineLookup | null,
): Promise<Exercise> {
  return (await matchExerciseImplScored(detectedName, mode, cosines)).exercise;
}

/**
 * Same flow as matchExerciseImpl but also returns the raw 0-150 match score
 * for the chosen exercise. Used to surface match% in the UI.
 */
export async function matchExerciseImplScored(
  detectedName: string,
  mode: MatchingMode,
  cosines: CosineLookup | null,
): Promise<{ exercise: Exercise; score: number }> {
  console.log(`🔍 Matching exercise: "${detectedName}"`);

  // 1. Exact match (fastest)
  const normalized = normalizeExerciseName(detectedName);
  const exactMatch = HEVY_EXERCISES.find(
    (ex) => normalizeExerciseName(ex.title) === normalized,
  );
  if (exactMatch) {
    console.log(`✅ Exact match found: "${exactMatch.title}"`);
    return { exercise: convertHevyToExercise(exactMatch), score: SCORE_CAP };
  }

  // 1.5. Compound exercises ("BB/DB Curl") — prefer first part if not equipment-only
  const slashParts = detectedName.split("/").map((p) => p.trim()).filter((p) => p.length > 0);
  if (slashParts.length > 1 && slashParts.length <= 3) {
    const firstPart = slashParts[0];
    const firstNormalized = normalizeExerciseName(firstPart);
    const isEquipmentOnly = EQUIPMENT_WORDS.has(firstNormalized);
    if (!isEquipmentOnly) {
      console.log(`   Detected compound exercise with ${slashParts.length} parts, trying first: "${firstPart}"`);
      const firstScored = scoreAll(firstPart, mode, cosines);
      const firstBest = sortMatches(firstScored.filter((m) => m.score >= SCORE_THRESHOLD))[0];
      if (firstBest) {
        console.log(`✅ Compound match (first part "${firstPart}"): "${firstBest.exercise.title}"`);
        console.log(`   Score: ${Math.round(firstBest.score)}%`);
        return { exercise: convertHevyToExercise(firstBest.exercise), score: firstBest.score };
      }
      console.log(`   First part "${firstPart}" had no match above threshold; falling through`);
    } else {
      console.log(`   First part "${firstPart}" is equipment-only; using full-string match`);
    }
  }

  // 2. Score all
  const matches = scoreAll(detectedName, mode, cosines);
  const validMatches = sortMatches(matches.filter((m) => m.score >= SCORE_THRESHOLD));

  if (validMatches.length > 0) {
    const best = validMatches[0];
    console.log(`✅ Best match: "${best.exercise.title}"`);
    console.log(`   Score: ${Math.round(best.score)}% (mode=${mode})`);
    console.log(`   Official: ${!best.exercise.is_custom}`);
    console.log(`   Equipment: ${best.exercise.equipment}`);
    if (validMatches.length > 1) {
      console.log(`   Alternatives: ${validMatches.slice(1, 3).map((m) => m.exercise.title).join(", ")}`);
    }
    return { exercise: convertHevyToExercise(best.exercise), score: best.score };
  }

  // 3. Below threshold — best available anyway
  const allMatchesSorted = sortMatches(matches);
  if (allMatchesSorted.length > 0) {
    const best = allMatchesSorted[0];
    console.warn(`⚠️ No match above threshold (${SCORE_THRESHOLD}%) for "${detectedName}"`);
    console.log(`   Using best available match: "${best.exercise.title}"`);
    console.log(`   Score: ${Math.round(best.score)}% (mode=${mode})`);
    console.log(`   Official: ${!best.exercise.is_custom}`);
    const topMatches = allMatchesSorted.slice(0, 5);
    console.log(`   Top 5 matches:`);
    topMatches.forEach((m, i) => {
      console.log(`   ${i + 1}. "${m.exercise.title}" - Score: ${Math.round(m.score)}%`);
    });
    return { exercise: convertHevyToExercise(best.exercise), score: best.score };
  }

  console.error(`❌ No exercises in database! Cannot match "${detectedName}"`);
  throw new Error(`Exercise database not loaded. Cannot match exercise: "${detectedName}"`);
}
