/**
 * Hevy Exercise Database
 * Loads and merges all Hevy exercise JSON files for exercise matching
 */

import { Exercise } from "../types";
import {
  calculateSimilarity,
  normalizeExerciseName,
  calculateWordOverlap,
  hasSameStartingWord,
  containsEquipment,
} from "./fuzzy-match";
import type { CosineLookup } from "../embeddings/match";
import type { MatchingMode } from "../embeddings/types";

// Embedding code uses Node APIs (fs, @huggingface/transformers). Lazy-import
// so client bundles never pull it in.
const isServer = typeof window === "undefined";

async function loadMatchingMode(): Promise<MatchingMode> {
  if (!isServer) return "fuzzy";
  const { getMatchingMode } = await import("../embeddings/match");
  return getMatchingMode();
}

async function loadCosines(text: string): Promise<CosineLookup | null> {
  if (!isServer) return null;
  const { computeCosines } = await import("../embeddings/match");
  return computeCosines(text);
}

// Import all JSON files
import response1 from "../data/hevy-exercises/response_1766620613255.json";
import response2 from "../data/hevy-exercises/response_1766620641398.json";
import response3 from "../data/hevy-exercises/response_1766620650792.json";
import response4 from "../data/hevy-exercises/response_1766620664930.json";
import response5 from "../data/hevy-exercises/response_1766620671284.json";

// Hevy exercise template type (from their API)
interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
}

// Merge all exercise templates from all JSON files
const allHevyExercises: HevyExerciseTemplate[] = [
  ...response1.exercise_templates,
  ...response2.exercise_templates,
  ...response3.exercise_templates,
  ...response4.exercise_templates,
  ...response5.exercise_templates,
];

/**
 * Convert Hevy exercise template to our Exercise type
 */
function convertHevyToExercise(hevy: HevyExerciseTemplate): Exercise {
  return {
    id: hevy.id,
    title: hevy.title,
    type: hevy.type as Exercise["type"],
    primary_muscle_group: hevy.primary_muscle_group,
    secondary_muscle_groups: hevy.secondary_muscle_groups,
    is_custom: hevy.is_custom,
  };
}

/**
 * Export all Hevy exercises
 */
export const HEVY_EXERCISES = allHevyExercises;

// Build position index for embedding lookup
const exerciseIdToPosition = new Map<string, number>();
HEVY_EXERCISES.forEach((ex, i) => exerciseIdToPosition.set(ex.id, i));

/**
 * Get total number of exercises in database
 */
export function getExerciseCount(): number {
  return HEVY_EXERCISES.length;
}

/**
 * Get count of official vs custom exercises
 */
export function getExerciseStats() {
  const official = HEVY_EXERCISES.filter((ex) => !ex.is_custom).length;
  const custom = HEVY_EXERCISES.filter((ex) => ex.is_custom).length;

  return {
    total: HEVY_EXERCISES.length,
    official,
    custom,
  };
}

// --- Score config ---

// Embedding contributes as an additive boost on top of fuzzy+bonuses, never
// dampening fuzzy. EMBEDDING_BOOST_MAX caps how much an excellent cosine can add.
const EMBEDDING_BOOST_MAX = parseFloat(process.env.EMBEDDING_BOOST_MAX ?? "30");
const COS_THRESHOLD = parseFloat(process.env.EMBEDDING_COS_THRESHOLD ?? "0.55");
const SCORE_THRESHOLD = 60;
const SCORE_CAP = 150;

// Single-word equipment names, used to detect equipment-only compound parts
// (e.g. "BB" in "BB/DB Curl") so we can skip first-part-prefer logic.
const EQUIPMENT_WORDS = new Set([
  "barbell", "dumbbell", "kettlebell", "cable", "machine", "band",
  "ez bar", "sz bar", "swiss bar", "trap bar", "smith", "smith machine",
]);

/**
 * Levenshtein-based fuzzy similarity component (no bonuses).
 * Range 0-100.
 */
export function calculateFuzzyBase(detectedName: string, hevyExercise: HevyExerciseTemplate): number {
  let score = calculateSimilarity(detectedName, hevyExercise.title);
  const wordOverlap = calculateWordOverlap(detectedName, hevyExercise.title);
  score += wordOverlap * 10;
  return score;
}

/**
 * Bonuses applied on top of either fuzzy or vector base score.
 */
export function calculateBonuses(detectedName: string, hevyExercise: HevyExerciseTemplate): number {
  let bonus = 0;
  if (hasSameStartingWord(detectedName, hevyExercise.title)) bonus += 20;
  if (containsEquipment(detectedName, hevyExercise.equipment)) bonus += 15;
  if (!hevyExercise.is_custom) bonus += 5;
  return bonus;
}

/**
 * Legacy combined score (Levenshtein + bonuses, capped at 150).
 * Kept for backwards compatibility (e.g. consumers calling matchExercise).
 */
export function calculateMatchScore(
  detectedName: string,
  hevyExercise: HevyExerciseTemplate,
): number {
  const base = calculateFuzzyBase(detectedName, hevyExercise);
  const bonus = calculateBonuses(detectedName, hevyExercise);
  return Math.min(SCORE_CAP, base + bonus);
}

/**
 * Blend fuzzy + cosine scores into final score.
 */
function blendScore(
  mode: MatchingMode,
  fuzzyBase: number,
  cos: number | undefined,
  bonuses: number,
): number {
  if (mode === "fuzzy" || cos === undefined) {
    return Math.min(SCORE_CAP, fuzzyBase + bonuses);
  }
  if (mode === "vector") {
    // pure cosine, no bonuses, no fuzzy
    return Math.min(SCORE_CAP, cos * 100);
  }
  // both: embedding adds boost on top of fuzzy+bonuses, never dampens.
  // boost = (cos - threshold) / (1 - threshold) * MAX, only when cos > threshold.
  const base = fuzzyBase + bonuses;
  if (cos <= COS_THRESHOLD) return Math.min(SCORE_CAP, base);
  const denom = 1 - COS_THRESHOLD;
  const boost = denom > 0 ? ((cos - COS_THRESHOLD) / denom) * EMBEDDING_BOOST_MAX : 0;
  return Math.min(SCORE_CAP, base + boost);
}

interface ScoredExercise {
  exercise: HevyExerciseTemplate;
  score: number;
}

async function buildCosineLookup(detectedName: string, mode: MatchingMode): Promise<CosineLookup | null> {
  if (mode === "fuzzy") return null;
  return loadCosines(detectedName);
}

function scoreAll(
  detectedName: string,
  mode: MatchingMode,
  cosines: CosineLookup | null,
): ScoredExercise[] {
  return HEVY_EXERCISES.map((ex) => {
    const fuzzy = mode === "vector" ? 0 : calculateFuzzyBase(detectedName, ex);
    const bonuses = mode === "vector" ? 0 : calculateBonuses(detectedName, ex);
    let cos: number | undefined;
    if (cosines) {
      const idx = cosines.exerciseIdToIndex.get(ex.id);
      if (idx !== undefined) cos = cosines.scores[idx];
    }
    return { exercise: ex, score: blendScore(mode, fuzzy, cos, bonuses) };
  });
}

function sortMatches(matches: ScoredExercise[]): ScoredExercise[] {
  return matches.slice().sort((a, b) => {
    if (a.exercise.is_custom !== b.exercise.is_custom) {
      return a.exercise.is_custom ? 1 : -1;
    }
    return b.score - a.score;
  });
}

/**
 * Search exercises by query string.
 * Returns top N matches sorted by relevance.
 */
export async function searchExercises(query: string, limit = 10): Promise<HevyExerciseTemplate[]> {
  let mode = await loadMatchingMode();
  const cosines = await buildCosineLookup(query, mode);
  if (mode === "vector" && !cosines) mode = "fuzzy";
  const scored = scoreAll(query, mode, cosines)
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((item) => item.exercise);
}

/**
 * Match detected exercise name to Hevy exercise using fuzzy + embedding matching.
 * Returns the best match or throws if database is empty.
 */
export async function matchExerciseWithFuzzy(detectedName: string): Promise<Exercise> {
  console.log(`🔍 Matching exercise: "${detectedName}"`);

  // 1. Try exact match first (fastest)
  const normalized = normalizeExerciseName(detectedName);
  const exactMatch = HEVY_EXERCISES.find(
    (ex) => normalizeExerciseName(ex.title) === normalized,
  );

  if (exactMatch) {
    console.log(`✅ Exact match found: "${exactMatch.title}"`);
    return convertHevyToExercise(exactMatch);
  }

  let mode = await loadMatchingMode();
  const cosines = await buildCosineLookup(detectedName, mode);
  if (mode === "vector" && !cosines) {
    console.warn("[matching] vector mode requested but embedding source unavailable, falling back to fuzzy");
    mode = "fuzzy";
  }

  // 1.5. Handle compound exercises (e.g. TBT/TTH/K2C) — prefer the FIRST part.
  // Skip when first part is just an equipment abbreviation (e.g. "BB/DB Curl"
  // → first part "BB" is meaningless alone). Equipment-slash patterns like
  // "BB/DB Curl" are handled by expandAbbreviations in the main scoring path.
  const slashParts = detectedName.split("/").map((p) => p.trim()).filter((p) => p.length > 0);
  if (slashParts.length > 1 && slashParts.length <= 3) {
    const firstPart = slashParts[0];
    const firstNormalized = normalizeExerciseName(firstPart);
    const isEquipmentOnly = EQUIPMENT_WORDS.has(firstNormalized);

    if (!isEquipmentOnly) {
      console.log(`   Detected compound exercise with ${slashParts.length} parts, trying first: "${firstPart}"`);

      const firstCosines = mode === "fuzzy" ? null : await buildCosineLookup(firstPart, mode);
      const firstScored = scoreAll(firstPart, mode, firstCosines);
      const firstBest = sortMatches(firstScored.filter((m) => m.score >= SCORE_THRESHOLD))[0];

      if (firstBest) {
        console.log(`✅ Compound match (first part "${firstPart}"): "${firstBest.exercise.title}"`);
        console.log(`   Score: ${Math.round(firstBest.score)}%`);
        return convertHevyToExercise(firstBest.exercise);
      }
      console.log(`   First part "${firstPart}" had no match above threshold; falling through to full-string match`);
    } else {
      console.log(`   First part "${firstPart}" is equipment-only; using full-string match`);
    }
  }

  // 2. Score all exercises
  const matches = scoreAll(detectedName, mode, cosines);

  // 3. Filter by threshold and sort
  const validMatches = sortMatches(matches.filter((m) => m.score >= SCORE_THRESHOLD));

  // 4. Return best match if found
  if (validMatches.length > 0) {
    const best = validMatches[0];
    console.log(`✅ Best match: "${best.exercise.title}"`);
    console.log(`   Score: ${Math.round(best.score)}% (mode=${mode})`);
    console.log(`   Official: ${!best.exercise.is_custom}`);
    console.log(`   Equipment: ${best.exercise.equipment}`);

    if (validMatches.length > 1) {
      console.log(`   Alternatives: ${validMatches.slice(1, 3).map((m) => m.exercise.title).join(", ")}`);
    }

    return convertHevyToExercise(best.exercise);
  }

  // 5. No match above threshold - return best available match anyway
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

    return convertHevyToExercise(best.exercise);
  }

  // 6. Fallback: This should never happen if database is loaded
  console.error(`❌ No exercises in database! Cannot match "${detectedName}"`);
  throw new Error(`Exercise database not loaded. Cannot match exercise: "${detectedName}"`);
}

/**
 * Get exercise by ID from Hevy database
 */
export function getExerciseById(id: string): Exercise | null {
  const hevy = HEVY_EXERCISES.find((ex) => ex.id === id);
  return hevy ? convertHevyToExercise(hevy) : null;
}

/**
 * Get all exercises for a specific muscle group
 */
export function getExercisesByMuscleGroup(
  muscleGroup: string,
): HevyExerciseTemplate[] {
  return HEVY_EXERCISES.filter(
    (ex) =>
      ex.primary_muscle_group.toLowerCase() === muscleGroup.toLowerCase() ||
      ex.secondary_muscle_groups.some(
        (mg) => mg.toLowerCase() === muscleGroup.toLowerCase(),
      ),
  );
}

/**
 * Get all exercises for specific equipment
 */
export function getExercisesByEquipment(
  equipment: string,
): HevyExerciseTemplate[] {
  return HEVY_EXERCISES.filter(
    (ex) => ex.equipment.toLowerCase() === equipment.toLowerCase(),
  );
}

export function getExercisePosition(id: string): number | undefined {
  return exerciseIdToPosition.get(id);
}

// Log database stats on load
console.log(`📊 Hevy Exercise Database Loaded:`);
const stats = getExerciseStats();
console.log(`   Total: ${stats.total} exercises`);
console.log(`   Official: ${stats.official}`);
console.log(`   Custom: ${stats.custom}`);
