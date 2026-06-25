/**
 * Daniels–Gilbert VDOT — a performance-derived pseudo-VO2max that blends aerobic
 * capacity with running economy. Computed from a race/predicted time, so unlike
 * Garmin's lab-style VO2max it reflects what the athlete can actually run. We feed it
 * Garmin's predicted 10K (a stable middle distance). See docs/fitness-trends.md.
 *
 * VO2cost = −4.60 + 0.182258·v + 0.000104·v²      (v = velocity m/min)
 * %max    = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)   (t = min)
 * VDOT    = VO2cost / %max
 */
export function vdotFromRace(timeS: number | null, distM: number): number | null {
  if (timeS == null || timeS <= 0 || distM <= 0) return null;
  const tMin = timeS / 60;
  const v = distM / tMin; // metres per minute
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pctMax =
    0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
  if (pctMax <= 0) return null;
  return vo2 / pctMax;
}
