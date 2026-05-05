/**
 * Fuzzy matching utilities for exercise name matching
 * Implements Levenshtein distance algorithm for string similarity
 */

import { expandAbbreviations } from "../exercise-abbreviations";

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of edits needed to transform one string into another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create a 2D array for dynamic programming
  const matrix: number[][] = [];
  
  // Initialize first column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  // Initialize first row
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings (0-100%)
 * Uses Levenshtein distance normalized by the longer string length
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeExerciseName(str1);
  const normalized2 = normalizeExerciseName(str2);
  
  if (normalized1 === normalized2) return 100;
  if (!normalized1 || !normalized2) return 0;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  
  // Convert distance to similarity percentage
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Reorder equipment words to the end for better matching
 * "dumbbell curl" → "curl dumbbell"
 * "barbell bench press" → "bench press barbell"
 */
export function reorderEquipmentToEnd(name: string): string {
  const normalized = name.toLowerCase().trim();
  const words = normalized.split(' ');
  
  const equipmentWords = ['dumbbell', 'barbell', 'kettlebell', 'cable', 'machine', 'band', 'ez', 'smith'];
  
  // Find equipment words at the start
  const equipmentAtStart: string[] = [];
  const otherWords: string[] = [];
  
  for (const word of words) {
    if (equipmentWords.includes(word) && otherWords.length === 0) {
      equipmentAtStart.push(word);
    } else {
      otherWords.push(word);
    }
  }
  
  // Reorder: other words first, then equipment
  if (equipmentAtStart.length > 0 && otherWords.length > 0) {
    return [...otherWords, ...equipmentAtStart].join(' ');
  }
  
  return normalized;
}

/**
 * Normalize exercise name for comparison
 * - Convert to lowercase
 * - Expand abbreviations (BB → barbell, DB → dumbbell, KB → kettlebell)
 * - Trim whitespace
 * - Remove special characters
 * - Normalize spacing
 * - Reorder equipment to end for better matching
 */
export function normalizeExerciseName(name: string): string {
  const expanded = expandAbbreviations(name)
    .toLowerCase()
    .trim()
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/[^\w\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
  
  // Reorder equipment to end for better matching
  return reorderEquipmentToEnd(expanded);
}

/**
 * Tokenize exercise name into words
 * Useful for word-by-word comparison
 */
export function tokenize(name: string): string[] {
  const normalized = normalizeExerciseName(name);
  return normalized.split(' ').filter(word => word.length > 0);
}

/**
 * Calculate word overlap between two exercise names
 * Returns the number of matching words
 */
export function calculateWordOverlap(str1: string, str2: string): number {
  const words1 = tokenize(str1);
  const words2 = tokenize(str2);
  
  let matchCount = 0;
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      // Exact word match
      if (word1 === word2) {
        matchCount++;
        break;
      }
      // Partial word match (contains)
      if (word1.includes(word2) || word2.includes(word1)) {
        matchCount += 0.5;
        break;
      }
    }
  }
  
  return matchCount;
}

/**
 * Check if exercise names start with the same word
 */
export function hasSameStartingWord(str1: string, str2: string): boolean {
  const words1 = tokenize(str1);
  const words2 = tokenize(str2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  return words1[0] === words2[0];
}

/**
 * Check if detected name contains equipment keyword
 * Now enhanced to check both original and expanded abbreviations
 */
export function containsEquipment(detectedName: string, equipment: string): boolean {
  const normalized = normalizeExerciseName(detectedName);
  const normalizedEquipment = equipment.toLowerCase();
  
  // Handle common equipment variations
  const equipmentVariations: Record<string, string[]> = {
    'dumbbell': ['db', 'dumbbell', 'dumbell'],
    'barbell': ['bb', 'barbell', 'bar bell'],
    'machine': ['machine', 'mach'],
    'cable': ['cable'],
    'band': ['band', 'banded'],
    'kettlebell': ['kb', 'kettlebell', 'kettle bell'],
    'ez bar': ['ez', 'ez bar', 'ezbar'],
    'smith machine': ['smith', 'smith machine'],
  };
  
  const variations = equipmentVariations[normalizedEquipment] || [normalizedEquipment];
  
  return variations.some(variant => normalized.includes(variant));
}

