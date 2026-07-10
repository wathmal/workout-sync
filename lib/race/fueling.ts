/**
 * Race-fueling engine — pure derivation, no deps. Maps a race's `daysUntil` +
 * category + the athlete's bodyweight to a fueling protocol for the dashboard.
 *
 * All numbers are bodyweight × g/kg × phase, closed-form. No stored plan, no DB.
 *
 * Science (see the values below for the ranges each constant sits inside):
 *  - Glycogen supercompensation needs ~24-48h, so loading is a 1-2 day window,
 *    not the old 6-day depletion protocol.
 *  - Hyrox / short hybrid events finish in ~60-90min — inside the ~75min stored-
 *    glycogen envelope — so 6-8 g/kg loading (not marathon-scale 8-12) and no
 *    in-race fuel for a solo effort. Running / team events run longer → in-race carbs.
 *  - Pre-race meal 1-4 g/kg ~3h out; caffeine 3-6 mg/kg 45-60min pre-start;
 *    post 1.0-1.2 g/kg/h refill.
 *  - Sodium preload: ~500mg the evening before (T-1) + 500-1000mg in ~500ml
 *    fluid ~90min pre-start. In-race 500-1000 mg/h is the standard band —
 *    individual sweat sodium varies >10x, so this is a dial, not a law.
 *  - Cramp caveat: current evidence puts neuromuscular fatigue (altered
 *    alpha-motor-neuron control), not electrolyte loss, as the primary EAMC
 *    driver. Sodium buys margin; movement-specific training is the real fix.
 *    The engine only covers the fueling half.
 *
 * Constants are individual-tolerance dials (6 vs 8 g/kg is a personal choice,
 * not a law) — tune here.
 */

export const LOAD_CARB_PER_KG = 7; // T-1 / T-2 loading target (6-8 g/kg band)
export const RACE_MORNING_CARB_PER_KG = 2; // pre-race meal ~3h out (1-4 g/kg band)
export const CAFFEINE_PER_KG = 4.5; // 45-60min pre-start (3-6 mg/kg band)
export const SODIUM_PRELOAD_MG = 750; // ~90min pre-start (500-1000mg band)
export const LOAD_NIGHT_SODIUM_MG = 500; // T-1 evening preload
export const FLUID_PRELOAD_PER_KG_ML = 7; // 2-4h before (5-10 ml/kg band)
export const IN_RACE_CARB_G_PER_H = 45; // events > glycogen envelope (30-60 g/h band)
export const IN_RACE_SODIUM_MG_PER_H = 600; // 500-1000 mg/h band; cramp-prone → high end
export const GEL_CARB_G = 25; // typical gel
export const FIRST_GEL_MIN = 35; // first gel before stored glycogen dips, not after
export const GEL_INTERVAL_MIN = 30;
export const DEFAULT_HYROX_DURATION_MIN = 90; // fallback when no target/result known
export const RECOVERY_CARB_PER_KG_PER_H = 1.1; // <4h refill (1.0-1.2 g/kg/h band)

// Loading starts this many days out; a race today (0) is race-day.
export const LOAD_WINDOW_DAYS = 2;

export type FuelPhase = "load" | "race-day";

export interface FuelPlan {
  phase: FuelPhase;
  daysUntil: number;

  // Load phase
  carbTargetG: number; // total CHO for the day
  carbDeltaG: number; // extra over the standing carb target (>=0)
  carbPerKg: number;

  // Race-day phase
  morningCarbG: number; // pre-race meal carbs
  caffeineMg: number;
  sodiumMg: number;
  fluidMl: number;
  needsInRaceFuel: boolean; // category likely exceeds the glycogen envelope
  inRaceCarbPerH: number;
  inRaceGelCount: number; // hyrox only: gels for the expected duration (0 otherwise)
  inRaceSodiumMgPerH: number;
  recoveryCarbPerH: number;
}

/**
 * The fueling plan for a race `daysUntil` away, or null when out of window
 * (>2 days out, or already past) or the weight is unusable.
 * `baseCarbG` is the athlete's standing daily carb target, for the load delta.
 * `expectedDurationMin` sizes the hyrox gel schedule (target time or last
 * result); defaults to DEFAULT_HYROX_DURATION_MIN.
 */
export function fuelPlan({
  daysUntil,
  category,
  weightKg,
  baseCarbG,
  expectedDurationMin,
}: {
  daysUntil: number;
  category: string;
  weightKg: number;
  baseCarbG: number;
  expectedDurationMin?: number;
}): FuelPlan | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isInteger(daysUntil) || daysUntil < 0 || daysUntil > LOAD_WINDOW_DAYS) {
    return null;
  }

  if (daysUntil === 0) {
    // Stored glycogen covers ~60-75min at race intensity. Only a sub-75min finish
    // skips in-race fuel; a typical solo Hyrox (~90min) is past the envelope, so
    // every category defaults to fuelling. Hyrox = a gel schedule sized to the
    // expected finish time (first at FIRST_GEL_MIN, then every GEL_INTERVAL_MIN,
    // taken in the Roxzone); running / team = steadier 45 g/h.
    const durationMin =
      expectedDurationMin && expectedDurationMin > 0
        ? expectedDurationMin
        : DEFAULT_HYROX_DURATION_MIN;
    const inRaceGelCount =
      category === "hyrox"
        ? Math.max(1, Math.floor((durationMin - FIRST_GEL_MIN) / GEL_INTERVAL_MIN) + 1)
        : 0;
    const inRaceCarbPerH =
      category === "hyrox"
        ? Math.round((inRaceGelCount * GEL_CARB_G * 60) / durationMin)
        : IN_RACE_CARB_G_PER_H;
    return {
      phase: "race-day",
      daysUntil,
      carbTargetG: baseCarbG,
      carbDeltaG: 0,
      carbPerKg: 0,
      morningCarbG: Math.round(weightKg * RACE_MORNING_CARB_PER_KG),
      caffeineMg: Math.round(weightKg * CAFFEINE_PER_KG),
      sodiumMg: SODIUM_PRELOAD_MG,
      fluidMl: Math.round(weightKg * FLUID_PRELOAD_PER_KG_ML),
      needsInRaceFuel: true,
      inRaceCarbPerH,
      inRaceGelCount,
      inRaceSodiumMgPerH: IN_RACE_SODIUM_MG_PER_H,
      recoveryCarbPerH: Math.round(weightKg * RECOVERY_CARB_PER_KG_PER_H),
    };
  }

  // Load day (T-1, T-2).
  const carbTargetG = Math.round(weightKg * LOAD_CARB_PER_KG);
  return {
    phase: "load",
    daysUntil,
    carbTargetG,
    carbDeltaG: Math.max(0, carbTargetG - Math.round(baseCarbG)),
    carbPerKg: LOAD_CARB_PER_KG,
    morningCarbG: 0,
    caffeineMg: 0,
    // T-1 evening sodium preload starts the night before, not race morning.
    sodiumMg: daysUntil === 1 ? LOAD_NIGHT_SODIUM_MG : 0,
    fluidMl: 0,
    needsInRaceFuel: false,
    inRaceCarbPerH: 0,
    inRaceGelCount: 0,
    inRaceSodiumMgPerH: 0,
    recoveryCarbPerH: 0,
  };
}
