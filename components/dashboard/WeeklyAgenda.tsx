import type { DayAgenda } from "@/lib/dashboard/mock-data";
import {
  TYPE,
  dayMinutes,
  disciplineOf,
  fmtH,
  groupDay,
  type SessionGroup,
} from "@/lib/dashboard/agenda-view";

export function WeeklyAgenda({ days }: { days: DayAgenda[] }) {
  const maxDay = Math.max(1, ...days.map(dayMinutes));

  return (
    <section aria-label="Weekly agenda">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "var(--space-sm)",
        }}
      >
        {days.map((d) => (
          <Day key={d.day} day={d} maxDay={maxDay} />
        ))}
      </div>
    </section>
  );
}

function Day({ day, maxDay }: { day: DayAgenda; maxDay: number }) {
  const isToday = !!day.isToday;
  const groups = groupDay(day);
  const mins = dayMinutes(day);
  const isRest = day.isRest || day.sessions.length === 0;

  return (
    <article
      style={{
        background: isToday ? "rgba(174,51,237,0.07)" : "var(--color-surface-card)",
        borderRadius: "var(--radius-card)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 220,
        boxShadow: isToday ? "inset 0 0 0 1px rgba(174,51,237,0.4)" : "none",
      }}
    >
      {/* day header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          className="text-title-sm"
          style={{
            color: isToday ? "var(--color-brand-accent)" : "var(--color-text-secondary)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {day.day}
          {isToday && (
            <span
              style={{ width: 5, height: 5, borderRadius: 999, background: "var(--color-brand-accent)" }}
            />
          )}
        </span>
        <span
          className="font-mono-sm"
          style={{ color: isRest ? "var(--color-text-muted)" : "var(--color-text-primary)" }}
        >
          {day.date}
        </span>
      </div>

      {/* sessions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        {isRest ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
              fontFamily: "var(--font-display)",
              fontSize: 16,
            }}
          >
            Rest
          </div>
        ) : (
          groups.map((g, i) => <GroupRow key={i} group={g} />)
        )}
      </div>

      {/* stacked minutes bar + footer */}
      {!isRest && (
        <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              height: 5,
              borderRadius: 999,
              overflow: "hidden",
              background: "var(--color-surface-chip)",
            }}
          >
            {day.sessions.map((s, i) => {
              const t = disciplineOf(s);
              return (
                <div
                  key={i}
                  title={`${s.name}${s.durationMin ? ` · ${fmtH(s.durationMin)}` : ""}`}
                  style={{
                    width: `${maxDay ? ((s.durationMin ?? 0) / maxDay) * 100 : 0}%`,
                    background: TYPE[t].color,
                    opacity: t === "walk" ? 0.5 : 0.9,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-muted)" }}>
            <span className="font-mono-xs">{day.sessions.length} log</span>
            <span
              className="font-mono-xs"
              style={{ color: mins ? "var(--color-text-tertiary)" : "var(--color-text-muted)" }}
            >
              {mins ? fmtH(mins) : "—"}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

function GroupRow({ group }: { group: SessionGroup }) {
  const t = TYPE[group.type];
  const quiet = group.type === "walk";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, opacity: quiet ? 0.82 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: t.color, flexShrink: 0 }} />
        <span
          className="text-title-sm"
          style={{
            lineHeight: 1.25,
            flex: 1,
            minWidth: 0,
            color: quiet ? "var(--color-text-secondary)" : "var(--color-text-primary)",
          }}
        >
          {group.name}
        </span>
        {group.count > 1 && (
          <span
            className="font-mono-xs"
            style={{
              color: "var(--color-text-tertiary)",
              background: "var(--color-surface-chip)",
              borderRadius: 999,
              padding: "1px 6px",
              flexShrink: 0,
            }}
          >
            ×{group.count}
          </span>
        )}
      </div>
      {group.hasDuration && (
        <span className="font-mono-xs" style={{ color: "var(--color-text-muted)", paddingLeft: 14 }}>
          {fmtH(group.mins)}
        </span>
      )}
    </div>
  );
}
