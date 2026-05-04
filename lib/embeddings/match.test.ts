/**
 * Test the matching mode resolution and graceful degradation.
 * We do NOT exercise the real provider here (no LM Studio / no model download in CI).
 */
import { getMatchingMode } from "./match";

describe("getMatchingMode", () => {
  const original = process.env.MATCHING_MODE;
  afterEach(() => {
    if (original === undefined) delete process.env.MATCHING_MODE;
    else process.env.MATCHING_MODE = original;
  });

  it("defaults to 'both' when unset", () => {
    delete process.env.MATCHING_MODE;
    expect(getMatchingMode()).toBe("both");
  });

  it("respects 'fuzzy'", () => {
    process.env.MATCHING_MODE = "fuzzy";
    expect(getMatchingMode()).toBe("fuzzy");
  });

  it("respects 'vector'", () => {
    process.env.MATCHING_MODE = "vector";
    expect(getMatchingMode()).toBe("vector");
  });

  it("respects 'both'", () => {
    process.env.MATCHING_MODE = "both";
    expect(getMatchingMode()).toBe("both");
  });

  it("falls back to 'both' on invalid value", () => {
    process.env.MATCHING_MODE = "nonsense";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(getMatchingMode()).toBe("both");
    warn.mockRestore();
  });

  it("is case-insensitive", () => {
    process.env.MATCHING_MODE = "FUZZY";
    expect(getMatchingMode()).toBe("fuzzy");
  });
});
