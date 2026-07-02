import type { AgendaRace, DayAgenda, FuelMarker } from "@/lib/dashboard/mock-data";
import { categoryColor } from "@/lib/race/types";
import {
  TYPE,
  dayMinutes,
  disciplineOf,
  fmtH,
  groupDay,
  type SessionGroup,
} from "@/lib/dashboard/agenda-view";

export function WeeklyAgenda({
  days,
  selectedIdx,
  onSelect,
}: {
  days: DayAgenda[];
  selectedIdx?: number | null;
  onSelect?: (idx: number | null) => void;
}) {
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
        {days.map((d, i) => (
          <Day
            key={d.day}
            day={d}
            maxDay={maxDay}
            selected={selectedIdx === i}
            onSelect={onSelect ? () => onSelect(selectedIdx === i ? null : i) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function Day({
  day,
  maxDay,
  selected,
  onSelect,
}: {
  day: DayAgenda;
  maxDay: number;
  selected: boolean;
  onSelect?: () => void;
}) {
  const isToday = !!day.isToday;
  const groups = groupDay(day);
  const mins = dayMinutes(day);
  const races = day.races ?? [];
  const isRest = (day.isRest || day.sessions.length === 0) && races.length === 0;

  return (
    <article
      role={onSelect ? "button" : undefined}
      aria-pressed={onSelect ? selected : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      style={{
        background: selected ? "var(--color-surface-elevated)" : "var(--color-surface-card)",
        borderRadius: "var(--radius-card)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 220,
        boxShadow: isToday
          ? "inset 0 0 0 1.5px var(--color-brand-accent)"
          : selected
          ? "inset 0 0 0 1px var(--color-text-muted)"
          : "none",
        cursor: onSelect ? "pointer" : undefined,
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
        {races.map((r, i) => (
          <RaceBanner key={i} race={r} />
        ))}
        {day.fuel && <FuelRow fuel={day.fuel} />}
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

      {/* stacked minutes bar + footer — only when real sessions carry minutes */}
      {day.sessions.length > 0 && (
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

/**
 * Carb-load row — same anatomy as session/race rows. Swatch + sub-line wear the
 * carbs token (--color-data-3, the same amber carbs wear in the calorie chart);
 * the sub-line carries the racing-style T−n countdown + race name.
 */
export function FuelRow({ fuel }: { fuel: FuelMarker }) {
  const c = "var(--color-data-3)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: c, flexShrink: 0 }} />
        <span
          className="text-title-sm"
          style={{ lineHeight: 1.25, flex: 1, minWidth: 0, color: "var(--color-text-primary)" }}
        >
          Carb load
        </span>
      </div>
      <span className="font-mono-xs" style={{ color: c, paddingLeft: 14, whiteSpace: "nowrap" }}>
        T−{fuel.daysToRace} · {fuel.raceName}
      </span>
    </div>
  );
}

/** Race row — same anatomy as a session row (swatch + name + mono sub-line);
 *  category shows through the swatch colour only. */
function RaceBanner({ race }: { race: AgendaRace }) {
  const color = categoryColor(race.category);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span
          className="text-title-sm"
          style={{ lineHeight: 1.25, flex: 1, minWidth: 0, color: "var(--color-text-primary)" }}
        >
          {race.name}
        </span>
      </div>
      <span className="font-mono-xs" style={{ color, paddingLeft: 14 }}>
        Race
      </span>
    </div>
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
