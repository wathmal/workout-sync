import { chartPaths } from "@/lib/fitness/view";

/**
 * Fitness-index hero chart — a smoothed magenta area line over the daily index series,
 * with a date x-axis. Pure SVG (server-renderable, no deps), styled to the app DS:
 * brand-mark magenta with a soft glow + gradient fade, faint guide lines, min/max
 * ticks, and ~4 date ticks along the bottom. Auto-scaled to the window so a tight
 * band still reads as a trend. Returns null with no data.
 */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function tickLabel(d: string): string {
  const [, m, day] = d.split("-");
  return `${MON[Number(m) - 1]} ${Number(day)}`;
}

export function FitnessIndexChart({
  values,
  dates,
  height = 150,
}: {
  values: Array<number | null>;
  dates: string[];
  height?: number;
}) {
  const W = 400;
  const pad = 10;
  const axisH = 18;
  const plotH = height - axisH;
  const p = chartPaths(values, W, plotH, pad);
  if (!p) return null;

  const n = values.length;
  const innerW = W - pad * 2;
  const xAt = (i: number) => (n <= 1 ? pad + innerW / 2 : pad + (i / (n - 1)) * innerW);

  // ~4 evenly spaced date ticks; clamp anchors so the ends don't clip.
  const tickIdx = n <= 1 ? [0] : [...new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1])];

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <linearGradient id="fiFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-accent)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--color-brand-accent)" stopOpacity="0" />
        </linearGradient>
        <filter id="fiGlow" x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      <path d={p.area} fill="url(#fiFill)" />
      {/* two-tone line: soft accent glow under a crisp lighter mark line */}
      <path
        d={p.line}
        fill="none"
        stroke="var(--color-brand-accent)"
        strokeWidth="2.6"
        opacity="0.65"
        filter="url(#fiGlow)"
      />
      <path
        d={p.line}
        fill="none"
        stroke="var(--color-brand-mark)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={p.lastX}
        cy={p.lastY}
        r="4"
        fill="var(--color-surface-base)"
        stroke="var(--color-brand-mark)"
        strokeWidth="2"
      />

      {/* y range ticks */}
      <text x={W - 2} y={pad + 2} textAnchor="end" fontSize="9" fill="var(--color-text-muted)" className="font-mono-xs">
        {p.max.toFixed(1)}
      </text>
      <text x={W - 2} y={plotH - 2} textAnchor="end" fontSize="9" fill="var(--color-text-muted)" className="font-mono-xs">
        {p.min.toFixed(1)}
      </text>

      {/* date x-axis */}
      <line x1="0" x2={W} y1={plotH + 1} y2={plotH + 1} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      {tickIdx.map((i) => {
        const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
        return (
          <text
            key={i}
            x={xAt(i)}
            y={height - 4}
            textAnchor={anchor}
            fontSize="9"
            fill="var(--color-text-tertiary)"
            className="font-mono-xs"
          >
            {dates[i] ? tickLabel(dates[i]) : ""}
          </text>
        );
      })}
    </svg>
  );
}
