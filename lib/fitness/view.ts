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
