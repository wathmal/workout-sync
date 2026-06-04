import { WeekStrip } from "./WeekStrip";
import { WeekSummary } from "./WeekSummary";
import { WeekDisciplineSummary } from "./WeekDisciplineSummary";

export function OverviewHeading() {
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

      <WeekDisciplineSummary />
    </header>
  );
}
