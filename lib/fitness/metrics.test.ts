import { vdotFromRace } from "./vdot";
import { uthVo2max } from "./uth";
import { fitnessIndex } from "./fitness-index";

describe("vdotFromRace", () => {
  it("derives VDOT from a predicted 10K (46:38 → ~43.4)", () => {
    const v = vdotFromRace(2798, 10000);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(42.5);
    expect(v!).toBeLessThan(44.5);
  });
  it("rejects bad input", () => {
    expect(vdotFromRace(null, 10000)).toBeNull();
    expect(vdotFromRace(0, 10000)).toBeNull();
    expect(vdotFromRace(2798, 0)).toBeNull();
  });
});

describe("uthVo2max", () => {
  it("matches Garmin native on this account (RHR 58 → ~51.4)", () => {
    expect(uthVo2max(58)).toBeCloseTo(51.4, 1);
  });
  it("rises as resting HR falls", () => {
    expect(uthVo2max(50)!).toBeGreaterThan(uthVo2max(62)!);
  });
  it("rejects bad input", () => {
    expect(uthVo2max(null)).toBeNull();
    expect(uthVo2max(0)).toBeNull();
  });
});

describe("fitnessIndex", () => {
  it("blends present components onto 0-100", () => {
    const i = fitnessIndex({ vo2: 51.1, vdot: 43.4, rhr: 62 });
    expect(i).not.toBeNull();
    expect(i!).toBeGreaterThan(45);
    expect(i!).toBeLessThan(49);
  });
  it("works with partial inputs", () => {
    // vo2 only: band(51.1, 30, 60) = 70.33
    expect(fitnessIndex({ vo2: 51.1, vdot: null, rhr: null })!).toBeCloseTo(70.33, 1);
  });
  it("clamps out-of-band values", () => {
    expect(fitnessIndex({ vo2: 80, vdot: null, rhr: null })).toBe(100);
    expect(fitnessIndex({ vo2: 20, vdot: null, rhr: null })).toBe(0);
  });
  it("returns null with no inputs", () => {
    expect(fitnessIndex({ vo2: null, vdot: null, rhr: null })).toBeNull();
  });
});
