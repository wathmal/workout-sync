/**
 * Test file to verify abbreviation handling
 * This can be run to test various abbreviation scenarios
 */

import { normalizeExerciseName, expandAbbreviations } from '../lib/hevy/fuzzy-match';
import { matchExerciseWithEmbeddings as matchExerciseWithFuzzy } from '../lib/hevy/match-server';

/**
 * Test abbreviation expansion
 */
export function testAbbreviations() {
  console.log('\n🧪 Testing Abbreviation Expansion:\n');
  
  const testCases = [
    { input: 'BB Bench Press', expected: 'barbell bench press' },
    { input: 'DB Curl', expected: 'dumbbell curl' },
    { input: 'KB Swing', expected: 'kettlebell swing' },
    { input: 'BB Squat', expected: 'barbell squat' },
    { input: 'DB Press', expected: 'dumbbell press' },
    { input: 'KB Deadlift', expected: 'kettlebell deadlift' },
    { input: 'Bench Press (BB)', expected: 'bench press barbell' },
    { input: 'EZ Bar Curl', expected: 'ez bar curl' },
  ];
  
  testCases.forEach(({ input, expected }) => {
    const result = normalizeExerciseName(input);
    const passed = result === expected;
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} "${input}" → "${result}" ${passed ? '' : `(expected: "${expected}")`}`);
  });
}

/**
 * Test exercise matching with abbreviations
 */
export async function testExerciseMatching() {
  console.log('\n🧪 Testing Exercise Matching with Abbreviations:\n');

  const testCases = [
    'BB Bench Press',
    'DB Bench Press',
    'KB Swing',
    'BB Squat',
    'DB Curl',
    'KB Deadlift',
    'BB Row',
    'DB Shoulder Press',
  ];

  for (const input of testCases) {
    console.log(`\nInput: "${input}"`);
    const match = await matchExerciseWithFuzzy(input);
    console.log(`Match: "${match.title}"`);
    console.log(`Official: ${!match.is_custom}`);
  }
}

/**
 * Test expansion function directly
 */
export function testExpansion() {
  console.log('\n🧪 Testing expandAbbreviations Function:\n');
  
  const testCases = [
    'BB Press',
    'DB Press',
    'KB Swing',
    'EZ Bar Curl',
    'BB + DB Combo',
    'Press (BB)',
  ];
  
  testCases.forEach((input) => {
    const expanded = expandAbbreviations(input);
    console.log(`"${input}" → "${expanded}"`);
  });
}

// Run tests if executed directly
if (typeof window === 'undefined' && require.main === module) {
  testExpansion();
  testAbbreviations();
  void testExerciseMatching();
}

