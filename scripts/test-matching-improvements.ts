/**
 * Manual test script to demonstrate the matching improvements
 * Run this to see how "DB Curl" now matches "Bicep Curl (Dumbbell)"
 */

import { normalizeExerciseName, calculateSimilarity, calculateWordOverlap } from '../lib/hevy/fuzzy-match';
import { matchExerciseWithFuzzy, calculateMatchScore, HEVY_EXERCISES } from '../lib/hevy/exercises';

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

async function runTests() {
  for (const { detected, expected } of testCases) {
    console.log('\n' + '-'.repeat(80));
    console.log(`Testing: "${detected}" → "${expected}"`);
    console.log('-'.repeat(80));

    const normalizedDetected = normalizeExerciseName(detected);
    const normalizedExpected = normalizeExerciseName(expected);
    console.log(`Normalized detected: "${normalizedDetected}"`);
    console.log(`Normalized expected: "${normalizedExpected}"`);

    const similarity = calculateSimilarity(detected, expected);
    const wordOverlap = calculateWordOverlap(detected, expected);

    console.log(`\nMetrics:`);
    console.log(`  Similarity: ${similarity}%`);
    console.log(`  Word Overlap: ${wordOverlap}`);

    const match = await matchExerciseWithFuzzy(detected);
    console.log(`\nActual Match: "${match.title}"`);

    const expectedExercise = HEVY_EXERCISES.find(ex => ex.title === expected);
    if (expectedExercise) {
      const score = calculateMatchScore(detected, expectedExercise);
      console.log(`Score for expected match: ${Math.round(score)}`);
    }

    const isCorrect = match.title === expected;
    console.log(`\n✓ Result: ${isCorrect ? '✅ CORRECT MATCH' : '❌ INCORRECT MATCH'}`);
  }
}

void runTests();

console.log('\n' + '='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80));

