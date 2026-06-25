/**
 * Pure presentation helpers for the Fitness card. No I/O, no React — unit-tested in
 * view.test.ts. Keep all formatting / trend / sparkline math here so the component
 * stays markup.
 */

export interface Trend {
  dir: "up" | "down" | "flat";
  delta: number | null;
}

// Garmin/Firstbeat trainingStatus codes. Best-effort mapping — Garmin doesn't publish
// these; verified code 5 = Peaking against the live account (docs/fitness-trends.md).
const TRAINING_STATUS: Record<number, string> = {
  0: "No status",
  1: "Detraining",
  2: "Recovery",
  3: "Maintaining",
  4: "Productive",
  5: "Peaking",
  6: "Overreaching",
  7: "Unproductive",
  8: "Strained",
};

export function trainingStatusLabel(code: number | null): string | null {
  if (code == null) return null;
  return TRAINING_STATUS[code] ?? null;
}

/** Seconds → clock. Under an hour: m:ss. An hour+: h:mm:ss. */
export function secsToClock(total: number | null): string {
  if (total == null || !Number.isFinite(total)) return "—";
  const s = Math.round(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export function fmtVo2(v: number | null): string {
  return v == null ? "—" : v.toFixed(1);
}

/** Most recent non-null value in a series, or null. */
export function latestNonNull(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i];
  }
  return null;
}

/** Direction + magnitude of the latest value vs the earliest non-null in the window. */
export function trend(values: Array<number | null>): Trend {
  const nn = values.filter((v): v is number => v != null);
  if (nn.length < 2) return { dir: "flat", delta: null };
  const delta = nn[nn.length - 1] - nn[0];
  const dir = Math.abs(delta) < 1e-9 ? "flat" : delta > 0 ? "up" : "down";
  return { dir, delta };
}

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * Trailing moving average (ignores nulls in the window). Fitness is a smoothed
 * quantity — this tames day-to-day resting-HR noise into a readable trend line.
 */
export function movingAverage(values: Array<number | null>, window: number): Array<number | null> {
  return values.map((_, i) => {
    const slice: number[] = [];
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = values[j];
      if (v != null) slice.push(v);
    }
    if (slice.length === 0) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export interface ChartPaths {
  line: string; // smoothed stroke path
  area: string; // same, closed to the baseline for the gradient fill
  lastX: number;
  lastY: number;
  min: number;
  max: number;
}

/** Catmull-Rom → cubic bezier for a soft, premium curve through the points. */
function smooth(pts: Array<[number, number]>): string {
  if (pts.length === 1) return `M${r(pts[0][0])},${r(pts[0][1])}`;
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${r(cp1x)},${r(cp1y)} ${r(cp2x)},${r(cp2y)} ${r(p2[0])},${r(p2[1])}`;
  }
  return d;
}

/**
 * Smoothed area + line paths for the index hero chart. Auto-scales y to the window's
 * own min/max (with a touch of padding) so a 45–49 band still reads as movement on a
 * 0–100 metric. Returns null when there's nothing to plot.
 */
export function chartPaths(values: Array<number | null>, w: number, h: number, pad = 8): ChartPaths | null {
  const n = values.length;
  const nn = values.filter((v): v is number => v != null);
  if (nn.length === 0) return null;
  const lo = Math.min(...nn);
  const hi = Math.max(...nn);
  const padY = (hi - lo) * 0.15 || 1; // breathing room so the line never kisses the edges
  const min = lo - padY;
  const max = hi + padY;
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const pts: Array<[number, number]> = [];
  values.forEach((v, i) => {
    if (v == null) return;
    const x = n === 1 ? pad + innerW / 2 : pad + (i / (n - 1)) * innerW;
    const y = pad + innerH - ((v - min) / span) * innerH;
    pts.push([x, y]);
  });
  const line = smooth(pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const bottom = h - pad / 2;
  const area = `${line} L${r(last[0])},${r(bottom)} L${r(first[0])},${r(bottom)} Z`;
  return { line, area, lastX: r(last[0]), lastY: r(last[1]), min: lo, max: hi };
}

/**
 * SVG polyline points for a sparkline. x is spread across the full series by index
 * (nulls leave gaps), y is min-max normalised into the box. Returns "" for no data.
 */
export function sparkPoints(values: Array<number | null>, w = 64, h = 20, pad = 2): string {
  const n = values.length;
  const nn = values.filter((v): v is number => v != null);
  if (nn.length === 0) return "";
  const min = Math.min(...nn);
  const max = Math.max(...nn);
  const flat = max === min; // single point or no variation → draw a centered flat line
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const pts: string[] = [];
  values.forEach((v, i) => {
    if (v == null) return;
    const x = n === 1 ? pad + innerW / 2 : pad + (i / (n - 1)) * innerW;
    const y = flat ? pad + innerH / 2 : pad + innerH - ((v - min) / span) * innerH;
    pts.push(`${r(x)},${r(y)}`);
  });
  return pts.join(" ");
}
