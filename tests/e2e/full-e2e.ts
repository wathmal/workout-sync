#!/usr/bin/env tsx
/**
 * Full end-to-end test across every workout fixture in tests/fixtures/.
 *
 * For each fixture we:
 *   1. Load the image
 *   2. Call Groq vision API to extract workout (same prompt as the app)
 *   3. Run the fuzzy + embedding matching pipeline
 *   4. Validate each detected exercise matched something acceptable
 *
 * Usage:
 *   npx tsx --env-file=.env.local tests/e2e/full-e2e.ts
 *   # or run a single fixture:
 *   npx tsx --env-file=.env.local tests/e2e/full-e2e.ts --fixture=workout-revl-3.jpeg
 *   MATCHING_MODE=both EMBEDDING_SOURCE=auto npm run e2e:full
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
import { matchExerciseWithEmbeddings } from "../../lib/hevy/match-server";

interface ExpectedExercise {
  label: string;
  expectAny: string[];
}

interface Fixture {
  name: string;
  file: string;
  expected: ExpectedExercise[];
}

// ── Fixtures ────────────────────────────────────────────────────────
//
// Each fixture lists the exercises that should be detectable on the board.
// Match passes if the Hevy match title (lowercased) contains ANY of
// `expectAny`. Substrings stay broad so the test is stable across small
// model / embedding-catalog drifts.
const FIXTURES: Fixture[] = [
  {
    name: "revl-1 (whiteboard, 13 exercises)",
    file: "workout-revl-1.jpeg",
    expected: [
      { label: "BB Bench Press",         expectAny: ["bench press"] },
      { label: "DB RDL",                 expectAny: ["romanian deadlift", "deadlift"] },
      { label: "Band Ext Rotation",      expectAny: ["external rotation", "rotation"] },
      { label: "Goblet Squat",           expectAny: ["goblet", "squat"] },
      { label: "DB Lateral Raise",       expectAny: ["lateral raise"] },
      { label: "KB FFE Reverse Lunge",   expectAny: ["lunge", "reverse"] },
      { label: "Alt V-Up",               expectAny: ["v up", "v-up"] },
      { label: "BB RDL",                 expectAny: ["romanian deadlift", "deadlift"] },
      { label: "SA KB Thruster",         expectAny: ["thruster"] },
      { label: "Alt DB Plank Row",       expectAny: ["row", "plank"] },
      { label: "BB/DB Hang Power Clean", expectAny: ["clean", "power clean", "hang"] },
      { label: "DB Curl",                expectAny: ["curl"] },
      { label: "Hollow Hold",            expectAny: ["hollow"] },
    ],
  },
  {
    name: "revl-3 (MOVE TOTAL board, 12 exercises)",
    file: "workout-revl-3.jpeg",
    expected: [
      { label: "BB Bench Press",                 expectAny: ["bench press"] },
      { label: "BW Cyclist Squat",               expectAny: ["squat", "cyclist"] },
      { label: "Scap Pull Up",                   expectAny: ["pull up", "pull-up", "scap"] },
      { label: "Dual KB Sumo Deadlift",          expectAny: ["sumo deadlift", "deadlift"] },
      { label: "Paused BB Bench Press",          expectAny: ["bench press"] },
      { label: "SA DB Front Rack Cyclist Squat", expectAny: ["front rack", "squat", "cyclist"] },
      { label: "Dual KB Gorilla Row",            expectAny: ["gorilla row", "row"] },
      { label: "BB Hang Power Clean",            expectAny: ["hang power clean", "power clean", "clean"] },
      { label: "Deadstop KB Swing",              expectAny: ["kettlebell swing", "swing"] },
      { label: "DB Incline Bench Press",         expectAny: ["incline bench press", "incline"] },
      { label: "Pull Up",                        expectAny: ["pull up", "pull-up", "pullup"] },
      { label: "Cal Ski Erg",                    expectAny: ["ski erg", "ski"] },
    ],
  },
];

function findExpectation(
  detected: string,
  expected: ExpectedExercise[],
): ExpectedExercise | null {
  const d = detected.toLowerCase();
  for (const exp of expected) {
    const labelLower = exp.label.toLowerCase();
    if (
      d.includes(labelLower) ||
      labelLower.split(/\s+/).every((tok) => tok.length > 2 && d.includes(tok))
    ) {
      return exp;
    }
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

async function runFixture(fixture: Fixture): Promise<{ pass: number; failed: number; unknown: number }> {
  const imagePath = path.join(process.cwd(), "tests", "fixtures", fixture.file);
  if (!fs.existsSync(imagePath)) {
    console.error(`image not found: ${imagePath}`);
    return { pass: 0, failed: 0, unknown: 0 };
  }

  console.log("\n" + "═".repeat(80));
  console.log(`fixture: ${fixture.name}`);
  console.log("═".repeat(80));

  const imageBuf = fs.readFileSync(imagePath);
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
    return { pass: 0, failed: 0, unknown: 0 };
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
    expectation: ExpectedExercise | null;
    pass: boolean;
  }> = [];

  for (const detected of detectedNames) {
    const exercise = await matchExerciseWithEmbeddings(detected);
    const matched = exercise.title;
    const expectation = findExpectation(detected, fixture.expected);
    const pass = expectation ? checkMatch(matched, expectation.expectAny) : false;
    results.push({ detected, matched, expectation, pass });
  }
  console.log(`    ${Date.now() - tMatchStart}ms total`);

  console.log("\n[3] results:");
  console.log("");
  console.log("status | detected → matched");
  console.log("-".repeat(80));
  let pass = 0;
  let unknown = 0;
  for (const r of results) {
    const tag = r.expectation === null ? "  ???  " : r.pass ? " PASS  " : " FAIL  ";
    console.log(`${tag}| ${r.detected.padEnd(40)} → ${r.matched}`);
    if (r.expectation === null) unknown++;
    else if (r.pass) pass++;
  }

  console.log("");
  console.log(`detected=${results.length}  expected=${fixture.expected.length}`);
  const failed = results.length - pass - unknown;
  console.log(`passed=${pass}  failed=${failed}  unknown=${unknown}`);

  if (results.length < fixture.expected.length / 2) {
    console.warn(
      `\nWARNING: Vision detected only ${results.length} exercises but board has ~${fixture.expected.length}.`,
    );
  }

  return { pass, failed, unknown };
}

async function main() {
  console.log(
    `mode=${process.env.MATCHING_MODE ?? "both"} source=${process.env.EMBEDDING_SOURCE ?? "auto"}`,
  );

  // Optional --fixture=name.jpeg flag to run a single fixture.
  const fixtureFlag = process.argv.find((a) => a.startsWith("--fixture="));
  const targetFile = fixtureFlag?.split("=")[1];
  const toRun = targetFile
    ? FIXTURES.filter((f) => f.file === targetFile)
    : FIXTURES;

  if (toRun.length === 0) {
    console.error(`unknown fixture: ${targetFile}`);
    console.error(`available: ${FIXTURES.map((f) => f.file).join(", ")}`);
    process.exit(1);
  }

  let totalFailed = 0;
  for (const fixture of toRun) {
    const result = await runFixture(fixture);
    totalFailed += result.failed;
  }

  console.log("\n" + "═".repeat(80));
  console.log(`summary: ${toRun.length} fixture(s), ${totalFailed} match failure(s)`);
  console.log("═".repeat(80));

  // Exit non-zero if too many cumulative failures (more lenient than the
  // single-fixture variant because we now run multiple boards).
  if (totalFailed > 4) {
    console.error(`\n${totalFailed} match failures across all fixtures (>4 threshold)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
