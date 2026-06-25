/**
 * Banister TRIMP (training impulse) + hrTSS — the per-activity internal-load scalars
 * that feed the CTL "Fitness" curve. HR-only, no power meter needed. See
 * docs/fitness-trends.md and the research in that doc's references.
 *
 * Banister TRIMPexp (men): minutes × HRR × 0.64·e^(1.92·HRR), where HRR is the
 * Karvonen heart-rate-reserve fraction. The exponential weighting comes from the
 * blood-lactate vs %HRR curve, so time at high HR counts disproportionately.
 *
 * hrTSS normalises TRIMP so that one hour at lactate-threshold HR = 100 (intervals.icu
 * method), making it drop-in for the CTL/ATL EWMA in ctl.ts.
 */

export interface HrConfig {
  hrRest: number; // true resting HR (baseline, below daily readings)
  hrMax: number; // observed max
  lthr: number; // lactate-threshold HR (anchors hrTSS); ~Z4 threshold band
}

// Athlete defaults (overridable via env). HRmax 195 observed; LTHR ~165 (Z4 ≥158);
// resting 54 (true resting, below the 56-62 daily wrist readings).
export const HR_CONFIG: HrConfig = {
  hrRest: Number(process.env.FITNESS_HR_REST) || 54,
  hrMax: Number(process.env.FITNESS_HR_MAX) || 195,
  lthr: Number(process.env.FITNESS_LTHR) || 165,
};

/** Karvonen heart-rate-reserve fraction, clamped to [0,1]. */
function hrReserve(hr: number, c: HrConfig): number {
  const x = (hr - c.hrRest) / (c.hrMax - c.hrRest);
  return Math.max(0, Math.min(1, x));
}

/** Banister TRIMPexp for one effort (men's weighting). */
export function banisterTrimp(durationS: number, avgHr: number | null, c: HrConfig = HR_CONFIG): number {
  if (avgHr == null || durationS <= 0) return 0;
  const x = hrReserve(avgHr, c);
  const minutes = durationS / 60;
  return minutes * x * 0.64 * Math.exp(1.92 * x);
}

/** TRIMP of exactly one hour at LTHR — the hrTSS anchor (= 100). */
export function refTrimpHour(c: HrConfig = HR_CONFIG): number {
  return banisterTrimp(3600, c.lthr, c);
}

/** hrTSS = 100 × activity TRIMP / (1h at LTHR). One hour at threshold = 100. */
export function hrTss(durationS: number, avgHr: number | null, c: HrConfig = HR_CONFIG): number {
  const ref = refTrimpHour(c);
  if (ref <= 0) return 0;
  return (100 * banisterTrimp(durationS, avgHr, c)) / ref;
}
