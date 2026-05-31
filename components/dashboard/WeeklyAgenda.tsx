import type { ReactNode } from "react";
import { CalendarDays, Check, Clock, Dumbbell, Timer, Watch } from "lucide-react";
import type { DayAgenda, Session, SessionStatus, SessionSource } from "@/lib/dashboard/mock-data";
import { SectionHead } from "./SectionHead";

const STATUS_PILL: Record<
  SessionStatus,
  { fg: string; bg: string; label: string }
> = {
  done:    { fg: "var(--color-semantic-success)", bg: "rgba(77,212,163,0.15)", label: "Done" },
  planned: { fg: "var(--color-brand-accent)",     bg: "rgba(174,51,237,0.16)", label: "Planned" },
  rest:    { fg: "var(--color-text-tertiary)",    bg: "var(--color-surface-chip)", label: "Rest" },
};

const SOURCE_META: Record<SessionSource, { icon: ReactNode; label: string }> = {
  hevy:     { icon: <Dumbbell size={10} />,     label: "Hevy"     },
  garmin:   { icon: <Watch size={10} />,        label: "Garmin"   },
  calendar: { icon: <CalendarDays size={10} />, label: "Calendar" },
};

export function WeeklyAgenda({
  days,
  rangeLabel,
}: {
  days: DayAgenda[];
  rangeLabel: string;
}) {
  const counts = days.reduce(
    (acc, d) => {
      if (d.isRest) acc.rest += 1;
      else if (d.sessions.some((s) => s.status === "planned")) acc.planned += 1;
      d.sessions.forEach((s) => {
        if (s.status === "done") acc.done += 1;
      });
      return acc;
    },
    { done: 0, planned: 0, rest: 0 }
  );

  return (
    <section aria-label="Weekly agenda">
      <SectionHead
        overline={
          <>
            Short horizon <Dot /> {rangeLabel}
          </>
        }
        title="This week."
        right={
          <div
            style={{
              display: "flex",
              gap: 12,
              color: "var(--color-text-tertiary)",
              fontSize: "0.75rem",
              alignItems: "center",
            }}
          >
            <Legend color="var(--color-semantic-success)" label={`Done ${counts.done}`} />
            <Legend color="var(--color-brand-accent)" label={`Planned ${counts.planned}`} />
            <Legend color="var(--color-text-muted)" label={`Rest ${counts.rest}`} />
          </div>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "var(--space-sm)",
        }}
      >
        {days.map((d) => (
          <Day key={d.day} day={d} />
        ))}
      </div>
    </section>
  );
}

function Day({ day }: { day: DayAgenda }) {
  const isToday = !!day.isToday;
  return (
    <article
      style={{
        background: isToday
          ? "rgba(174,51,237,0.08)"
          : "var(--color-surface-card)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        minHeight: 132,
        boxShadow: isToday ? "inset 0 0 0 1px rgba(174,51,237,0.35)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          className="text-title-sm"
          style={{
            color: "var(--color-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {day.day}
          {isToday && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--color-brand-accent)",
              }}
            />
          )}
        </span>
        <span
          className="font-mono-sm"
          style={{
            color: day.isRest
              ? "var(--color-text-tertiary)"
              : "var(--color-text-primary)",
            fontSize: 14,
          }}
        >
          {day.date}
        </span>
      </div>

      {day.isRest ? (
        <div
          style={{
            flex: 1,
            display: "grid",
            placeItems: "center",
            color: "var(--color-text-muted)",
            fontStyle: "italic",
          }}
        >
          Rest
        </div>
      ) : (
        day.sessions.map((s, i) => <SessionCard key={i} s={s} />)
      )}
    </article>
  );
}

function SessionCard({ s }: { s: Session }) {
  const source = s.source ? SOURCE_META[s.source] : null;
  const pill = STATUS_PILL[s.status];
  return (
    <div
      style={{
        background: "var(--color-surface-low)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          className="text-title-sm"
          style={{ color: "var(--color-text-primary)" }}
        >
          {s.name}
        </span>
        {s.status === "done" ? (
          <Check
            size={15}
            strokeWidth={2.5}
            aria-label="Done"
            style={{ color: "var(--color-semantic-success)", flexShrink: 0 }}
          />
        ) : (
          <span
            style={{
              background: pill.bg,
              color: pill.fg,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            {pill.label}
          </span>
        )}
      </div>
      {(s.time || source || s.meta) && (
        <div
          className="font-mono-xs"
          style={{
            color: "var(--color-text-tertiary)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "2px 8px",
          }}
        >
          {s.time && <MetaBit icon={<Clock size={10} />} text={s.time} />}
          {source && <MetaBit icon={source.icon} text={source.label} />}
          {s.meta && <MetaBit icon={<Timer size={10} />} text={s.meta} />}
        </div>
      )}
    </div>
  );
}

function MetaBit({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, minWidth: 0 }}>
      <span style={{ display: "inline-flex", flexShrink: 0, opacity: 0.7 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {text}
      </span>
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
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
