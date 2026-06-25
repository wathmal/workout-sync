import { banisterTrimp, hrTss, HR_CONFIG } from "./trimp";
import { ewmaLoad, ctlSeries, atlSeries } from "./ctl";

describe("banisterTrimp", () => {
  it("is zero without HR or duration", () => {
    expect(banisterTrimp(3600, null)).toBe(0);
    expect(banisterTrimp(0, 150)).toBe(0);
  });
  it("rises with intensity and duration", () => {
    expect(banisterTrimp(3600, 170)).toBeGreaterThan(banisterTrimp(3600, 140));
    expect(banisterTrimp(3600, 150)).toBeGreaterThan(banisterTrimp(1800, 150));
  });
});

describe("hrTss", () => {
  it("anchors one hour at LTHR to ~100", () => {
    expect(hrTss(3600, HR_CONFIG.lthr)).toBeCloseTo(100, 4);
  });
  it("half an hour at LTHR is ~50", () => {
    expect(hrTss(1800, HR_CONFIG.lthr)).toBeCloseTo(50, 4);
  });
  it("zero without HR", () => {
    expect(hrTss(3600, null)).toBe(0);
  });
});

describe("ewmaLoad / CTL / ATL", () => {
  it("converges to a constant daily load", () => {
    const flat = Array(300).fill(40);
    const ctl = ctlSeries(flat);
    expect(ctl[ctl.length - 1]).toBeCloseTo(40, 1);
  });
  it("seeding at steady-state avoids the warm-up ramp", () => {
    // flat load seeded at its own level stays flat from day 1 (no fake ramp)
    const ctl = ctlSeries([40, 40, 40, 40], 40);
    ctl.forEach((v) => expect(v).toBeCloseTo(40, 6));
    // unseeded, the same load ramps up from 0
    expect(ctlSeries([40, 40, 40, 40])[0]).toBeLessThan(2);
  });
  it("treats nulls as rest (0 load)", () => {
    const s = ewmaLoad([null, null], 42);
    expect(s).toEqual([0, 0]);
  });
  it("ATL (fast) reacts quicker than CTL (slow) to a load step", () => {
    const step = Array(20).fill(50);
    const ctl = ctlSeries(step);
    const atl = atlSeries(step);
    // after the same 20 days of identical load, fatigue has risen further than fitness
    expect(atl[19]).toBeGreaterThan(ctl[19]);
  });
});
