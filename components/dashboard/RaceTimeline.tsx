"use client";

import type { RaceEvent, EventCategory } from "@/lib/dashboard/mock-data";
import { SectionHead } from "./SectionHead";
import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";

const CAT_COLOR: Record<EventCategory, string> = {
  hyrox: "var(--color-data-4)",
  road: "var(--color-semantic-error)",
  team: "var(--color-data-5)",
};

const TODAY = new Date("2026-05-23");

// Axis: month-aligned 12-month window. Two presets:
//   12m   — 12 months starting one month before today (today sits in left third)
//   year  — Jan 1 → Dec 31 of today's calendar year
const RANGES = [
  { key: "year", label: "This year" },
  { key: "12m", label: "12m" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

export function RaceTimeline({ events }: { events: RaceEvent[] }) {
  const [range, setRange] = useState<RangeKey>("year");

  const { axisStart, axisEnd, months } = useMemo(() => {
    let start: Date;
    let end: Date;
    if (range === "year") {
      start = new Date(TODAY.getFullYear(), 0, 1);
      end = new Date(TODAY.getFullYear() + 1, 0, 1);
    } else {
      // 12m: previous month + next 11 months
      start = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 12, 1);
    }
    const ms: { label: string; left: number; isFirst: boolean }[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      ms.push({
        label: cursor.toLocaleString("en-US", { month: "short" }),
        left: pct(cursor, start, end),
        isFirst: ms.length === 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { axisStart: start, axisEnd: end, months: ms };
  }, [range]);

  const todayLeft = pct(TODAY, axisStart, axisEnd);

  const visible = events.filter((e) => {
    const d = new Date(e.fullDate);
    return d >= axisStart && d <= axisEnd;
  });

  const doneCount = events.filter((e) => e.status === "past").length;
  const nextEvent = events.find((e) => e.status === "next");
  const nextDays = nextEvent
    ? Math.max(0, Math.round((+new Date(nextEvent.fullDate) - +TODAY) / 86400000))
    : null;

  // 200px axis container; axis line sits at vertical center.
  const AXIS_HEIGHT = 200;
  const AXIS_CENTER = AXIS_HEIGHT / 2;

  return (
    <section
      aria-label="Race & event timeline"
      style={{
        background: "var(--color-surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg) var(--space-xl) var(--space-md)",
      }}
    >
      <SectionHead
        overline={<>Long horizon <Sep /> 12 months</>}
        title="Race calendar."
        right={
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
            <SegGroup value={range} onChange={setRange} />
            <button
              type="button"
              style={{
                padding: "6px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--color-text-secondary)",
                fontWeight: 500,
                fontSize: 13,
                background: "transparent",
                border: 0,
                cursor: "pointer",
              }}
            >
              Add event
              <Plus size={14} />
            </button>
          </div>
        }
      />

      {/* Axis area — single container; all hairlines share the same coordinate
          system so they align vertically. */}
      <div
        style={{
          position: "relative",
          height: AXIS_HEIGHT,
          marginTop: 30,
          marginBottom: "var(--space-md)",
        }}
      >
        {/* axis line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: AXIS_CENTER,
            height: 1,
            background: "var(--color-outline)",
          }}
        />

        {/* month ticks + labels */}
        {months.map((m, i) => (
          <div key={i} style={{ position: "absolute", left: `${m.left}%`, top: 0, height: "100%" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: AXIS_CENTER - 3,
                width: 1,
                height: 6,
                background: "var(--color-text-muted)",
                opacity: 0.55,
                transform: "translateX(-50%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: AXIS_CENTER + 8,
                transform: "translateX(-50%)",
                color: "var(--color-text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {m.label}
            </div>
          </div>
        ))}

        {/* today marker — single hairline running from above axis to axis line */}
        <div
          style={{
            position: "absolute",
            left: `${todayLeft}%`,
            top: 0,
            height: AXIS_CENTER,
            width: 1,
            background: "var(--color-text-muted)",
            opacity: 0.4,
            transform: "translateX(-50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${todayLeft}%`,
            top: -22,
            transform: "translateX(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-muted)",
            letterSpacing: "0.08em",
          }}
        >
          TODAY
        </div>

        {/* events */}
        {visible.map((e) => {
          const left = pct(new Date(e.fullDate), axisStart, axisEnd);
          return <EventMarker key={e.name} ev={e} left={left} axisCenter={AXIS_CENTER} />;
        })}
      </div>

      {/* footer legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          color: "var(--color-text-tertiary)",
          fontSize: 11,
        }}
      >
        <Legend color="var(--color-data-4)" label="Hyrox" />
        <Legend color="var(--color-semantic-error)" label="Road race" />
        <Legend color="var(--color-data-5)" label="Team games" />
        <Legend color="var(--color-semantic-success)" label="Completed" />
        <span style={{ marginLeft: "auto" }}>
          {events.length} events · {doneCount} done
          {nextDays !== null && (
            <>
              {" "}
              · next in{" "}
              <span
                className="font-mono-sm"
                style={{ color: "var(--color-brand-accent)" }}
              >
                {nextDays}d
              </span>
            </>
          )}
        </span>
      </div>
    </section>
  );
}

function EventMarker({
  ev,
  left,
  axisCenter,
}: {
  ev: RaceEvent;
  left: number;
  axisCenter: number;
}) {
  const isNext = ev.status === "next";
  const isPast = ev.status === "past";
  const color = isPast ? "var(--color-semantic-success)" : CAT_COLOR[ev.category];
  const lane2 = ev.lane === 2;

  // Uniform event card geometry — keeps row visually balanced.
  const BOX_WIDTH = 160;
  const BOX_HEIGHT = 76;
  const GAP_FROM_AXIS = 14;

  // Edge alignment so labels never spill outside axis bounds.
  const align: "start" | "end" | "center" =
    left < 8 ? "start" : left > 92 ? "end" : "center";
  const labelTransform =
    align === "start" ? "translateX(0)" :
    align === "end"   ? "translateX(-100%)" :
                        "translateX(-50%)";

  // Label sits above axis by default; lane-2 events sit below to dodge collisions.
  const labelTop = lane2
    ? axisCenter + GAP_FROM_AXIS
    : axisCenter - GAP_FROM_AXIS - BOX_HEIGHT;

  // Connector: hairline from the closest edge of the label box to the axis dot.
  const connectorTop = lane2 ? axisCenter : labelTop + BOX_HEIGHT;
  const connectorHeight = GAP_FROM_AXIS;

  return (
    <>
      {/* dot, pinned to axis line */}
      <div
        style={{
          position: "absolute",
          left: `${left}%`,
          top: axisCenter,
          transform: "translate(-50%, -50%)",
          width: isNext ? 14 : 10,
          height: isNext ? 14 : 10,
          borderRadius: 999,
          background: isNext ? "var(--color-brand-accent)" : color,
          boxShadow: isNext
            ? "0 0 0 5px rgba(174,51,237,0.20), 0 0 20px 4px rgba(174,51,237,0.35)"
            : `0 0 0 3px color-mix(in srgb, ${color} 18%, transparent)`,
          zIndex: isNext ? 5 : 1,
          opacity: isPast ? 0.85 : 1,
        }}
      />

      {/* connector hairline from dot to label box (visible above + below axis) */}
      <div
        style={{
          position: "absolute",
          left: `${left}%`,
          top: connectorTop,
          height: connectorHeight,
          width: 1,
          background: isNext ? "var(--color-brand-accent)" : "var(--color-text-muted)",
          opacity: isNext ? 0.5 : 0.3,
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      />

      {/* label box */}
      <div
        style={{
          position: "absolute",
          left: `${left}%`,
          top: labelTop,
          transform: labelTransform,
          width: BOX_WIDTH,
          minHeight: BOX_HEIGHT,
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-surface-elevated)",
          border: isNext
            ? "2px solid var(--color-brand-accent)"
            : "1px solid var(--color-outline)",
          boxShadow: isNext
            ? "0 12px 28px -8px rgba(174,51,237,0.45)"
            : "none",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          zIndex: isNext ? 10 : 2,
          opacity: isPast ? 0.85 : 1,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isPast ? "var(--color-semantic-success)" : color,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isPast && <Check size={10} strokeWidth={3} />}
          {isPast ? "Done" : isNext ? "Next" : labelForCategory(ev.category)}
          <span style={tinyDot} />
          {ev.category === "hyrox" ? "Hyrox" : ev.category === "road" ? "Road race" : "Team games"}
        </div>
        <div
          className="text-title-sm"
          style={{ color: "var(--color-text-primary)" }}
        >
          {ev.name}
        </div>
        <div
          className="font-mono-sm"
          style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}
        >
          {ev.date} · {ev.meta}
          {ev.result && (
            <>
              {" · "}
              <span style={{ color: "var(--color-semantic-success)" }}>{ev.result}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SegGroup({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-sm)",
        padding: 2,
      }}
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(r.key)}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: "var(--radius-sm)",
              background: active ? "var(--color-surface-card)" : "transparent",
              color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              border: 0,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function pct(d: Date, start: Date, end: Date): number {
  const total = +end - +start;
  if (total <= 0) return 0;
  return ((+d - +start) / total) * 100;
}

function labelForCategory(c: EventCategory): string {
  return c === "hyrox" ? "Hyrox" : c === "road" ? "Road" : "Team";
}

function Sep() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 3,
        height: 3,
        borderRadius: 999,
        background: "var(--color-text-muted)",
        margin: "0 6px",
        verticalAlign: "middle",
      }}
    />
  );
}

const tinyDot: React.CSSProperties = {
  display: "inline-block",
  width: 3,
  height: 3,
  borderRadius: 999,
  background: "var(--color-text-muted)",
  margin: "0 4px",
  verticalAlign: "middle",
};
