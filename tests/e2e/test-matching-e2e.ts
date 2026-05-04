#!/usr/bin/env tsx
/**
 * Quick end-to-end check of matching against a few test inputs.
 * Run: tsx tests/e2e/test-matching-e2e.ts
 *      MATCHING_MODE=both tsx tests/e2e/test-matching-e2e.ts
 *      MATCHING_MODE=fuzzy tsx tests/e2e/test-matching-e2e.ts
 *      MATCHING_MODE=vector tsx tests/e2e/test-matching-e2e.ts
 *      EMBEDDING_SOURCE=lm-studio tsx tests/e2e/test-matching-e2e.ts
 *      EMBEDDING_SOURCE=transformers tsx tests/e2e/test-matching-e2e.ts
 */
import { matchExerciseWithEmbeddings } from "../../lib/hevy/match-server";

const TESTS = [
  "Bench Press (Barbell)",
  "BB Bench Press",
  "DB Bench Press",
  "BB Hip Thrust",
  "Glute Bridge Machine",
  "RDL",
  "Romanian Deadlift",
  "OHP",
  "Overhead Press",
  "leg press machine",
  "chest fly cable",
  "Pec Deck",
  "BB/DB Curl",
  "TBT/TTH/K2C",
];

async function main() {
  console.log(`\n--- mode=${process.env.MATCHING_MODE ?? "both"} source=${process.env.EMBEDDING_SOURCE ?? "auto"} ---\n`);
  for (const input of TESTS) {
    const start = Date.now();
    const m = await matchExerciseWithEmbeddings(input);
    const ms = Date.now() - start;
    console.log(`[${ms.toString().padStart(4)}ms] "${input}" → "${m.title}"`);
  }
}

main().catch(console.error);
