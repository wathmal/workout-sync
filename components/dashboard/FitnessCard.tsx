import type { ReactNode } from "react";
import type { FitnessPoint } from "@/lib/fitness/types";
import { trend, trainingStatusLabel, latestNonNull, type Trend } from "@/lib/fitness/view";
import { uthVo2max } from "@/lib/fitness/uth";
import { ctlSeries, atlSeries } from "@/lib/fitness/ctl";
import { SectionHead, Sep } from "./SectionHead";

/**
 * Fitness Trends card (iOS Health-inspired v2). Three stacked blocks — CTL ("Fitness"),
 * VO₂max, resting HR — each with its stats above a full-width straight-line chart. CTL is
 * a 42-day EWMA of daily training load (hrTSS), the Banister/TrainingPeaks fitness curve;
 * TSB (form) = CTL − ATL rides as a badge. VO₂max + RHR are recent-month capacity/recovery
 * markers. See docs/fitness-trends.md.
 *
 * Read-only & server-renderable: the server reads the daily series from Postgres and passes
 * it in, so this is pure markup shared by the desktop tree and the client MobileOverview.
 *
 * Dot policy: CTL = none (smooth EWMA, no discrete readings); VO₂max = native Garmin
 * readings only (~weekly post-run); RHR = every real daily reading.
 */

const CTL_DISPLAY_DAYS = 84; // chart window — 12 weeks of context (dip + rebuild)
const CTL_TREND_DAYS = 28; // hero delta = recent 4-week direction, not the whole chart
const METRIC_DAYS = 30; // VO2max/RHR only have ~a month of data

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(d: string): string {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${MON[Number(m) - 1]} ${Number(day)}`;
}

function dateRange(dates: string[]): string {
  if (!dates.length) return "";
  const a = fmtDate(dates[0]);
  const b = fmtDate(dates[dates.length - 1]);
  return a === b ? a : `${a} – ${b}`;
}

function trendColor(t: Trend, lowerIsBetter: boolean): string {
  if (t.dir === "flat" || t.delta == null) return "var(--color-text-muted)";
  const improving = lowerIsBetter ? t.dir === "down" : t.dir === "up";
  return improving ? "var(--color-semantic-success)" : "var(--color-semantic-error)";
}

function arrow(t: Trend): string {
  return t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "→";
}

// Garmin training-status code → badge color. Peaking/Overreaching read as "peak engine"
// (brand purple), not a warning. 0/null = no status (muted).
function statusColor(code: number | null): string {
  switch (code) {
    case 5:
    case 6:
      return "var(--color-brand-accent)"; // Peaking, Overreaching
    case 3:
    case 4:
      return "var(--color-semantic-success)"; // Maintaining, Productive
    case 2:
    case 7:
      return "var(--color-semantic-warning)"; // Recovery, Unproductive
    case 1:
    case 8:
      return "var(--color-semantic-error)"; // Detraining, Strained
    default:
      return "var(--color-text-muted)"; // No status
  }
}

function fmtDelta(d: number | null): string {
  return d == null ? "—" : `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)}`;
}

function fmtV(v: number | null): string {
  return v == null ? "—" : v.toFixed(1);
}

function fmtI(v: number | null): string {
  return v == null ? "—" : String(Math.round(v));
}

// ── Y-axis "nice" ticks ──────────────────────────────────────────────────
function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / e;
  return f < 1.5 ? e : f < 3.5 ? 2 * e : f < 7.5 ? 5 * e : 10 * e;
}

function yRange(values: Array<number | null>, count = 4): { ticks: number[]; yMin: number; yMax: number } {
  const nn = values.filter((v): v is number => v != null);
  if (!nn.length) return { ticks: [], yMin: 0, yMax: 1 };
  const lo = Math.min(...nn);
  const hi = Math.max(...nn);
  if (lo === hi) return { ticks: [lo], yMin: lo - 1, yMax: hi + 1 };
  const step = niceStep((hi - lo) / Math.max(1, count - 1));
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + step * 0.01; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { ticks, yMin, yMax };
}

export function FitnessCard({ series }: { series: FitnessPoint[] }) {
  const latest = series[series.length - 1];
  const statusLabel = trainingStatusLabel(latest?.trainingStatusCode ?? null);
  const statusHue = statusColor(latest?.trainingStatusCode ?? null);

  // CTL over the full window, seeded at the early steady-state load (mean of the first
  // ~4 weeks) so the EWMA doesn't ramp from zero and fake a fitness gain.
  const loadVals = series.map((p) => p.trainingLoadHrtss);
  const seedSlice = loadVals.slice(0, 28).filter((v): v is number => v != null);
  const seed = seedSlice.length ? seedSlice.reduce((a, b) => a + b, 0) / seedSlice.length : 0;

  const ctlFull = ctlSeries(loadVals, seed);
  const ctlWin = ctlFull.slice(-CTL_DISPLAY_DAYS);
  const ctlDates = series.map((p) => p.date).slice(-CTL_DISPLAY_DAYS);
  const ctlNow = latestNonNull(ctlWin);
  const ctlTrend = trend(ctlWin.slice(-CTL_TREND_DAYS));
  const atlNow = latestNonNull(atlSeries(loadVals, seed));
  const tsb = ctlNow != null && atlNow != null ? ctlNow - atlNow : null;

  // Capacity / recovery markers — only the recent month carries these.
  const recent = series.slice(-METRIC_DAYS);
  const recentDates = recent.map((p) => p.date);
  const vo2Vals = recent.map((p) => p.vo2maxRunning ?? uthVo2max(p.restingHr));
  const rhrVals = recent.map((p) => p.restingHr);
  const nativeVo2 = latestNonNull(recent.map((p) => p.vo2maxRunning));
  const vo2DotIdx = recent.flatMap((p, i) => (p.vo2maxRunning != null ? [i] : []));
  const rhrDotIdx = rhrVals.flatMap((v, i) => (v != null ? [i] : []));

  const hasData = series.length > 0 && series.some((p) => p.trainingLoadHrtss != null);

  const tsbBadge =
    tsb != null ? (
      <span
        className="font-mono-xs"
        style={{
          padding: "3px 8px",
          borderRadius: "var(--radius-sm)",
          whiteSpace: "nowrap",
          color: tsb >= 0 ? "var(--color-semantic-success)" : "var(--color-semantic-warning)",
          background: `color-mix(in srgb, ${
            tsb >= 0 ? "var(--color-semantic-success)" : "var(--color-semantic-warning)"
          } 12%, transparent)`,
        }}
      >
        TSB {tsb >= 0 ? "+" : ""}
        {tsb.toFixed(1)}
      </span>
    ) : null;

  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        flex: 1,
        width: "100%",
        minWidth: 0,
      }}
    >
      <SectionHead
        size="md"
        overline={<>Engine <Sep /> Garmin</>}
        title="Fitness."
        right={
          statusLabel ? (
            <span
              style={{
                display: "inline-flex",
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                background: `color-mix(in srgb, ${statusHue} 16%, transparent)`,
                color: statusHue,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              {statusLabel}
            </span>
          ) : undefined
        }
      />

      {!hasData ? (
        <Empty />
      ) : (
        <>
          {/* ponytail: pull the first block up one gap — SectionHead's own
              marginBottom + the card's gap:20 double the title→metrics space. */}
          <div style={{ marginTop: "calc(var(--space-lg) * -1)" }}>
          <IOSBlock
            value={ctlNow != null ? Math.round(ctlNow) : "—"}
            unit="CTL"
            valueColor="var(--color-brand-accent)"
            valueSize="lg"
            dateLabel={dateRange(ctlDates)}
            t={ctlTrend}
            lowerIsBetter={false}
            trendWindow={`${CTL_TREND_DAYS}D`}
            badge={tsbBadge}
            color="var(--color-brand-accent)"
            values={ctlWin}
            dates={ctlDates}
            height={140}
            dotIndices={[]}
            yCount={3}
          />
          </div>

          <Divider />

          <IOSBlock
            overline={<>VO₂MAX <Sep /> 30D</>}
            value={fmtV(nativeVo2 ?? latestNonNull(vo2Vals))}
            unit="ml/kg/min"
            dateLabel={dateRange(recentDates)}
            t={trend(vo2Vals)}
            lowerIsBetter={false}
            trendWindow="30D"
            color="var(--color-data-3)"
            values={vo2Vals}
            dates={recentDates}
            height={92}
            dotIndices={vo2DotIdx}
            yCount={3}
          />

          <Divider />

          <IOSBlock
            overline={<>RESTING HR <Sep /> 30D</>}
            value={fmtI(latestNonNull(rhrVals))}
            unit="bpm"
            dateLabel={dateRange(recentDates)}
            t={trend(rhrVals)}
            lowerIsBetter
            trendWindow="30D"
            color="var(--color-semantic-error)"
            values={rhrVals}
            dates={recentDates}
            height={92}
            dotIndices={rhrDotIdx}
            yCount={3}
          />
        </>
      )}
    </div>
  );
}

function Divider() {
  // Full-bleed hairline — bleeds by the card's horizontal padding.
  return (
    <div
      style={{
        height: 1,
        background: "var(--color-outline)",
        margin: "0 calc(var(--space-lg) * -1)",
      }}
    />
  );
}

/**
 * Overline → value + unit → date range → trend · window · badge, then the full-width chart.
 * Mirrors the iOS Health card layout.
 */
function IOSBlock({
  overline,
  value,
  unit,
  valueColor,
  valueSize = "lg",
  dateLabel,
  t,
  lowerIsBetter,
  trendWindow,
  badge,
  color,
  values,
  dates,
  height,
  dotIndices,
  yCount,
}: {
  overline?: ReactNode;
  value: ReactNode;
  unit?: string;
  valueColor?: string;
  valueSize?: "lg" | "md";
  dateLabel?: string;
  t: Trend;
  lowerIsBetter: boolean;
  trendWindow?: string;
  badge?: ReactNode;
  color: string;
  values: Array<number | null>;
  dates: string[];
  height: number;
  dotIndices: number[];
  yCount: number;
}) {
  const dc = trendColor(t, lowerIsBetter);
  const isLg = valueSize === "lg";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {overline ? (
          <span className="text-label-md" style={{ color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>
            {overline}
          </span>
        ) : null}

        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            className={isLg ? "text-display-sm" : "text-headline-sm"}
            style={{ color: valueColor ?? "var(--color-text-primary)", lineHeight: 1 }}
          >
            {value}
          </span>
          {unit ? (
            <span className={isLg ? "text-title-md" : "text-body-sm"} style={{ color: "var(--color-text-secondary)" }}>
              {unit}
            </span>
          ) : null}
        </div>

        {dateLabel ? (
          <span className="font-mono-sm" style={{ color: "var(--color-text-secondary)" }}>
            {dateLabel}
          </span>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1, flexWrap: "nowrap" }}>
          <span className="font-mono-xs" style={{ color: dc, whiteSpace: "nowrap" }}>
            {arrow(t)}&thinsp;{fmtDelta(t.delta)}
          </span>
          {trendWindow ? (
            <span className="font-mono-xs" style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
              · {trendWindow}
            </span>
          ) : null}
          {badge}
        </div>
      </div>

      <IOSChart values={values} dates={dates} color={color} height={height} dotIndices={dotIndices} yCount={yCount} />
    </div>
  );
}

/**
 * Straight-line segments · hollow circles only at dotIndices · dashed vertical grid ·
 * theme-aware gridlines/axes via --color-outline · y-labels right · x-date-labels bottom.
 */
function IOSChart({
  values,
  dates,
  color,
  height = 130,
  dotIndices,
  yCount = 4,
}: {
  values: Array<number | null>;
  dates: string[];
  color: string;
  height?: number;
  dotIndices: number[];
  yCount?: number;
}) {
  const W = 400;
  const padL = 4;
  const padR = 38;
  const padT = 10;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;

  const { ticks, yMin, yMax } = yRange(values, yCount);
  const ySpan = yMax - yMin || 1;
  const n = values.length;

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH * (1 - (v - yMin) / ySpan);

  // Straight-line path, breaking on nulls.
  let move = true;
  const segs: string[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      move = true;
      return;
    }
    segs.push(`${move ? "M" : "L"}${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`);
    move = false;
  });

  const dotSet = new Set(dotIndices);
  const dots: Array<[number, number]> = [];
  if (dotSet.size > 0) {
    values.forEach((v, i) => {
      if (v != null && dotSet.has(i)) dots.push([xAt(i), yAt(v)]);
    });
  }

  const vLines = [1, 2, 3, 4].map((k) => padL + (k / 5) * plotW);
  const xLabels = [0, 1, 2, 3, 4].map((k) => {
    const idx = Math.min(n - 1, Math.round((k / 4) * (n - 1)));
    return {
      x: xAt(idx),
      label: fmtDate(dates[idx]),
      anchor: k === 0 ? "start" : k === 4 ? "end" : "middle",
    } as const;
  });

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block", overflow: "visible" }} aria-hidden>
      {/* horizontal gridlines — theme-aware outline at low opacity (~0.056 over dark) */}
      {ticks.map((t) => (
        <line
          key={t}
          x1={padL}
          x2={padL + plotW}
          y1={yAt(t)}
          y2={yAt(t)}
          stroke="var(--color-outline)"
          strokeWidth="1"
          strokeOpacity="0.7"
        />
      ))}

      {/* interior dashed verticals — full outline */}
      {vLines.map((x, k) => (
        <line
          key={k}
          x1={x}
          x2={x}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--color-outline)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      ))}

      <path d={segs.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {dots.map((pt, k) => (
        <circle key={k} cx={pt[0]} cy={pt[1]} r="3.5" fill="var(--color-surface-card)" stroke={color} strokeWidth="1.8" />
      ))}

      {ticks.map((t) => (
        <text
          key={t}
          x={padL + plotW + 6}
          y={yAt(t) + 3.5}
          fontSize="10"
          textAnchor="start"
          fill="var(--color-text-muted)"
          className="font-mono-xs"
        >
          {Number.isInteger(t) ? t : t.toFixed(1)}
        </text>
      ))}

      {xLabels.map((l, k) => (
        <text
          key={k}
          x={l.x}
          y={height - 4}
          fontSize="10"
          textAnchor={l.anchor}
          fill="var(--color-text-muted)"
          className="font-mono-xs"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}

function Empty() {
  return (
    <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
      Syncing your engine. Training load lands on tonight&rsquo;s sync — your Fitness (CTL)
      curve, VO₂max and resting HR will trend here.
    </p>
  );
}
