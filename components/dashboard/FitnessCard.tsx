import type { FitnessPoint } from "@/lib/fitness/types";
import {
  fmtVo2,
  secsToClock,
  trend,
  trainingStatusLabel,
  sparkPoints,
  latestNonNull,
  type Trend,
} from "@/lib/fitness/view";
import { uthVo2max } from "@/lib/fitness/uth";
import { vdotFromRace } from "@/lib/fitness/vdot";
import { ctlSeries } from "@/lib/fitness/ctl";
import { FitnessIndexChart } from "./FitnessIndexChart";

/**
 * Fitness Trends card. Headline = CTL ("Fitness") — a 42-day EWMA of daily training
 * load (hrTSS), the research-grounded Banister/TrainingPeaks fitness curve. VO2max +
 * VDOT are supporting capacity/performance markers; resting HR is a SEPARATE recovery
 * lane (RHR↔fitness is weak — it's an adaptation signal, not a fitness measure). See
 * docs/fitness-trends.md.
 *
 * Read-only: the server reads the daily series from Postgres and passes it in, so this
 * is pure markup and works in both the desktop server tree and the client MobileOverview.
 */

const GOOD = "var(--color-semantic-success)";
const BAD = "var(--color-semantic-error)";
const FLAT = "var(--color-text-tertiary)";

const CTL_DISPLAY_DAYS = 84; // chart window — 12 weeks of context (dip + rebuild)
const CTL_TREND_DAYS = 28; // hero delta = recent 4-week direction, not the whole chart
const METRIC_DAYS = 30; // VO2max/VDOT/RHR only have ~a month of data

function trendColor(t: Trend, lowerIsBetter: boolean): string {
  if (t.dir === "flat" || t.delta == null) return FLAT;
  const improving = lowerIsBetter ? t.dir === "down" : t.dir === "up";
  return improving ? GOOD : BAD;
}

function arrow(t: Trend): string {
  return t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "→";
}

export function FitnessCard({ series }: { series: FitnessPoint[] }) {
  const latest = series[series.length - 1];

  // CTL over the full window, display the settled tail. Seed the EWMA at the early
  // steady-state load (mean of the first ~4 weeks) instead of 0 — otherwise the curve
  // ramps up from zero and fakes a fitness gain that is really just the filter warming
  // up. Standard CTL initialisation (TrainingPeaks "starting CTL").
  const loadVals = series.map((p) => p.trainingLoadHrtss);
  const seedSlice = loadVals.slice(0, 28).filter((v): v is number => v != null);
  const seed = seedSlice.length ? seedSlice.reduce((a, b) => a + b, 0) / seedSlice.length : 0;
  const ctlFull = ctlSeries(loadVals, seed);
  const ctl = ctlFull.slice(-CTL_DISPLAY_DAYS);
  const ctlDates = series.map((p) => p.date).slice(-CTL_DISPLAY_DAYS);
  const ctlNow = latestNonNull(ctl);
  const ctlTrend = trend(ctl.slice(-CTL_TREND_DAYS)); // recent 4-week direction
  const hasLoad = series.some((p) => p.trainingLoadHrtss != null);

  // Capacity / performance markers — only the recent month carries these.
  const recent = series.slice(-METRIC_DAYS);
  const vo2Filled = recent.map((p) => p.vo2maxRunning ?? uthVo2max(p.restingHr));
  const vdotSeries = recent.map((p) => vdotFromRace(p.racePred10kS, 10000));
  const rhrSeries = recent.map((p) => p.restingHr);
  const nativeVo2 = latestNonNull(recent.map((p) => p.vo2maxRunning));

  const statusLabel = trainingStatusLabel(latest?.trainingStatusCode ?? null);
  const hasData = series.length > 0 && hasLoad;

  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        flex: 1,
        width: "100%",
        minWidth: 0,
      }}
    >
      <Header status={statusLabel} />

      {!hasData ? (
        <Empty />
      ) : (
        <>
          <Hero ctl={ctlNow} t={ctlTrend} window={`${Math.min(CTL_TREND_DAYS, ctl.length)}d`} />

          <FitnessIndexChart values={ctl} dates={ctlDates} />

          <Group label="Capacity">
            <MetricRow
              label="VO₂max"
              value={fmtVo2(nativeVo2 ?? latestNonNull(vo2Filled))}
              values={vo2Filled}
              t={trend(vo2Filled)}
              lowerIsBetter={false}
              fmtDelta={(d) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)}`}
            />
            <MetricRow
              label="VDOT"
              value={fmtVo2(latestNonNull(vdotSeries))}
              values={vdotSeries}
              t={trend(vdotSeries)}
              lowerIsBetter={false}
              fmtDelta={(d) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)}`}
            />
          </Group>

          <Group label="Race predictions">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
              <PredTile label="5K" secs={latest?.racePred5kS ?? null} />
              <PredTile label="10K" secs={latest?.racePred10kS ?? null} />
              <PredTile label="Half" secs={latest?.racePredHmS ?? null} />
              <PredTile label="Marathon" secs={latest?.racePredMS ?? null} />
            </div>
          </Group>

          <Group label="Recovery">
            <MetricRow
              label="Resting HR"
              value={fmtInt(latestNonNull(rhrSeries))}
              suffix="bpm"
              values={rhrSeries}
              t={trend(rhrSeries)}
              lowerIsBetter
              fmtDelta={(d) => `${d < 0 ? "−" : "+"}${Math.abs(d)}`}
            />
          </Group>

          <Footer days={series.length} />
        </>
      )}
    </div>
  );
}

function Header({ status }: { status: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "var(--space-sm)",
      }}
    >
      <div>
        <div className="text-label-md" style={{ color: "var(--color-text-tertiary)" }}>
          Engine · Garmin
        </div>
        <h2
          className="text-headline-md"
          style={{ color: "var(--color-text-primary)", margin: "var(--space-2xs) 0 0" }}
        >
          Fitness.
        </h2>
      </div>
      {status ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(174,51,237,0.16)",
            color: "var(--color-brand-accent)",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}

function Hero({ ctl, t, window }: { ctl: number | null; t: Trend; window: string }) {
  const color = trendColor(t, false);
  const hasDelta = t.delta != null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)" }}>
      <span
        className="text-display-sm"
        style={{ color: "var(--color-brand-mark)", fontWeight: 600, lineHeight: 1 }}
      >
        {ctl == null ? "—" : Math.round(ctl)}
      </span>
      <span style={{ color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>Fitness · CTL</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
        {hasDelta ? (
          <span style={{ color, fontSize: "0.75rem" }}>
            {arrow(t)} {t.delta! > 0 ? "+" : "−"}
            {Math.abs(t.delta!).toFixed(0)}
          </span>
        ) : (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.72rem" }}>tracking</span>
        )}
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>{window}</span>
      </span>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      <span className="text-label-md" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function PredTile({ label, secs }: { label: string; secs: number | null }) {
  return (
    <div
      style={{
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-sm) var(--space-md)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: "0.68rem",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span className="font-mono-md" style={{ color: "var(--color-text-primary)", fontSize: "1rem" }}>
        {secsToClock(secs)}
      </span>
    </div>
  );
}

function MetricRow({
  label,
  value,
  suffix,
  values,
  t,
  lowerIsBetter,
  fmtDelta,
}: {
  label: string;
  value: string;
  suffix?: string;
  values: Array<number | null>;
  t: Trend;
  lowerIsBetter: boolean;
  fmtDelta: (d: number) => string;
}) {
  const color = trendColor(t, lowerIsBetter);
  const pts = sparkPoints(values, 64, 20);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
      <span style={{ color: "var(--color-text-tertiary)", fontSize: "0.8rem", width: 84 }}>{label}</span>
      <span className="font-mono-sm" style={{ color: "var(--color-text-primary)", fontSize: "0.9rem", width: 56 }}>
        {value}
        {suffix ? <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}> {suffix}</span> : null}
      </span>
      <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        {pts ? (
          <svg width={64} height={20} viewBox="0 0 64 20" aria-hidden>
            <polyline
              points={pts}
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>—</span>
        )}
      </span>
      <span style={{ color, fontSize: "0.72rem", width: 48, textAlign: "right" }}>
        {arrow(t)} {t.delta == null ? "—" : fmtDelta(t.delta)}
      </span>
    </div>
  );
}

function Footer({ days }: { days: number }) {
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: "var(--space-sm)",
        borderTop: "1px solid var(--color-outline)",
        display: "flex",
        justifyContent: "space-between",
        color: "var(--color-text-muted)",
        fontSize: "0.72rem",
      }}
    >
      <span>CTL · 42-day load EWMA (Banister)</span>
      <span>
        {days} day{days === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function Empty() {
  return (
    <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
      Syncing your engine. Training load lands on tonight&rsquo;s sync — your Fitness (CTL)
      curve, VO₂max and run predictions will trend here.
    </p>
  );
}

function fmtInt(v: number | null): string {
  return v == null ? "—" : String(Math.round(v));
}
