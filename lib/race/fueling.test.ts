import { fuelPlan, LOAD_CARB_PER_KG, LOAD_NIGHT_SODIUM_MG, SODIUM_PRELOAD_MG } from "./fueling";

describe("fuelPlan", () => {
  const W = 68; // kg
  const BASE = 245; // standing carb target g

  it("returns null outside the loading window", () => {
    expect(fuelPlan({ daysUntil: 3, category: "hyrox", weightKg: W, baseCarbG: BASE })).toBeNull();
    expect(fuelPlan({ daysUntil: -1, category: "hyrox", weightKg: W, baseCarbG: BASE })).toBeNull();
  });

  it("returns null for unusable weight", () => {
    expect(fuelPlan({ daysUntil: 1, category: "hyrox", weightKg: 0, baseCarbG: BASE })).toBeNull();
    expect(fuelPlan({ daysUntil: 1, category: "hyrox", weightKg: NaN, baseCarbG: BASE })).toBeNull();
  });

  it("load day: carb target is weight × g/kg with delta over base", () => {
    const p = fuelPlan({ daysUntil: 2, category: "hyrox", weightKg: W, baseCarbG: BASE })!;
    expect(p.phase).toBe("load");
    expect(p.carbTargetG).toBe(Math.round(W * LOAD_CARB_PER_KG)); // 476
    expect(p.carbDeltaG).toBe(476 - 245); // 231
    expect(p.carbPerKg).toBe(LOAD_CARB_PER_KG);
  });

  it("load delta floors at zero when base already exceeds the load target", () => {
    const p = fuelPlan({ daysUntil: 1, category: "hyrox", weightKg: W, baseCarbG: 600 })!;
    expect(p.carbDeltaG).toBe(0);
  });

  it("race day: derives morning meal, caffeine, sodium, fluid, recovery from weight", () => {
    const p = fuelPlan({ daysUntil: 0, category: "hyrox", weightKg: W, baseCarbG: BASE })!;
    expect(p.phase).toBe("race-day");
    expect(p.morningCarbG).toBe(136); // 2 g/kg
    expect(p.caffeineMg).toBe(306); // 4.5 mg/kg
    expect(p.sodiumMg).toBe(SODIUM_PRELOAD_MG); // 750
    expect(p.fluidMl).toBe(476); // 7 ml/kg
    expect(p.recoveryCarbPerH).toBe(75); // 1.1 g/kg/h
  });

  it("T-1 load day carries the evening sodium preload; T-2 does not", () => {
    expect(fuelPlan({ daysUntil: 1, category: "hyrox", weightKg: W, baseCarbG: BASE })!.sodiumMg).toBe(
      LOAD_NIGHT_SODIUM_MG,
    );
    expect(fuelPlan({ daysUntil: 2, category: "hyrox", weightKg: W, baseCarbG: BASE })!.sodiumMg).toBe(0);
  });

  it("hyrox gel schedule scales with expected duration", () => {
    // No duration → 90min default: gels at 35/65 → 2 gels, 33 g/h.
    const dflt = fuelPlan({ daysUntil: 0, category: "hyrox", weightKg: W, baseCarbG: BASE })!;
    expect(dflt.inRaceGelCount).toBe(2);
    expect(dflt.inRaceCarbPerH).toBe(33);

    // 2h02 finisher: gels at 35/65/95 → 3 gels, ~37 g/h.
    const slow = fuelPlan({
      daysUntil: 0,
      category: "hyrox",
      weightKg: W,
      baseCarbG: BASE,
      expectedDurationMin: 122,
    })!;
    expect(slow.inRaceGelCount).toBe(3);
    expect(slow.inRaceCarbPerH).toBe(37);

    // Even a sub-envelope flyer keeps one gel as insurance.
    const fast = fuelPlan({
      daysUntil: 0,
      category: "hyrox",
      weightKg: W,
      baseCarbG: BASE,
      expectedDurationMin: 60,
    })!;
    expect(fast.inRaceGelCount).toBe(1);
  });

  it("every category fuels in-race; hyrox via gels, others at 45 g/h with no gel count", () => {
    const hyrox = fuelPlan({ daysUntil: 0, category: "hyrox", weightKg: W, baseCarbG: BASE })!;
    expect(hyrox.needsInRaceFuel).toBe(true);
    expect(hyrox.inRaceSodiumMgPerH).toBeGreaterThan(0);
    const running = fuelPlan({ daysUntil: 0, category: "running", weightKg: W, baseCarbG: BASE })!;
    expect(running.inRaceCarbPerH).toBe(45);
    expect(running.inRaceGelCount).toBe(0);
    expect(fuelPlan({ daysUntil: 0, category: "team", weightKg: W, baseCarbG: BASE })!.inRaceCarbPerH).toBe(45);
  });
});
