/**
 * Sanity checks for the bundled Hevy catalog. The catalog is regenerated
 * by `npm run refresh:hevy` (see scripts/refresh-hevy-catalog.ts) and
 * imported via lib/data/hevy-exercises/catalog.json. These assertions
 * guard against a refresh run that produces a malformed file or
 * inadvertently drops the developer's customs.
 */

import { HEVY_EXERCISES, getExerciseCount, getExerciseStats } from "./catalog";
import catalog from "../data/hevy-exercises/catalog.json";

describe("Hevy catalog", () => {
  it("has exercises loaded", () => {
    expect(getExerciseCount()).toBeGreaterThan(0);
  });

  it("matches the catalog.json total field", () => {
    expect(getExerciseCount()).toBe(catalog.total);
    expect(catalog.exercise_templates.length).toBe(catalog.total);
  });

  it("includes both official and custom exercises", () => {
    const stats = getExerciseStats();
    expect(stats.official).toBeGreaterThan(0);
    expect(stats.custom).toBeGreaterThan(0);
    expect(stats.official + stats.custom).toBe(stats.total);
  });

  it("is sorted by id (deterministic diffs across refresh runs)", () => {
    for (let i = 1; i < HEVY_EXERCISES.length; i++) {
      const prev = HEVY_EXERCISES[i - 1].id;
      const curr = HEVY_EXERCISES[i].id;
      expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
    }
  });

  it("every entry has the fields the matcher relies on", () => {
    for (const ex of HEVY_EXERCISES) {
      expect(typeof ex.id).toBe("string");
      expect(ex.id.length).toBeGreaterThan(0);
      expect(typeof ex.title).toBe("string");
      expect(ex.title.length).toBeGreaterThan(0);
      expect(typeof ex.type).toBe("string");
      expect(typeof ex.is_custom).toBe("boolean");
      expect(Array.isArray(ex.secondary_muscle_groups)).toBe(true);
    }
  });

  it("includes the bench press fixture used by e2e tests", () => {
    const benchPress = HEVY_EXERCISES.find(
      (e) => !e.is_custom && /^bench press \(barbell\)$/i.test(e.title),
    );
    expect(benchPress).toBeDefined();
  });
});
