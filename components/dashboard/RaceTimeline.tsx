"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, Clock, MapPin, Plus, Tag } from "lucide-react";
import { SectionHead, Sep } from "./SectionHead";
import { useRaces } from "@/app/_providers/race-provider";
import { categoryColor, categoryLabel, type RaceView } from "@/lib/race/types";
import { todayLocalStr } from "@/lib/food/local-date";

// Axis: month-aligned 12-month window. Two presets:
//   year  — Jan 1 → Dec 31 of today's calendar year
//   12m   — previous month + next 11 months (today sits in the left third)
const RANGES = [
  { key: "year", label: "This year" },
  { key: "12m", label: "12m" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

// Vertical geometry of the leader-line stack (px from the axis container top).
const AXIS_Y = 40; // month axis line
const RAIL_Y = 82; // even-distribution rail
const CARD_TOP = 100; // card row begins
const PILL_TOP = AXIS_Y - 48; // TODAY pill floats above the axis
const CARD_PAD_Y = 12; // card vertical padding (used to size from content height)
const CARD_BOTTOM_PAD = 24; // breathing room below the card row
const EMPTY_CONTAINER_H = 320; // fallback height before cards are measured

export function RaceTimeline() {
  const { views, nextRace } = useRaces();
  const [range, setRange] = useState<RangeKey>("year");

  const TODAY = useMemo(() => new Date(`${todayLocalStr()}T00:00:00`), []);

  const { axisStart, axisEnd, months } = useMemo(() => {
    let start: Date;
    let end: Date;
    if (range === "year") {
      start = new Date(TODAY.getFullYear(), 0, 1);
      end = new Date(TODAY.getFullYear() + 1, 0, 1);
    } else {
      start = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 12, 1);
    }
    const ms: { label: string; left: number }[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      ms.push({ label: cursor.toLocaleString("en-US", { month: "short" }), left: pct(cursor, start, end) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { axisStart: start, axisEnd: end, months: ms };
  }, [range, TODAY]);

  const todayLeft = pct(TODAY, axisStart, axisEnd);

  // Visible races within the axis window, in date order (views are pre-sorted).
  const visible = useMemo(
    () =>
      views.filter((e) => {
        const d = new Date(`${e.date}T00:00:00`);
        return d >= axisStart && d <= axisEnd;
      }),
    [views, axisStart, axisEnd],
  );

  const doneCount = views.filter((e) => e.status === "past").length;
  const nextDays = nextRace ? Math.max(0, nextRace.daysUntil) : null;

  // Equal card heights: measure each card's natural CONTENT (never height-
  // constrained), take the tallest, then pin every card to it — no clipping. The
  // content refs are decoupled from the applied height, so measuring is stable and
  // the effect settles in one extra pass (re-runs only when the race set changes).
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [cardH, setCardH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const heights = Object.values(contentRefs.current).map((el) => el?.offsetHeight ?? 0);
    const max = Math.max(0, ...heights);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardH(max > 0 ? max + CARD_PAD_Y * 2 : null);
  }, [visible]);

  const containerH = cardH ? CARD_TOP + cardH + CARD_BOTTOM_PAD : EMPTY_CONTAINER_H;

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
            <Link
              href="/races"
              style={{
                padding: "6px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--color-text-secondary)",
                fontWeight: 500,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Add event
              <Plus size={14} />
            </Link>
          </div>
        }
      />

      {/* Leader-line stack — one coordinate system; every hairline aligns. */}
      <div style={{ position: "relative", height: containerH, marginTop: 28 }}>
        {/* month labels */}
        {months.map((m, i) => (
          <div
            key={i}
            className="font-mono-xs"
            style={{
              position: "absolute",
              left: `${m.left}%`,
              top: AXIS_Y - 20,
              transform: "translateX(-50%)",
              color: "var(--color-text-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {m.label}
          </div>
        ))}

        {/* axis */}
        <div
          style={{ position: "absolute", left: 0, right: 0, top: AXIS_Y, height: 2, borderRadius: 999, background: "var(--color-outline)" }}
        />
        {/* rail */}
        <div
          style={{ position: "absolute", left: "2%", right: "2%", top: RAIL_Y, height: 1, background: "var(--color-outline)" }}
        />

        {/* TODAY pill + drop stem + axis dot — above the axis only */}
        <div
          style={{
            position: "absolute",
            left: `${todayLeft}%`,
            top: PILL_TOP,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            zIndex: 20,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--color-brand-accent)",
              background: "rgba(174,51,237,0.14)",
              border: "1px solid rgba(174,51,237,0.35)",
              borderRadius: 4,
              padding: "3px 8px",
              whiteSpace: "nowrap",
            }}
          >
            TODAY
          </span>
          <div style={{ width: 1, height: 22, background: "var(--color-brand-accent)", opacity: 0.7 }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: `${todayLeft}%`,
            top: AXIS_Y,
            transform: "translate(-50%,-50%)",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--color-brand-accent)",
            zIndex: 20,
            boxShadow: "0 0 0 3px rgba(174,51,237,0.25)",
          }}
        />

        {visible.map((e, i) => (
          <EventLeader
            key={e.id}
            ev={e}
            trueX={pct(new Date(`${e.date}T00:00:00`), axisStart, axisEnd)}
            evenX={((i + 0.5) / visible.length) * 100}
            widthPct={100 / visible.length - 2.5}
            z={i + 2}
            cardH={cardH}
            contentRef={(el) => {
              contentRefs.current[e.id] = el;
            }}
          />
        ))}

        {visible.length === 0 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: CARD_TOP,
              transform: "translateX(-50%)",
              color: "var(--color-text-muted)",
              fontSize: 13,
            }}
          >
            No races in this window.
          </div>
        )}
      </div>

      {/* footer legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          marginTop: "var(--space-lg)",
          paddingTop: "var(--space-md)",
          borderTop: "1px solid var(--color-outline)",
          color: "var(--color-text-tertiary)",
          fontSize: 12,
        }}
      >
        <Legend color="var(--color-data-4)" label="Hyrox" />
        <Legend color="var(--color-semantic-error)" label="Running" />
        <Legend color="var(--color-data-5)" label="Team games" />
        <Legend color="var(--color-semantic-success)" label="Completed" />
        <span style={{ marginLeft: "auto" }}>
          {views.length} events · {doneCount} done
          {nextDays !== null && (
            <>
              {" "}
              · next in{" "}
              <span className="font-mono-sm" style={{ color: "var(--color-brand-accent)" }}>
                {nextDays}d
              </span>
            </>
          )}
        </span>
      </div>
    </section>
  );
}

function EventLeader({
  ev,
  trueX,
  evenX,
  widthPct,
  z,
  cardH,
  contentRef,
}: {
  ev: RaceView;
  trueX: number;
  evenX: number;
  widthPct: number;
  z: number;
  cardH: number | null;
  contentRef: (el: HTMLDivElement | null) => void;
}) {
  const isNext = ev.status === "next";
  const isPast = ev.status === "past";
  const color = isPast ? "var(--color-semantic-success)" : categoryColor(ev.category);
  const lc = isNext ? "var(--color-brand-accent)" : color;
  const lineOpacity = isNext ? 0.75 : 0.55;

  const segLeft = Math.min(trueX, evenX);
  const segRight = Math.max(trueX, evenX);

  return (
    <>
      {/* axis dot at the true date */}
      <div
        style={{
          position: "absolute",
          left: `${trueX}%`,
          top: AXIS_Y,
          transform: "translate(-50%,-50%)",
          width: 12,
          height: 12,
          borderRadius: 999,
          background: lc,
          zIndex: z + 10,
          boxShadow: `0 0 0 4px color-mix(in srgb, ${lc} 20%, var(--color-surface-card))`,
        }}
      >
        {isPast && (
          <Check
            size={8}
            strokeWidth={3}
            style={{ color: "#0D0D0D", position: "absolute", inset: 0, margin: "auto" }}
          />
        )}
      </div>

      {/* drop: axis dot → rail at true x */}
      <div
        style={{
          position: "absolute",
          left: `${trueX}%`,
          top: AXIS_Y,
          height: RAIL_Y - AXIS_Y,
          width: 2,
          background: lc,
          opacity: lineOpacity,
          transform: "translateX(-50%)",
          zIndex: z,
        }}
      />
      {/* horizontal rail segment: true x → even x (colored) */}
      <div
        style={{
          position: "absolute",
          left: `${segLeft}%`,
          width: `${segRight - segLeft}%`,
          top: RAIL_Y - 1,
          height: 2,
          background: lc,
          opacity: lineOpacity,
          zIndex: z,
        }}
      />
      {/* rail node at even x */}
      <div
        style={{
          position: "absolute",
          left: `${evenX}%`,
          top: RAIL_Y,
          transform: "translate(-50%,-50%)",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: lc,
          zIndex: z + 5,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${lc} 20%, var(--color-surface-card))`,
        }}
      />
      {/* riser: rail → card */}
      <div
        style={{
          position: "absolute",
          left: `${evenX}%`,
          top: RAIL_Y,
          height: CARD_TOP - RAIL_Y,
          width: 2,
          background: lc,
          opacity: lineOpacity,
          transform: "translateX(-50%)",
          zIndex: z,
        }}
      />

      {/* card */}
      <div
        style={{
          position: "absolute",
          left: `${evenX}%`,
          top: CARD_TOP,
          transform: "translateX(-50%)",
          width: `${widthPct}%`,
          ...(cardH ? { height: cardH } : {}),
          padding: `${CARD_PAD_Y}px 14px`,
          borderRadius: "var(--radius-card)",
          background: "var(--color-surface-elevated)",
          boxShadow: isNext
            ? "inset 0 0 0 1.5px var(--color-brand-accent)"
            : "inset 0 0 0 1px var(--color-outline)",
          opacity: isPast ? 0.85 : 1,
          zIndex: z + 1,
        }}
      >
        {/* content wrapper — unconstrained height, used to size all cards equally */}
        <div ref={contentRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
            <span
              className="text-label-sm"
              style={{ color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
            >
              {categoryLabel(ev.category)}
            </span>
            {isPast ? (
              <Check size={13} strokeWidth={3} style={{ color: "var(--color-semantic-success)", flexShrink: 0 }} />
            ) : (
              <span
                className="font-mono-xs"
                style={{
                  padding: "2px 6px",
                  borderRadius: 999,
                  flexShrink: 0,
                  background: isNext ? "rgba(174,51,237,0.15)" : "var(--color-surface-chip)",
                  color: isNext ? "var(--color-brand-accent)" : "var(--color-text-tertiary)",
                }}
              >
                {countLabel(ev)}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 500,
              fontSize: 17,
              lineHeight: 1.1,
              color: "var(--color-text-primary)",
            }}
          >
            {ev.name}
          </div>
          <div
            className="font-mono-xs"
            style={{ color: "var(--color-text-tertiary)", display: "flex", flexWrap: "wrap", gap: "3px 10px" }}
          >
            <MetaBit icon={<Calendar size={10} />} text={ev.dateLabel} />
            {ev.location && <MetaBit icon={<MapPin size={10} />} text={ev.location} />}
            {ev.eventTarget && <MetaBit icon={<Tag size={10} />} text={ev.eventTarget} />}
          </div>
          {(ev.resultTime || ev.resultPlacement) && (
            <div
              className="font-mono-xs"
              style={{ color: "var(--color-semantic-success)", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Clock size={10} />
              {[ev.resultTime, ev.resultPlacement].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MetaBit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
      <span style={{ display: "inline-flex", flexShrink: 0, opacity: 0.7 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </span>
  );
}

/** Relative countdown: today / in Nd / in Nw / in Nmo. */
function countLabel(ev: RaceView): string {
  const n = ev.daysUntil;
  if (n <= 0) return "today";
  if (n < 14) return `in ${n}d`;
  if (n < 70) return `in ${Math.round(n / 7)}w`;
  return `in ${Math.round(n / 30)}mo`;
}

function SegGroup({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function pct(d: Date, start: Date, end: Date): number {
  const total = +end - +start;
  if (total <= 0) return 0;
  return ((+d - +start) / total) * 100;
}

