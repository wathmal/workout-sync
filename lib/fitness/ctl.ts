/**
 * CTL / ATL — the TrainingPeaks Performance-Management curves, i.e. the parameter-free
 * operationalisation of the Banister impulse-response model. CTL ("Fitness") is a
 * 42-day EWMA of daily training load (hrTSS); ATL ("Fatigue") a 7-day EWMA; their
 * difference is form/freshness (TSB). This keeps Banister's validated exponential-decay
 * structure while dropping the un-identifiable per-athlete gain fitting. See
 * docs/fitness-trends.md.
 *
 * Impulse-response EWMA: value_t = value_{t-1}·e^(-1/τ) + load_t·(1 - e^(-1/τ)).
 * Input is a continuous daily series, oldest-first, 0 on rest days.
 */

export const CTL_TAU = 42;
export const ATL_TAU = 7;

export function ewmaLoad(load: Array<number | null>, tau: number, seed = 0): number[] {
  const a = Math.exp(-1 / tau);
  let prev = seed;
  return load.map((l) => {
    prev = prev * a + (l ?? 0) * (1 - a);
    return prev;
  });
}

/** Chronic Training Load — the "Fitness" curve (τ = 42 d). */
export function ctlSeries(load: Array<number | null>, seed = 0): number[] {
  return ewmaLoad(load, CTL_TAU, seed);
}

/** Acute Training Load — the "Fatigue" curve (τ = 7 d). */
export function atlSeries(load: Array<number | null>, seed = 0): number[] {
  return ewmaLoad(load, ATL_TAU, seed);
}
