#!/usr/bin/env tsx
/**
 * Full end-to-end test:
 *   1. Load tests/fixtures/workout-revl-1.jpeg
 *   2. Call Groq vision API to extract workout (same prompt as the app)
 *   3. Run fuzzy + embedding matching pipeline
 *   4. Validate each detected exercise matched something acceptable
 *
 * Usage:
 *   npx tsx --env-file=.env.local tests/e2e/full-e2e.ts
 *   MATCHING_MODE=both EMBEDDING_SOURCE=auto npx tsx --env-file=.env.local tests/e2e/full-e2e.ts
 *
 * Requires:
 *   - GROQ_API_KEY in .env.local
 *   - Pre-built embedding catalogs (npm run build:embeddings:both)
 */

import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import {
  WORKOUT_EXTRACTION_SYSTEM_PROMPT,
  WORKOUT_EXTRACTION_USER_PROMPT,
} from "../../lib/groq/prompts";
import { matchExerciseWithFuzzy } from "../../lib/hevy/exercises";

const IMAGE_PATH = path.join(process.cwd(), "tests", "fixtures", "workout-revl-1.jpeg");

// Expected matches: exercises visible on the workout board.
// Match passes if Hevy match title (lowercased) contains ANY of expectAny.
// Uses broad substrings so it stays stable across model/embedding quirks.
const EXPECTED: Array<{ label: string; expectAny: string[] }> = [
  { label: "BB Bench Press",        expectAny: ["bench press"] },
  { label: "DB RDL",                expectAny: ["romanian deadlift", "deadlift"] },
  { label: "Band Ext Rotation",     expectAny: ["external rotation", "rotation"] },
  { label: "Goblet Squat",          expectAny: ["goblet", "squat"] },
  { label: "DB Lateral Raise",      expectAny: ["lateral raise"] },
  { label: "KB FFE Reverse Lunge",  expectAny: ["lunge", "reverse"] },
  { label: "Alt V-Up",              expectAny: ["v up", "v-up"] },
  { label: "BB RDL",                expectAny: ["romanian deadlift", "deadlift"] },
  { label: "SA KB Thruster",        expectAny: ["thruster"] },
  { label: "Alt DB Plank Row",      expectAny: ["row", "plank"] },
  { label: "BB/DB Hang Power Clean", expectAny: ["clean", "power clean", "hang"] },
  { label: "DB Curl",               expectAny: ["curl"] },
  { label: "Hollow Hold",           expectAny: ["hollow"] },
];

function findExpectation(detected: string): { expectAny: string[]; label: string } | null {
  const d = detected.toLowerCase();
  for (const exp of EXPECTED) {
    const labelLower = exp.label.toLowerCase();
    // direct token overlap
    if (
      d.includes(labelLower) ||
      labelLower.split(/\s+/).every((tok) => tok.length > 2 && d.includes(tok))
    ) {
      return exp;
    }
    // expectAny substring fallback (e.g., Groq returns "Romanian Deadlift")
    if (exp.expectAny.some((e) => d.includes(e.toLowerCase()))) {
      return exp;
    }
  }
  return null;
}

function checkMatch(matchTitle: string, expectAny: string[]): boolean {
  const lower = matchTitle.toLowerCase();
  return expectAny.some((e) => lower.includes(e.toLowerCase()));
}

async function callGroqVision(imageBase64: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set (use --env-file=.env.local)");
  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      { role: "system", content: WORKOUT_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: WORKOUT_EXTRACTION_USER_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_completion_tokens: 2048,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty Groq response");
  return text;
}

async function main() {
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error(`image not found: ${IMAGE_PATH}`);
    process.exit(1);
  }

  console.log(`mode=${process.env.MATCHING_MODE ?? "both"} source=${process.env.EMBEDDING_SOURCE ?? "auto"}`);

  const imageBuf = fs.readFileSync(IMAGE_PATH);
  const imageBase64 = imageBuf.toString("base64");
  console.log(`image: ${(imageBuf.length / 1024).toFixed(1)} KB`);

  console.log("\n[1] calling Groq vision...");
  const tGroqStart = Date.now();
  const groqResponse = await callGroqVision(imageBase64);
  console.log(`    ${Date.now() - tGroqStart}ms`);

  let parsed: { exercises?: Array<{ name?: string; exercise_name?: string }> };
  try {
    parsed = JSON.parse(groqResponse);
  } catch {
    console.error("invalid JSON from Groq:", groqResponse.slice(0, 500));
    process.exit(1);
  }
  console.log(`    detected ${parsed.exercises?.length ?? 0} exercise(s)`);

  console.log("\n[2] matching to Hevy database...");
  const detectedNames: string[] = (parsed.exercises ?? [])
    .map((ex) => ex.name ?? ex.exercise_name ?? "")
    .filter((n) => n.length > 0);

  const tMatchStart = Date.now();
  const results: Array<{
    detected: string;
    matched: string;
    expectation: { label: string; expectAny: string[] } | null;
    pass: boolean;
  }> = [];

  for (const detected of detectedNames) {
    const exercise = await matchExerciseWithFuzzy(detected);
    const matched = exercise.title;
    const expectation = findExpectation(detected);
    const pass = expectation ? checkMatch(matched, expectation.expectAny) : false;
    results.push({ detected, matched, expectation, pass });
  }
  console.log(`    ${Date.now() - tMatchStart}ms total`);

  console.log("\n[3] results:");

  // Print table
  console.log("");
  console.log("status | detected → matched");
  console.log("-".repeat(80));
  let pass = 0;
  let unknown = 0;
  for (const r of results) {
    const tag = r.expectation === null ? "  ???  " : r.pass ? "  ✅   " : "  ❌   ";
    console.log(`${tag}| ${r.detected.padEnd(35)} → ${r.matched}`);
    if (r.expectation === null) unknown++;
    else if (r.pass) pass++;
  }

  console.log("");
  console.log(`detected=${results.length}  expected=${EXPECTED.length}`);
  console.log(`passed=${pass}  failed=${results.length - pass - unknown}  unknown=${unknown}`);

  // Compare against expected exercise count
  if (results.length < EXPECTED.length / 2) {
    console.warn(`\n⚠️  Groq detected only ${results.length} exercises but image has ~${EXPECTED.length}. Vision may be skipping content.`);
  }

  // Exit non-zero if too many failures
  const failures = results.filter((r) => r.expectation !== null && !r.pass).length;
  if (failures > 2) {
    console.error(`\n❌ ${failures} match failures (>2 threshold)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
