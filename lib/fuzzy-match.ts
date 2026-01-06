/**
 * Fuzzy matching utilities for exercise name matching
 * Implements Levenshtein distance algorithm for string similarity
 */

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
 * Equipment abbreviation mapping
 * Maps abbreviations to their full names for better matching
 */
const EQUIPMENT_ABBREVIATIONS: Record<string, string> = {
  'bb': 'barbell',
  'db': 'dumbbell',
  'kb': 'kettlebell',
  'ez': 'ez bar',
  'sz': 'sz bar',
  'swiss': 'swiss bar',
  'trap': 'trap bar',
};

/**
 * Exercise name abbreviation mapping
 * Maps common exercise abbreviations to their full names
 */
const EXERCISE_ABBREVIATIONS: Record<string, string> = {
  'tbt': 'toes to bar',
  'ttb': 'toes to bar',
  'tth': 'toe touch',
  'k2c': 'knee to chest',
  'k2k': 'knee to knee',
  'k2e': 'knee to elbow',
  'hkr': 'hanging knee raise',
  'lkr': 'lying knee raise',
  'bp': 'bench press',
  'sp': 'shoulder press',
  'ohp': 'overhead press',
  'dl': 'deadlift',
  'sq': 'squat',
  'row': 'row',
  'curl': 'curl',
  'ext': 'extension',
  'press': 'press',
};

/**
 * Expand equipment abbreviations in exercise name
 * Converts "BB Bench Press" to "Barbell Bench Press"
 */
export function expandAbbreviations(name: string): string {
  let expanded = name.toLowerCase().trim();
  
  // Handle slash-separated equipment abbreviations at the start (BB/DB Curl → BB Curl)
  // Check if the first part before slash is an equipment abbreviation
  const slashPattern = /^([a-z]+)\/([a-z]+)\s/i;
  const slashMatch = expanded.match(slashPattern);
  if (slashMatch) {
    const firstPart = slashMatch[1];
    const secondPart = slashMatch[2];
    
    // Check if both parts are equipment abbreviations
    const isFirstEquipment = firstPart in EQUIPMENT_ABBREVIATIONS;
    const isSecondEquipment = secondPart in EQUIPMENT_ABBREVIATIONS;
    
    // If both are equipment abbreviations, take only the first one
    if (isFirstEquipment && isSecondEquipment) {
      expanded = expanded.replace(slashPattern, '$1 ');
    }
  }
  
  // Handle slash-separated compound exercises (TBT/TTH/K2C → try each part)
  // Check if this looks like multiple exercises separated by slashes
  const slashParts = expanded.split('/').map(p => p.trim()).filter(p => p.length > 0);
  if (slashParts.length > 1) {
    // For compound abbreviations, try to expand each part
    // This helps with cases like "TBT/TTH/K2C" → "toes to bar / toe touch / knee to chest"
    const expandedParts = slashParts.map(part => {
      let partExpanded = part;
      
      // Try exercise abbreviations first
      Object.entries(EXERCISE_ABBREVIATIONS).forEach(([abbr, full]) => {
        const regex = new RegExp(`^${abbr}$`, 'i');
        if (regex.test(partExpanded)) {
          partExpanded = full;
        }
      });
      
      // Then try equipment abbreviations
      Object.entries(EQUIPMENT_ABBREVIATIONS).forEach(([abbr, full]) => {
        if (abbr === 'ez' || abbr === 'sz') {
          const regex = new RegExp(`\\b${abbr}\\b(?!\\s+bar)`, 'gi');
          partExpanded = partExpanded.replace(regex, full);
        } else {
          const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
          partExpanded = partExpanded.replace(regex, full);
        }
      });
      
      return partExpanded;
    });
    
    // Join with space (will try to match any of these)
    expanded = expandedParts.join(' ');
  } else {
    // Special handling for multi-word equipment (EZ Bar, SZ Bar)
    // Replace "ez bar", "sz bar" patterns first to avoid duplication
    expanded = expanded.replace(/\bez\s+bar\b/gi, 'ez bar');
    expanded = expanded.replace(/\bsz\s+bar\b/gi, 'sz bar');
  
    // Try exercise abbreviations first
    Object.entries(EXERCISE_ABBREVIATIONS).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      expanded = expanded.replace(regex, full);
    });
    
    // Then replace equipment abbreviations
    Object.entries(EQUIPMENT_ABBREVIATIONS).forEach(([abbr, full]) => {
      // Skip if this abbreviation is part of a multi-word equipment we already handled
      if (abbr === 'ez' || abbr === 'sz') {
        // Only replace if not followed by "bar"
        const regex = new RegExp(`\\b${abbr}\\b(?!\\s+bar)`, 'gi');
        expanded = expanded.replace(regex, full);
      } else {
        // Match abbreviation as whole word (with word boundaries)
        const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
        expanded = expanded.replace(regex, full);
      }
    });
  }
  
  return expanded;
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

