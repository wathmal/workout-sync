/**
 * Tests for the matching kernel (exact → compound → fuzzy+threshold → fallback).
 *
 * Catalog-driven: uses the bundled Hevy catalog. Assertions name titles that
 * are stable across catalog refreshes (long-standing official exercises).
 */

import {
  matchExerciseImpl,
  matchExerciseImplScored,
  searchExercisesScored,
} from "./matching";
import { SCORE_CAP, SCORE_THRESHOLD } from "./scoring";

describe("matchExerciseImplScored — exact match", () => {
  it("returns SCORE_CAP for a verbatim catalog title", async () => {
    const result = await matchExerciseImplScored(
      "Bench Press (Barbell)",
      "fuzzy",
      null,
    );
    expect(result.exercise.title).toBe("Bench Press (Barbell)");
    expect(result.score).toBe(SCORE_CAP);
  });

  it("normalizes case + whitespace before exact match", async () => {
    const result = await matchExerciseImplScored(
      "  bench press (barbell)  ",
      "fuzzy",
      null,
    );
    expect(result.exercise.title).toBe("Bench Press (Barbell)");
    expect(result.score).toBe(SCORE_CAP);
  });
});

describe("matchExerciseImplScored — compound (slash-split)", () => {
  it("prefers the first part of 'BB/DB Curl' over a full-string fuzzy match", async () => {
    const result = await matchExerciseImpl("BB/DB Curl", "fuzzy", null);
    // First part "BB Curl" → expands to barbell curl, picks Bicep Curl (Barbell).
    expect(result.title.toLowerCase()).toContain("curl");
    expect(result.title.toLowerCase()).toContain("barbell");
  });

  it("falls through to full-string when first part is equipment-only", async () => {
    // "Barbell" alone is equipment-only — kernel must NOT trust it as a
    // standalone exercise; should score the whole string instead.
    const result = await matchExerciseImpl("Barbell/Bench Press", "fuzzy", null);
    expect(result.title.toLowerCase()).toContain("bench");
  });

  it("ignores slash-split when there's only one part", async () => {
    const result = await matchExerciseImplScored("Bench Press", "fuzzy", null);
    expect(result.exercise.title.toLowerCase()).toContain("bench");
  });
});

describe("matchExerciseImplScored — threshold + fallback", () => {
  it("returns the best available match even when nothing crosses SCORE_THRESHOLD", async () => {
    // Gibberish: every score should land far below SCORE_THRESHOLD.
    // Kernel must still return a best-available match rather than throwing.
    const result = await matchExerciseImplScored("xyzqwerty zzz", "fuzzy", null);
    expect(result.exercise).toBeDefined();
    expect(result.exercise.title).toBeTruthy();
    expect(result.score).toBeLessThan(SCORE_THRESHOLD);
  });
});

describe("searchExercisesScored", () => {
  it("returns up to limit results, sorted with officials first", () => {
    const results = searchExercisesScored("bench press", { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    // Top result for "bench press" must be an official (non-custom).
    expect(results[0].exercise.is_custom).toBe(false);
  });

  it("returns full catalog for empty query (no filter)", () => {
    const results = searchExercisesScored("", { limit: 1000 });
    expect(results.length).toBeGreaterThan(100);
  });

  it("filters by kind=custom", () => {
    const results = searchExercisesScored("", { limit: 1000, kind: "custom" });
    expect(results.every((r) => r.exercise.is_custom)).toBe(true);
  });

  it("filters by kind=official", () => {
    const results = searchExercisesScored("bench", { limit: 50, kind: "official" });
    expect(results.every((r) => !r.exercise.is_custom)).toBe(true);
  });
});
