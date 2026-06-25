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

/**
 * Fitness Trends card (P1) — VO2max hero, race-prediction block, and resting-HR /
 * load vitals. Read-only: the server reads the daily series from Postgres
 * (lib/fitness/queries) and passes it in, so this is pure markup and works in both
 * the desktop server tree and the client MobileOverview.
 *
 * Trend colour follows the app DS (semantic green = improving). VO2max improves when
 * it rises; race-pred time and resting HR improve when they fall (lowerIsBetter).
 * The composite index (P2) will take the hero slot; VO2max drops to a row then.
 */

const GOOD = "var(--color-semantic-success)";
const BAD = "var(--color-semantic-error)";
const FLAT = "var(--color-text-tertiary)";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function trendColor(t: Trend, lowerIsBetter: boolean): string {
  if (t.dir === "flat" || t.delta == null) return FLAT;
  const improving = lowerIsBetter ? t.dir === "down" : t.dir === "up";
  return improving ? GOOD : BAD;
}

function arrow(t: Trend): string {
  return t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "→";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [, m, day] = d.split("-");
  return `${MON[Number(m) - 1]} ${Number(day)}`;
}

export function FitnessCard({ series }: { series: FitnessPoint[] }) {
  const latest = series[series.length - 1];
  const vo2Series = series.map((p) => p.vo2maxRunning);
  const rhrSeries = series.map((p) => p.restingHr);

  const vo2 = latestNonNull(vo2Series);
  const vo2Trend = trend(vo2Series);
  const statusLabel = trainingStatusLabel(latest?.trainingStatusCode ?? null);
  const weeklyLoad = latest?.weeklyLoad ?? null;
  const hasData = series.length > 0 && vo2 != null;

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
          <Hero vo2={vo2} t={vo2Trend} window={`${series.length}d`} />

          <Group label="Race predictions">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-sm)",
              }}
            >
              <PredTile label="5K" secs={latest?.racePred5kS ?? null} />
              <PredTile label="10K" secs={latest?.racePred10kS ?? null} />
              <PredTile label="Half" secs={latest?.racePredHmS ?? null} />
              <PredTile label="Marathon" secs={latest?.racePredMS ?? null} />
            </div>
          </Group>

          <Group label="Vitals">
            <MetricRow
              label="Resting HR"
              value={fmtInt(latestNonNull(rhrSeries))}
              suffix="bpm"
              values={rhrSeries}
              t={trend(rhrSeries)}
              lowerIsBetter
              fmtDelta={(d) => `${d < 0 ? "−" : "+"}${Math.abs(d)}`}
            />
            <MetricRow
              label="Weekly load"
              value={fmtInt(weeklyLoad)}
              suffix=""
              values={series.map((p) => p.weeklyLoad)}
              t={trend(series.map((p) => p.weeklyLoad))}
              lowerIsBetter={false}
              fmtDelta={(d) => `${d < 0 ? "−" : "+"}${Math.abs(d)}`}
            />
          </Group>

          <Footer
            vo2Date={fmtDate(latest?.vo2maxComputedDate ?? null)}
            days={series.length}
          />
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

function Hero({ vo2, t, window }: { vo2: number | null; t: Trend; window: string }) {
  const color = trendColor(t, false);
  const hasDelta = t.delta != null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)" }}>
      <span
        className="text-display-sm"
        style={{ color: "var(--color-text-primary)", fontWeight: 600, lineHeight: 1 }}
      >
        {fmtVo2(vo2)}
      </span>
      <span style={{ color: "var(--color-text-tertiary)", fontSize: "0.8rem" }}>VO₂max</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
        {hasDelta ? (
          <span style={{ color, fontSize: "0.75rem" }}>
            {arrow(t)} {t.delta! > 0 ? "+" : "−"}
            {Math.abs(t.delta!).toFixed(1)}
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
  suffix: string;
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
      <span className="font-mono-sm" style={{ color: "var(--color-text-primary)", fontSize: "0.9rem" }}>
        {value}
        {suffix ? (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}> {suffix}</span>
        ) : null}
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

function Footer({ vo2Date, days }: { vo2Date: string; days: number }) {
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
      <span>VO₂max measured {vo2Date}</span>
      <span>
        {days} day{days === 1 ? "" : "s"} tracked
      </span>
    </div>
  );
}

function Empty() {
  return (
    <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
      Syncing your engine. The first snapshot lands on tonight&rsquo;s sync — VO₂max, run
      fitness and resting HR will trend here.
    </p>
  );
}

function fmtInt(v: number | null): string {
  return v == null ? "—" : String(Math.round(v));
}
