/**
 * Hevy Exercise Database
 * Loads and merges all Hevy exercise JSON files for exercise matching
 */

import { Exercise } from "./types";
import {
  calculateSimilarity,
  normalizeExerciseName,
  calculateWordOverlap,
  hasSameStartingWord,
  containsEquipment,
} from "./fuzzy-match";

// Import all JSON files
import response1 from "./data/hevy-exercises/response_1766620613255.json";
import response2 from "./data/hevy-exercises/response_1766620641398.json";
import response3 from "./data/hevy-exercises/response_1766620650792.json";
import response4 from "./data/hevy-exercises/response_1766620664930.json";
import response5 from "./data/hevy-exercises/response_1766620671284.json";

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

/**
 * Search exercises by query string
 * Returns top N matches sorted by relevance
 */
export function searchExercises(query: string, limit = 10): HevyExerciseTemplate[] {
  // Calculate scores for all exercises
  const scored = HEVY_EXERCISES.map((ex) => ({
    exercise: ex,
    score: calculateMatchScore(query, ex),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return scored.map((item) => item.exercise);
}

/**
 * Calculate match score between detected name and Hevy exercise
 * Returns score from 0-100+ (can exceed 100 with bonuses)
 */
export function calculateMatchScore(
  detectedName: string,
  hevyExercise: HevyExerciseTemplate
): number {
  // Base similarity using Levenshtein distance
  let score = calculateSimilarity(detectedName, hevyExercise.title);
  
  // Bonus for word overlap
  const wordOverlap = calculateWordOverlap(detectedName, hevyExercise.title);
  score += wordOverlap * 10;
  
  // Bonus for starting word match (important for exercise type)
  if (hasSameStartingWord(detectedName, hevyExercise.title)) {
    score += 20;
  }
  
  // Bonus for equipment match
  if (containsEquipment(detectedName, hevyExercise.equipment)) {
    score += 15;
  }
  
  // Bonus for official exercises (prefer over custom)
  if (!hevyExercise.is_custom) {
    score += 5;
  }
  
  return Math.min(150, score); // Cap at 150
}

/**
 * Match detected exercise name to Hevy exercise using fuzzy matching
 * Returns the best match or creates a custom exercise
 */
export function matchExerciseWithFuzzy(detectedName: string): Exercise {
  console.log(`🔍 Matching exercise: "${detectedName}"`);
  
  // 1. Try exact match first (fastest)
  const normalized = normalizeExerciseName(detectedName);
  const exactMatch = HEVY_EXERCISES.find(
    (ex) => normalizeExerciseName(ex.title) === normalized
  );
  
  if (exactMatch) {
    console.log(`✅ Exact match found: "${exactMatch.title}"`);
    return convertHevyToExercise(exactMatch);
  }
  
  // 1.5. Handle compound exercises (TBT/TTH/K2C) - try matching each part separately
  const slashParts = detectedName.split('/').map(p => p.trim()).filter(p => p.length > 0);
  if (slashParts.length > 1 && slashParts.length <= 3) {
    // Try matching each part separately and pick the best match
    console.log(`   Detected compound exercise with ${slashParts.length} parts, trying each part...`);
    
    let bestCompoundMatch: { exercise: HevyExerciseTemplate; score: number } | null = null;
    
    for (const part of slashParts) {
      const partMatches = HEVY_EXERCISES.map((ex) => ({
        exercise: ex,
        score: calculateMatchScore(part, ex),
      }));
      
      const partBest = partMatches
        .filter((m) => m.score >= 60) // Use same threshold
        .sort((a, b) => {
          if (a.exercise.is_custom !== b.exercise.is_custom) {
            return a.exercise.is_custom ? 1 : -1;
          }
          return b.score - a.score;
        })[0];
      
      if (partBest && (!bestCompoundMatch || partBest.score > bestCompoundMatch.score)) {
        bestCompoundMatch = partBest;
        console.log(`   Part "${part}" matched: "${partBest.exercise.title}" (${Math.round(partBest.score)}%)`);
      }
    }
    
    if (bestCompoundMatch) {
      console.log(`✅ Best compound match: "${bestCompoundMatch.exercise.title}"`);
      console.log(`   Score: ${Math.round(bestCompoundMatch.score)}%`);
      return convertHevyToExercise(bestCompoundMatch.exercise);
    }
  }
  
  // 2. Calculate similarity scores for all exercises
  const matches = HEVY_EXERCISES.map((ex) => ({
    exercise: ex,
    score: calculateMatchScore(detectedName, ex),
  }));
  
  // 3. Filter by threshold and sort
  const THRESHOLD = 60;
  const validMatches = matches
    .filter((m) => m.score >= THRESHOLD)
    .sort((a, b) => {
      // Prefer official exercises
      if (a.exercise.is_custom !== b.exercise.is_custom) {
        return a.exercise.is_custom ? 1 : -1;
      }
      // Then by score
      return b.score - a.score;
    });
  
  // 4. Return best match if found
  if (validMatches.length > 0) {
    const best = validMatches[0];
    console.log(`✅ Best match: "${best.exercise.title}"`);
    console.log(`   Score: ${Math.round(best.score)}%`);
    console.log(`   Official: ${!best.exercise.is_custom}`);
    console.log(`   Equipment: ${best.exercise.equipment}`);
    
    // Log alternative matches if any
    if (validMatches.length > 1) {
      console.log(`   Alternatives: ${validMatches.slice(1, 3).map(m => m.exercise.title).join(', ')}`);
    }
    
    return convertHevyToExercise(best.exercise);
  }
  
  // 5. No match above threshold - return best available match anyway
  // Sort all matches (even below threshold) and return the best one
  const allMatchesSorted = matches
    .sort((a, b) => {
      // Prefer official exercises
      if (a.exercise.is_custom !== b.exercise.is_custom) {
        return a.exercise.is_custom ? 1 : -1;
      }
      // Then by score
      return b.score - a.score;
    });
  
  if (allMatchesSorted.length > 0) {
    const best = allMatchesSorted[0];
    console.warn(`⚠️ No match above threshold (${THRESHOLD}%) for "${detectedName}"`);
    console.log(`   Using best available match: "${best.exercise.title}"`);
    console.log(`   Score: ${Math.round(best.score)}%`);
    console.log(`   Official: ${!best.exercise.is_custom}`);
    
    // Log top 5 matches for debugging
    const topMatches = allMatchesSorted.slice(0, 5);
    console.log(`   Top 5 matches:`);
    topMatches.forEach((m, i) => {
      console.log(`   ${i + 1}. "${m.exercise.title}" - Score: ${Math.round(m.score)}%`);
    });
  
    return convertHevyToExercise(best.exercise);
  }
  
  // 6. Fallback: This should never happen if database is loaded, but handle it gracefully
  console.error(`❌ No exercises in database! Cannot match "${detectedName}"`);
  throw new Error(`Exercise database not loaded. Cannot match exercise: "${detectedName}"`);
}

/**
 * Create a custom exercise when no match is found
 * DEPRECATED: We no longer create custom exercises. Always return best match from database.
 */
// function createCustomExercise(name: string): Exercise {
//   return {
//     id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//     title: name,
//     type: "weight_reps",
//     primary_muscle_group: "unknown",
//     secondary_muscle_groups: [],
//     is_custom: true,
//   };
// }

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
  muscleGroup: string
): HevyExerciseTemplate[] {
  return HEVY_EXERCISES.filter(
    (ex) =>
      ex.primary_muscle_group.toLowerCase() === muscleGroup.toLowerCase() ||
      ex.secondary_muscle_groups.some(
        (mg) => mg.toLowerCase() === muscleGroup.toLowerCase()
      )
  );
}

/**
 * Get all exercises for specific equipment
 */
export function getExercisesByEquipment(
  equipment: string
): HevyExerciseTemplate[] {
  return HEVY_EXERCISES.filter(
    (ex) => ex.equipment.toLowerCase() === equipment.toLowerCase()
  );
}

// Log database stats on load
console.log(`📊 Hevy Exercise Database Loaded:`);
const stats = getExerciseStats();
console.log(`   Total: ${stats.total} exercises`);
console.log(`   Official: ${stats.official}`);
console.log(`   Custom: ${stats.custom}`);

