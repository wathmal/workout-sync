/**
 * Hevy Exercise Database
 * Loads and merges all Hevy exercise JSON files for exercise matching.
 *
 * This module is isomorphic — it is imported by both server routes and
 * client components (e.g. ExercisePickerDropdown), so it MUST NOT import
 * server-only code, even dynamically (Turbopack graph-walks `await import()`
 * for client SSR). Embedding-enhanced matching lives in `./match-server.ts`.
 */

import { Exercise } from "../types";
import {
  calculateSimilarity,
  normalizeExerciseName,
  calculateWordOverlap,
  hasSameStartingWord,
  containsEquipment,
} from "./fuzzy-match";

import response1 from "../data/hevy-exercises/response_1766620613255.json";
import response2 from "../data/hevy-exercises/response_1766620641398.json";
import response3 from "../data/hevy-exercises/response_1766620650792.json";
import response4 from "../data/hevy-exercises/response_1766620664930.json";
import response5 from "../data/hevy-exercises/response_1766620671284.json";

export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
}

export type MatchingMode = "fuzzy" | "vector" | "both";

export interface CosineLookup {
  exerciseIdToIndex: Map<string, number>;
  scores: ArrayLike<number>;
}

export interface ScoredExercise {
  exercise: HevyExerciseTemplate;
  score: number;
}

const allHevyExercises: HevyExerciseTemplate[] = [
  ...response1.exercise_templates,
  ...response2.exercise_templates,
  ...response3.exercise_templates,
  ...response4.exercise_templates,
  ...response5.exercise_templates,
];

export function convertHevyToExercise(hevy: HevyExerciseTemplate): Exercise {
  return {
    id: hevy.id,
    title: hevy.title,
    type: hevy.type as Exercise["type"],
    primary_muscle_group: hevy.primary_muscle_group,
    secondary_muscle_groups: hevy.secondary_muscle_groups,
    is_custom: hevy.is_custom,
  };
}

export const HEVY_EXERCISES = allHevyExercises;

const exerciseIdToPosition = new Map<string, number>();
HEVY_EXERCISES.forEach((ex, i) => exerciseIdToPosition.set(ex.id, i));

export function getExerciseCount(): number {
  return HEVY_EXERCISES.length;
}

export function getExerciseStats() {
  const official = HEVY_EXERCISES.filter((ex) => !ex.is_custom).length;
  const custom = HEVY_EXERCISES.filter((ex) => ex.is_custom).length;
  return { total: HEVY_EXERCISES.length, official, custom };
}

// --- Score config ---

export const EMBEDDING_BOOST_MAX = parseFloat(process.env.EMBEDDING_BOOST_MAX ?? "30");
export const COS_THRESHOLD = parseFloat(process.env.EMBEDDING_COS_THRESHOLD ?? "0.55");
export const SCORE_THRESHOLD = 60;
export const SCORE_CAP = 150;

export const EQUIPMENT_WORDS = new Set([
  "barbell", "dumbbell", "kettlebell", "cable", "machine", "band",
  "ez bar", "sz bar", "swiss bar", "trap bar", "smith", "smith machine",
]);

export function calculateFuzzyBase(detectedName: string, hevyExercise: HevyExerciseTemplate): number {
  let score = calculateSimilarity(detectedName, hevyExercise.title);
  const wordOverlap = calculateWordOverlap(detectedName, hevyExercise.title);
  score += wordOverlap * 10;
  return score;
}

export function calculateBonuses(detectedName: string, hevyExercise: HevyExerciseTemplate): number {
  let bonus = 0;
  if (hasSameStartingWord(detectedName, hevyExercise.title)) bonus += 20;
  if (containsEquipment(detectedName, hevyExercise.equipment)) bonus += 15;
  if (!hevyExercise.is_custom) bonus += 5;
  return bonus;
}

export function calculateMatchScore(
  detectedName: string,
  hevyExercise: HevyExerciseTemplate,
): number {
  const base = calculateFuzzyBase(detectedName, hevyExercise);
  const bonus = calculateBonuses(detectedName, hevyExercise);
  return Math.min(SCORE_CAP, base + bonus);
}

/**
 * Blend fuzzy + cosine scores. mode='fuzzy' or cosines=null → pure fuzzy.
 */
export function blendScore(
  mode: MatchingMode,
  fuzzyBase: number,
  cos: number | undefined,
  bonuses: number,
): number {
  if (mode === "fuzzy" || cos === undefined) {
    return Math.min(SCORE_CAP, fuzzyBase + bonuses);
  }
  if (mode === "vector") {
    return Math.min(SCORE_CAP, cos * 100);
  }
  // both: embedding adds boost on top of fuzzy+bonuses, never dampens.
  const base = fuzzyBase + bonuses;
  if (cos <= COS_THRESHOLD) return Math.min(SCORE_CAP, base);
  const denom = 1 - COS_THRESHOLD;
  const boost = denom > 0 ? ((cos - COS_THRESHOLD) / denom) * EMBEDDING_BOOST_MAX : 0;
  return Math.min(SCORE_CAP, base + boost);
}

export function scoreAll(
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

export function sortMatches(matches: ScoredExercise[]): ScoredExercise[] {
  return matches.slice().sort((a, b) => {
    if (a.exercise.is_custom !== b.exercise.is_custom) {
      return a.exercise.is_custom ? 1 : -1;
    }
    return b.score - a.score;
  });
}

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

export function getExerciseById(id: string): Exercise | null {
  const hevy = HEVY_EXERCISES.find((ex) => ex.id === id);
  return hevy ? convertHevyToExercise(hevy) : null;
}

export function getExercisesByMuscleGroup(muscleGroup: string): HevyExerciseTemplate[] {
  return HEVY_EXERCISES.filter(
    (ex) =>
      ex.primary_muscle_group.toLowerCase() === muscleGroup.toLowerCase() ||
      ex.secondary_muscle_groups.some(
        (mg) => mg.toLowerCase() === muscleGroup.toLowerCase(),
      ),
  );
}

export function getExercisesByEquipment(equipment: string): HevyExerciseTemplate[] {
  return HEVY_EXERCISES.filter(
    (ex) => ex.equipment.toLowerCase() === equipment.toLowerCase(),
  );
}

export function getExercisePosition(id: string): number | undefined {
  return exerciseIdToPosition.get(id);
}

console.log(`📊 Hevy Exercise Database Loaded:`);
const stats = getExerciseStats();
console.log(`   Total: ${stats.total} exercises`);
console.log(`   Official: ${stats.official}`);
console.log(`   Custom: ${stats.custom}`);
