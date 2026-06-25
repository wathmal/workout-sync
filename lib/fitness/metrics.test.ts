import { vdotFromRace } from "./vdot";
import { uthVo2max } from "./uth";

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
