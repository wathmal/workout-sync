import { lastResultDurationMin, parseDurationMin, type RaceEvent } from "./types";

describe("parseDurationMin", () => {
  it("parses H:MM:SS results", () => {
    expect(parseDurationMin("2:02:11")).toBe(122);
    expect(parseDurationMin("02:02:11")).toBe(122);
    expect(parseDurationMin("1:50:30")).toBe(111); // 110.5 rounds up
  });

  it("parses two-part times: H:MM when hours are plausible, MM:SS otherwise", () => {
    expect(parseDurationMin("1:50")).toBe(110);
    expect(parseDurationMin("sub 1:30")).toBe(90);
    expect(parseDurationMin("45:00")).toBe(45); // 45h race target implausible
  });

  it("parses hour and minute phrasing", () => {
    expect(parseDurationMin("sub 2h")).toBe(120);
    expect(parseDurationMin("1.5h")).toBe(90);
    expect(parseDurationMin("90 min")).toBe(90);
  });

  it("returns null for empty or unparseable text", () => {
    expect(parseDurationMin(null)).toBeNull();
    expect(parseDurationMin(undefined)).toBeNull();
    expect(parseDurationMin("")).toBeNull();
    expect(parseDurationMin("top 100 AG")).toBeNull();
  });
});

describe("lastResultDurationMin", () => {
  const race = (over: Partial<RaceEvent>): RaceEvent => ({
    id: "x",
    name: "race",
    date: "2026-01-01",
    category: "hyrox",
    eventTarget: null,
    location: null,
    note: null,
    resultTime: null,
    resultPlacement: null,
    resultNote: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  });

  it("returns the most recent completed result in the category", () => {
    const races = [
      race({ id: "a", date: "2025-11-01", resultTime: "1:55:00" }),
      race({ id: "b", date: "2026-06-14", resultTime: "2:02:11" }),
      race({ id: "c", date: "2026-07-20" }), // upcoming, no result
      race({ id: "d", date: "2026-06-20", category: "running", resultTime: "45:00" }),
    ];
    expect(lastResultDurationMin(races, "hyrox")).toBe(122);
    expect(lastResultDurationMin(races, "running")).toBe(45);
  });

  it("returns null when the category has no parseable result", () => {
    expect(lastResultDurationMin([race({})], "hyrox")).toBeNull();
    expect(lastResultDurationMin([race({ resultTime: "DNF" })], "hyrox")).toBeNull();
    expect(lastResultDurationMin([], "hyrox")).toBeNull();
  });
});
