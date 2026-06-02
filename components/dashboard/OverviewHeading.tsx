import type { OverviewMock } from "@/lib/dashboard/mock-data";
import { WeekStrip } from "./WeekStrip";
import { WeekSummary } from "./WeekSummary";

type Heading = OverviewMock["heading"];

export function OverviewHeading({ data }: { data: Heading }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: "var(--space-2xl)",
        flexWrap: "wrap",
      }}
    >
      <div>
        <WeekStrip />
        <h1
          className="text-display-sm"
          style={{
            color: "var(--color-text-primary)",
            margin: "var(--space-sm) 0 0",
            fontSize: 48,
            lineHeight: 1.02,
          }}
        >
          <WeekSummary />
        </h1>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-lg)",
          flexWrap: "wrap",
        }}
      >
        <Stat label="Streak" value={`${data.streak}`} unit="d" />
        <Stat label="Weekly load" value={data.weeklyLoad.toLocaleString()} unit="kg" />
        <Stat
          label="Body fat"
          value={data.bodyFat.toFixed(1)}
          unit="%"
          extra={
            <span
              className="font-mono-sm"
              style={{
                color:
                  data.bodyFatDelta < 0
                    ? "var(--color-semantic-success)"
                    : "var(--color-semantic-warning)",
              }}
            >
              {data.bodyFatDelta < 0 ? "↓" : "↑"}
              {Math.abs(data.bodyFatDelta).toFixed(1)}
            </span>
          }
        />
        <Stat label="Race in" value={`${data.raceInDays}`} unit="d" />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  unit,
  extra,
}: {
  label: string;
  value: string;
  unit: string;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 72 }}>
      <div
        className="text-label-md"
        style={{ color: "var(--color-text-tertiary)", marginBottom: 4 }}
      >
        {label}
      </div>
      <div
        className="font-mono-lg"
        style={{ color: "var(--color-text-primary)", display: "flex", alignItems: "baseline", gap: 4 }}
      >
        {value}
        <small style={{ color: "var(--color-text-tertiary)", fontSize: 13 }}>{unit}</small>
        {extra ? <span style={{ marginLeft: 6 }}>{extra}</span> : null}
      </div>
    </div>
  );
}
