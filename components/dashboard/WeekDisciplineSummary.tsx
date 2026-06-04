"use client";

import { useDashboardWeek } from "@/app/_providers/dashboard-week-provider";
import { useRaces } from "@/app/_providers/race-provider";
import { ORDER, TYPE, fmtH, weekBreakdown } from "@/lib/dashboard/agenda-view";

/**
 * Week summary for the overview header: total active time + session count +
 * countdown to the next race, then a discipline-chip row (Strength 1×, Walk 1×,
 * …) and the rest-day count. Reads the same merged agenda the weekly grid uses.
 */
export function WeekDisciplineSummary() {
  const { agendaDays: days } = useDashboardWeek();
  const { byType, totalMins, totalSessions, restDays } = weekBreakdown(days);

  const { nextRace } = useRaces();
  const raceIn = nextRace ? `${Math.max(0, nextRace.daysUntil)}d` : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "baseline" }}>
        <Stat label="Active" value={totalMins ? fmtH(totalMins) : "—"} />
        <Divider />
        <Stat label="Sessions" value={String(totalSessions)} />
        <Divider />
        <Stat label="Race in" value={raceIn} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {ORDER.filter((k) => byType[k]).map((k) => (
          <span
            key={k}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              color: "var(--color-text-tertiary)",
              fontSize: 12,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 2, background: TYPE[k].color }} />
            {TYPE[k].label}
            <span className="font-mono-xs" style={{ color: "var(--color-text-muted)" }}>
              {byType[k]!.count}×
            </span>
          </span>
        ))}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--color-text-tertiary)",
            fontSize: 12,
          }}
        >
          <span
            style={{ width: 7, height: 7, borderRadius: 999, background: "var(--color-text-muted)" }}
          />
          Rest {restDays}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return <span style={{ width: 1, alignSelf: "stretch", background: "var(--color-outline)" }} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="text-label-md" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 24,
          color: "var(--color-text-primary)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
