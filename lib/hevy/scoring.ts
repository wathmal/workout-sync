/**
 * Pure scoring primitives for Hevy exercise matching.
 *
 * Score components, blend formula, and full-catalog scoring. No I/O,
 * no logging — easy to unit-test in isolation.
 */

import {
  calculateSimilarity,
  calculateWordOverlap,
  hasSameStartingWord,
  containsEquipment,
} from "./fuzzy-match";
import { HEVY_EXERCISES, type HevyExerciseTemplate } from "./catalog";

export type MatchingMode = "fuzzy" | "vector" | "both";

export interface CosineLookup {
  exerciseIdToIndex: Map<string, number>;
  scores: ArrayLike<number>;
}

export interface ScoredExercise {
  exercise: HevyExerciseTemplate;
  score: number;
}

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
