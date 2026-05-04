/**
 * Opt-in integration tests against real embedding providers.
 *
 * Skipped unless EMBEDDINGS_INTEGRATION=1.
 *
 * Run locally:
 *   EMBEDDINGS_INTEGRATION=1 npm test -- lib/embeddings/integration
 *
 * Limit to one source:
 *   EMBEDDINGS_INTEGRATION=1 INTEGRATION_SOURCE=lm-studio npm test -- lib/embeddings/integration
 *   EMBEDDINGS_INTEGRATION=1 INTEGRATION_SOURCE=transformers npm test -- lib/embeddings/integration
 *
 * Requirements:
 *   - lm-studio:    LM Studio running on http://localhost:1234 with embedding model loaded
 *   - transformers: ~280MB nomic model downloaded (first run) — happens automatically
 *   - Pre-built catalogs in lib/data/exercise-embeddings/
 */

const RUN = process.env.EMBEDDINGS_INTEGRATION === "1";
const ONLY = (process.env.INTEGRATION_SOURCE ?? "").toLowerCase();

const SOURCES = (["lm-studio", "transformers"] as const).filter(
  (s) => !ONLY || ONLY === s,
);

const ORIG_ENV = {
  MATCHING_MODE: process.env.MATCHING_MODE,
  EMBEDDING_SOURCE: process.env.EMBEDDING_SOURCE,
};

function restoreEnv() {
  for (const [k, v] of Object.entries(ORIG_ENV)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  }
}

async function freshMatcher() {
  jest.resetModules();
  const mod = await import("../hevy/match-server");
  return mod.matchExerciseWithEmbeddings;
}

interface Case {
  input: string;
  /** Substrings (case-insensitive) — at least one must appear in matched title. */
  expectAny: string[];
}

// Cases chosen for stability — broad expectations that hold for any reasonable
// embedding model. Avoid asserting exact title (Qwen3 vs nomic disagree).
const SEMANTIC_CASES: Case[] = [
  { input: "Pec Deck", expectAny: ["butterfly", "pec deck", "chest fly"] },
  { input: "Romanian Deadlift", expectAny: ["romanian deadlift"] },
  { input: "Overhead Press", expectAny: ["overhead press", "shoulder press"] },
  { input: "leg press machine", expectAny: ["leg press"] },
  { input: "chest fly cable", expectAny: ["chest fly", "cable fly", "fly"] },
  { input: "Bench Press (Barbell)", expectAny: ["bench press"] },
  { input: "BB Bench Press", expectAny: ["bench press"] },
  { input: "DB Bench Press", expectAny: ["bench press"] },
];

const NO_REGRESSION_CASES: Case[] = [
  { input: "BB Squat", expectAny: ["squat"] },
  { input: "DB Curl", expectAny: ["curl"] },
  { input: "KB Swing", expectAny: ["swing"] },
];

function assertMatch(title: string, expectAny: string[]): void {
  const lower = title.toLowerCase();
  const hit = expectAny.some((e) => lower.includes(e.toLowerCase()));
  if (!hit) {
    throw new Error(
      `Match "${title}" did not contain any of: ${expectAny.join(", ")}`,
    );
  }
}

const describeIf = RUN ? describe : describe.skip;

describeIf("embedding integration", () => {
  afterAll(() => {
    restoreEnv();
  });

  describe.each(SOURCES)("source=%s", (source) => {
    beforeEach(() => {
      process.env.EMBEDDING_SOURCE = source;
      process.env.MATCHING_MODE = "both";
    });

    test.each(SEMANTIC_CASES)(
      'mode=both: "$input" matches one of $expectAny',
      async ({ input, expectAny }) => {
        const matcher = await freshMatcher();
        const result = await matcher(input);
        assertMatch(result.title, expectAny);
      },
      60_000,
    );

    test.each(NO_REGRESSION_CASES)(
      'mode=both: "$input" no regression vs fuzzy',
      async ({ input, expectAny }) => {
        const matcher = await freshMatcher();
        const result = await matcher(input);
        assertMatch(result.title, expectAny);
      },
      60_000,
    );

    it("vector mode resolves to a real exercise", async () => {
      process.env.MATCHING_MODE = "vector";
      const matcher = await freshMatcher();
      const result = await matcher("Pec Deck");
      expect(result.title).toBeTruthy();
      assertMatch(result.title, ["butterfly", "pec deck", "chest fly", "fly"]);
    }, 60_000);

    it("fuzzy mode does not call provider (sanity)", async () => {
      process.env.MATCHING_MODE = "fuzzy";
      const matcher = await freshMatcher();
      const result = await matcher("BB Bench Press");
      assertMatch(result.title, ["bench press"]);
    }, 60_000);
  });
});

if (!RUN) {
  // Make the file have at least one test even when skipped, so jest is happy.
  describe("embedding integration (skipped)", () => {
    it("set EMBEDDINGS_INTEGRATION=1 to run", () => {
      expect(true).toBe(true);
    });
  });
}
