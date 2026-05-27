#!/usr/bin/env tsx
/**
 * Side-by-side comparison: fuzzy vs vector vs both for each input.
 * Run: npm run compare:modes
 */

import { matchExerciseImpl } from "../lib/hevy/matching";
import type { CosineLookup } from "../lib/hevy/scoring";
import { computeCosines } from "../lib/embeddings/match";
import { expandAbbreviations } from "../lib/exercise-abbreviations";

const INPUTS = [
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
  "DB Curl",
  "Alt V-Up",
  "KB FFE Reverse Lunge",
  "SA KB Thruster",
  "Alt DB Plank Row",
  "BB/DB Hang Power Clean",
  "Hollow Hold",
];

const COL_INPUT = 28;
const COL_RESULT = 38;

function pad(s: string, w: number): string {
  if (s.length > w) return s.slice(0, w - 1) + "…";
  return s.padEnd(w);
}

async function main() {
  const header =
    pad("input", COL_INPUT) +
    "│ " +
    pad("fuzzy", COL_RESULT) +
    "│ " +
    pad("vector", COL_RESULT) +
    "│ " +
    pad("both", COL_RESULT);
  console.log("\n" + header);
  console.log("─".repeat(header.length));

  for (const input of INPUTS) {
    // Compute cosines once per input (used by vector + both)
    let cosines: CosineLookup | null = null;
    try {
      cosines = await computeCosines(expandAbbreviations(input));
    } catch (err) {
      console.error(`cosine failed for "${input}":`, err);
    }

    // Silence the chatty matcher logs for the comparison table
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    let fuzzy = "—";
    let vector = "—";
    let both = "—";
    try {
      fuzzy = (await matchExerciseImpl(input, "fuzzy", null)).title;
    } catch (e) {
      fuzzy = `error: ${(e as Error).message}`;
    }
    try {
      vector = cosines
        ? (await matchExerciseImpl(input, "vector", cosines)).title
        : "no-cosines";
    } catch (e) {
      vector = `error: ${(e as Error).message}`;
    }
    try {
      both = cosines
        ? (await matchExerciseImpl(input, "both", cosines)).title
        : "no-cosines";
    } catch (e) {
      both = `error: ${(e as Error).message}`;
    }

    console.log = origLog;
    console.warn = origWarn;

    const fuzzyMark = fuzzy === both ? " " : "≠";
    const vectorMark = vector === both ? " " : "≠";

    console.log(
      pad(input, COL_INPUT) +
        "│ " +
        pad(`${fuzzyMark} ${fuzzy}`, COL_RESULT) +
        "│ " +
        pad(`${vectorMark} ${vector}`, COL_RESULT) +
        "│ " +
        pad(`  ${both}`, COL_RESULT),
    );
  }
  console.log("\n≠ = differs from blended (both) result\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
