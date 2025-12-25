/**
 * Manual test script to demonstrate the matching improvements
 * Run this to see how "DB Curl" now matches "Bicep Curl (Dumbbell)"
 */

import { normalizeExerciseName, calculateSimilarity, calculateWordOverlap } from './fuzzy-match';
import { matchExerciseWithFuzzy, calculateMatchScore, HEVY_EXERCISES } from './hevy-exercises';

console.log('='.repeat(80));
console.log('EXERCISE MATCHING IMPROVEMENTS TEST');
console.log('='.repeat(80));

// Test cases that were previously failing
const testCases = [
  { detected: 'DB Curl', expected: 'Bicep Curl (Dumbbell)' },
  { detected: 'BB Curl', expected: 'Bicep Curl (Barbell)' },
  { detected: 'BB/DB Curl', expected: 'Bicep Curl (Barbell)' },
  { detected: 'BB Bench Press', expected: 'Bench Press (Barbell)' },
  { detected: 'DB Bench Press', expected: 'Bench Press (Dumbbell)' },
  { detected: 'KB Swing', expected: 'Kettlebell Swing' },
  { detected: 'Cable Row', expected: 'Row (Cable)' },
];

testCases.forEach(({ detected, expected }) => {
  console.log('\n' + '-'.repeat(80));
  console.log(`Testing: "${detected}" → "${expected}"`);
  console.log('-'.repeat(80));
  
  // Show normalization
  const normalizedDetected = normalizeExerciseName(detected);
  const normalizedExpected = normalizeExerciseName(expected);
  console.log(`Normalized detected: "${normalizedDetected}"`);
  console.log(`Normalized expected: "${normalizedExpected}"`);
  
  // Calculate metrics
  const similarity = calculateSimilarity(detected, expected);
  const wordOverlap = calculateWordOverlap(detected, expected);
  
  console.log(`\nMetrics:`);
  console.log(`  Similarity: ${similarity}%`);
  console.log(`  Word Overlap: ${wordOverlap}`);
  
  // Find actual match in database
  const match = matchExerciseWithFuzzy(detected);
  console.log(`\nActual Match: "${match.title}"`);
  
  // Find the expected exercise in database and calculate its score
  const expectedExercise = HEVY_EXERCISES.find(ex => ex.title === expected);
  if (expectedExercise) {
    const score = calculateMatchScore(detected, expectedExercise);
    console.log(`Score for expected match: ${Math.round(score)}`);
  }
  
  // Check if it's the correct match
  const isCorrect = match.title === expected;
  console.log(`\n✓ Result: ${isCorrect ? '✅ CORRECT MATCH' : '❌ INCORRECT MATCH'}`);
});

console.log('\n' + '='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80));

