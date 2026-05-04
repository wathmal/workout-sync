/**
 * Verify hevy-exercises matching with MATCHING_MODE=fuzzy preserves
 * the existing behavior, and with mode=both/vector still resolves
 * to a reasonable match.
 *
 * EMBEDDING_SOURCE is forced 'off' so no model is loaded in CI.
 */

const ORIG_MODE = process.env.MATCHING_MODE;
const ORIG_SOURCE = process.env.EMBEDDING_SOURCE;

afterAll(() => {
  if (ORIG_MODE === undefined) delete process.env.MATCHING_MODE;
  else process.env.MATCHING_MODE = ORIG_MODE;
  if (ORIG_SOURCE === undefined) delete process.env.EMBEDDING_SOURCE;
  else process.env.EMBEDDING_SOURCE = ORIG_SOURCE;
});

describe("matchExerciseWithFuzzy with embedding off", () => {
  beforeAll(() => {
    process.env.EMBEDDING_SOURCE = "off";
    process.env.MATCHING_MODE = "fuzzy";
  });

  it("returns same exercise as legacy fuzzy path for known names", async () => {
    jest.resetModules();
    const { matchExerciseWithFuzzy } = await import("../hevy/exercises");
    const result = await matchExerciseWithFuzzy("Bench Press (Barbell)");
    expect(result.title.toLowerCase()).toContain("bench press");
  });

  it("matches abbreviated names", async () => {
    jest.resetModules();
    const { matchExerciseWithFuzzy } = await import("../hevy/exercises");
    const result = await matchExerciseWithFuzzy("DB Bench Press");
    expect(result.title.toLowerCase()).toContain("bench press");
    expect(result.title.toLowerCase()).toContain("dumbbell");
  });
});

describe("matchExerciseWithFuzzy with vector mode but source off", () => {
  beforeAll(() => {
    process.env.EMBEDDING_SOURCE = "off";
    process.env.MATCHING_MODE = "vector";
  });

  it("gracefully degrades to fuzzy when no embedding source", async () => {
    jest.resetModules();
    const { matchExerciseWithFuzzy } = await import("../hevy/exercises");
    const result = await matchExerciseWithFuzzy("Bench Press (Barbell)");
    expect(result.title.toLowerCase()).toContain("bench press");
  });
});
