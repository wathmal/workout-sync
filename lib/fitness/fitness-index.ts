/**
 * Composite 0–100 fitness index — one headline number for "is the engine improving?".
 * Equal-weighted mean of whatever components are present, each mapped onto 0–100 by a
 * fixed band. Provisional bands/weights (tunable); the value trends as inputs move.
 *
 * Bands: VO2max & VDOT 30→60 ml/kg/min = 0→100. RHR inverted 70→40 bpm = 0→100
 * (lower resting HR is fitter). See docs/fitness-trends.md (Decisions).
 *
 * Because the VO2max input can be Uth-proxied from resting HR (lib/fitness/uth.ts),
 * the index has real day-over-day history from the RHR backfill — no warm-up gap.
 */

export interface IndexInputs {
  vo2: number | null;
  vdot: number | null;
  rhr: number | null;
}

function band(v: number, lo: number, hi: number): number {
  const pct = ((v - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function fitnessIndex({ vo2, vdot, rhr }: IndexInputs): number | null {
  const parts: number[] = [];
  if (vo2 != null) parts.push(band(vo2, 30, 60));
  if (vdot != null) parts.push(band(vdot, 30, 60));
  if (rhr != null) parts.push(band(rhr, 70, 40)); // inverted: 70→0, 40→100
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}
