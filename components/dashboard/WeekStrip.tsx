"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboardWeek } from "@/app/_providers/dashboard-week-provider";

/**
 * Dashboard week navigator — the analogue of the Log Food day strip, rendered as
 * the heading's date line. Drives the shared week offset in DashboardWeekProvider;
 * the calorie, muscle-coverage and agenda widgets all rewind with it. The label is
 * derived from the selected week (no static data), forward stops at the current week.
 */
export function WeekStrip() {
  const {
    weekStart,
    weekEnd,
    prev,
    next,
    canGoNext,
    foodLoading,
    coverageLoading,
    agendaLoading,
  } = useDashboardWeek();
  const busy = foodLoading || coverageLoading || agendaLoading;
  const { week, year } = isoWeekYear(weekStart);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)", marginLeft: -6 }}>
      <WeekNavButton label="Previous week" onClick={prev}>
        <ChevronLeft size={16} />
      </WeekNavButton>
      <span
        className="text-label-md"
        style={{ color: "var(--color-text-tertiary)", opacity: busy ? 0.5 : 1 }}
      >
        {dateRange(weekStart, weekEnd)}
        <Dot />
        Week {week}
        <Dot />
        {year}
      </span>
      <WeekNavButton label="Next week" onClick={next} disabled={!canGoNext}>
        <ChevronRight size={16} />
      </WeekNavButton>
    </div>
  );
}

/** ISO-8601 week number + week-year (Thursday-anchored) for a YYYY-MM-DD key. */
function isoWeekYear(dateStr: string): { week: number; year: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7; // Mon=1 … Sun=7
  dt.setUTCDate(dt.getUTCDate() + 4 - day); // shift to the week's Thursday
  const year = dt.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((dt.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return { week, year };
}

/** "May 18 – 24" or "May 31 – Jun 6" for the Mon..Sun range. */
function dateRange(monday: string, sunday: string): string {
  const toDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const a = toDate(monday);
  const b = toDate(sunday);
  const mon = (dt: Date) => dt.toLocaleDateString(undefined, { month: "short" });
  return a.getMonth() === b.getMonth()
    ? `${mon(a)} ${a.getDate()} – ${b.getDate()}`
    : `${mon(a)} ${a.getDate()} – ${mon(b)} ${b.getDate()}`;
}

function Dot() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 3,
        height: 3,
        borderRadius: 999,
        background: "var(--color-text-muted)",
        margin: "0 8px",
        verticalAlign: "middle",
      }}
    />
  );
}

function WeekNavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        border: "none",
        background: "transparent",
        color: disabled ? "var(--color-text-muted)" : "var(--color-text-secondary)",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
