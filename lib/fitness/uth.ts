/**
 * Uth–Sørensen–Overgaard heart-rate-ratio VO2max estimate. Needs only resting + max
 * HR, so it runs off the daily RHR feed and fills the VO2max series on days Garmin's
 * native (latest-only, run-gated) value is absent. Validated against this account:
 * 15.3 × (195 / 58) ≈ 51.4 vs Garmin 51.1. Source: Uth et al., Eur J Appl Physiol
 * 91:111–115 (2003). See docs/fitness-trends.md.
 */

// Observed sim max (FR245M peaked 195). Preferred over Tanaka 208 − 0.7·age = 185.
export const ATHLETE_MAX_HR = 195;

export function uthVo2max(restingHr: number | null, maxHr: number = ATHLETE_MAX_HR): number | null {
  if (restingHr == null || restingHr <= 0) return null;
  return 15.3 * (maxHr / restingHr);
}
