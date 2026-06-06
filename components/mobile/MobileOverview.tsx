"use client";

import { useMemo, useState } from "react";
import { Calendar, MapPin, Tag, Clock } from "lucide-react";
import { useDashboardWeek } from "@/app/_providers/dashboard-week-provider";
import { useRaces } from "@/app/_providers/race-provider";
import { CalorieSummary } from "@/components/dashboard/CalorieSummary";
import { MuscleCoverage } from "@/components/dashboard/MuscleCoverage";
import {
  TYPE,
  ORDER,
  fmtH,
  groupDay,
  weekBreakdown,
  type SessionGroup,
} from "@/lib/dashboard/agenda-view";
import type { DayAgenda, TrendPoint } from "@/lib/dashboard/mock-data";
import type { RaceView } from "@/lib/race/types";
import { categoryColor, categoryLabel } from "@/lib/race/types";

const FULL_DAY: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const SECTION_PAD = "16px 16px 0";

/** Server passes muscle SVG strings + the body-trend series (page-level mock). */
export function MobileOverview({
  svgs,
  trend,
}: {
  svgs: { front: string; back: string };
  trend: TrendPoint[];
}) {
  const { agendaDays, agendaRangeLabel, agendaLoading } = useDashboardWeek();
  const { views } = useRaces();

  return (
    <div>
      <Hero days={agendaDays} rangeLabel={agendaRangeLabel} />
      <Agenda days={agendaDays} loading={agendaLoading} />
      <div style={{ padding: SECTION_PAD }}>
        <CalorieSummary />
      </div>
      <div style={{ padding: SECTION_PAD }}>
        <MuscleCoverage svgs={svgs} />
      </div>
      <RaceSpine views={views} />
      <MobileBodyTrend series={trend} />
      <div style={{ height: 16 }} />
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────── */
function Hero({ days, rangeLabel }: { days: DayAgenda[]; rangeLabel: string }) {
  const today = days.find((d) => d.isToday);
  const wb = weekBreakdown(days);
  const workouts = (wb.byType.strength?.count ?? 0) + (wb.byType.hyrox?.count ?? 0);
  const runs = wb.byType.run?.count ?? 0;
  const overline = today
    ? `${FULL_DAY[today.day] ?? today.day} · ${rangeLabel}`
    : rangeLabel;

  const legend: { label: string; count: number; color: string }[] = [];
  for (const disc of ORDER) {
    const b = wb.byType[disc];
    if (b?.count) legend.push({ label: TYPE[disc].label, count: b.count, color: TYPE[disc].color });
  }
  if (wb.restDays > 0) {
    legend.push({ label: "Rest", count: wb.restDays, color: "var(--color-surface-disabled)" });
  }

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 10,
          letterSpacing: "1.4px",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
          marginBottom: 6,
        }}
      >
        {overline}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: 32,
          lineHeight: 1.05,
          letterSpacing: "-0.8px",
          color: "var(--color-text-primary)",
          margin: "0 0 12px",
        }}
      >
        {workouts} workout{workouts === 1 ? "" : "s"},{" "}
        <span style={{ color: "var(--color-text-tertiary)", fontWeight: 400 }}>
          {runs} run{runs === 1 ? "" : "s"}.
        </span>
      </h1>

      {legend.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
          }}
        >
          {legend.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              {l.label}{" "}
              <span style={{ color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                {l.count}×
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Agenda: single-day navigator + week strip ────────────────── */
function AgendaSkeleton() {
  return (
    <div style={{ padding: "16px 16px 0" }} aria-busy="true">
      <div
        style={{
          height: 252,
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface-card)",
        }}
      />
    </div>
  );
}

function Agenda({ days, loading }: { days: DayAgenda[]; loading: boolean }) {
  const todayIdx = days.findIndex((d) => d.isToday);
  // null = follow today; agendaDays loads async so we can't seed off todayIdx.
  const [picked, setIdx] = useState<number | null>(null);
  // /api/agenda (Garmin subprocess + Calendar + Hevy merge) is slower than the
  // local food data, so reserve the height with a skeleton while it loads.
  if (days.length === 0) return loading ? <AgendaSkeleton /> : null;
  const lastIdx = days.length - 1;
  const idx = Math.min(picked ?? (todayIdx >= 0 ? todayIdx : 0), lastIdx);
  const day = days[idx];
  const groups = groupDay(day);
  const isRest = day.isRest || day.sessions.length === 0;

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ background: "var(--color-surface-card)", borderRadius: "var(--radius-lg)", padding: 14 }}>
        {/* day title — same font/size as other card titles; tap the week strip to navigate */}
        <div style={{ marginBottom: isRest ? 4 : 14 }}>
          <span
            className="text-headline-md"
            style={{
              color: day.isToday ? "var(--color-brand-accent)" : "var(--color-text-primary)",
            }}
          >
            {FULL_DAY[day.day] ?? day.day}
          </span>
        </div>

        {/* sessions / rest */}
        {isRest ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 64, padding: "4px 0 12px" }}>
            <span style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 16, color: "var(--color-text-muted)" }}>
              Rest
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => (
              <SessionRow key={g.name} g={g} />
            ))}
          </div>
        )}

        {/* week strip */}
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
          }}
        >
          {days.map((d, i) => {
            const isActive = i === idx;
            const dGroups = groupDay(d);
            return (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`${d.day} ${d.date}`}
                style={{
                  border: isActive ? "1px solid color-mix(in srgb, var(--color-brand-accent) 45%, transparent)" : "1px solid transparent",
                  background: isActive ? "color-mix(in srgb, var(--color-brand-accent) 12%, transparent)" : "var(--color-surface-low)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 0",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: 9,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: isActive ? "var(--color-brand-accent)" : "var(--color-text-tertiary)",
                  }}
                >
                  {d.day.slice(0, 2)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    fontSize: 15,
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {d.date}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                  {dGroups.length > 0 ? (
                    dGroups.slice(0, 3).map((g, gi) => (
                      <span key={gi} style={{ width: 6, height: 6, borderRadius: 2, background: TYPE[g.type].color }} />
                    ))
                  ) : d.isRest ? (
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-surface-disabled)" }} />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SessionRow({ g }: { g: SessionGroup }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE[g.type].color, flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)" }}>
            {g.name}
          </span>
          {g.count > 1 && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 10,
                color: "var(--color-text-tertiary)",
                background: "var(--color-surface-chip)",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              ×{g.count}
            </span>
          )}
        </div>
        {g.hasDuration && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-muted)" }}>
            {fmtH(g.mins)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Race spine ───────────────────────────────────────────────── */
const raceCountdown = (r: RaceView): string | null => {
  const d = r.daysUntil;
  if (d <= 0) return null;
  if (d < 14) return `in ${d}d`;
  if (d < 60) return `in ${Math.round(d / 7)}w`;
  return `in ${Math.round(d / 30)}mo`;
};

function SpineRow({ race, isNext }: { race: RaceView; isNext?: boolean }) {
    const isPast = race.status === "past";
    const dot = isPast
      ? "var(--color-semantic-success)"
      : isNext
        ? "var(--color-brand-accent)"
        : categoryColor(race.category);
    const cd = raceCountdown(race);
    const result = race.resultTime ?? race.resultPlacement ?? null;
    return (
      <div style={{ display: "flex", marginBottom: isNext ? 4 : 16 }}>
        <div style={{ width: 28, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3 }}>
          <div
            style={{
              width: isNext ? 13 : 9,
              height: isNext ? 13 : 9,
              borderRadius: 999,
              background: dot,
              zIndex: 2,
              border: "2px solid var(--color-surface-card)",
              boxShadow: isNext ? "0 0 0 3px color-mix(in srgb, var(--color-brand-accent) 22%, transparent)" : "none",
              opacity: isPast ? 0.65 : 1,
            }}
          />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: isNext ? "1px solid var(--color-brand-accent)" : "none",
            borderRadius: isNext ? "var(--radius-md)" : 0,
            padding: isNext ? "10px 12px" : "0 0 0 2px",
            opacity: isPast ? 0.65 : 1,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  fontSize: 9,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  color: isPast ? "var(--color-semantic-success)" : categoryColor(race.category),
                  marginBottom: 2,
                }}
              >
                {categoryLabel(race.category)}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16, color: "var(--color-text-primary)", lineHeight: 1.2, marginBottom: 4 }}>
                {race.name}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-tertiary)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <Calendar size={9} />
                  {race.dateLabel}
                </span>
                {race.location && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={9} />
                    {race.location}
                  </span>
                )}
                {race.eventTarget && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Tag size={9} />
                    {race.eventTarget}
                  </span>
                )}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              {isPast && result && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-semantic-success)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <Clock size={10} />
                  {result}
                </span>
              )}
              {!isPast && cd && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: isNext ? 12 : 11,
                    color: isNext ? "var(--color-brand-accent)" : "var(--color-text-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cd}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
}

function SLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", marginBottom: 8 }}>
      <div style={{ width: 28, flexShrink: 0 }} />
      <span
        style={{
          paddingLeft: 2,
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: 9,
          letterSpacing: "1.4px",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function RaceSpine({ views }: { views: RaceView[] }) {
  if (views.length === 0) return null;
  const past = views.filter((r) => r.status === "past");
  const next = views.find((r) => r.status === "next") ?? null;
  const upcoming = views.filter((r) => r.status === "upcoming");
  const done = past.length;

  return (
    <div style={{ padding: SECTION_PAD }}>
      <div style={{ background: "var(--color-surface-card)", borderRadius: "var(--radius-card)", padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 10, letterSpacing: "1.3px", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
            Long horizon · Race calendar.
          </span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--color-text-muted)" }}>
            {views.length} events · {done} done
          </span>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 13, top: 4, bottom: 20, width: 1, background: "var(--color-outline)", zIndex: 1 }} />
          {past.length > 0 && (
            <div>
              <SLabel label="Completed" />
              {past.map((r) => (
                <SpineRow key={r.id} race={r} />
              ))}
            </div>
          )}
          {next && (
            <div style={{ marginBottom: 4 }}>
              <SLabel label="Next up" />
              <SpineRow race={next} isNext />
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <SLabel label="Later" />
              {upcoming.slice(0, 4).map((r) => (
                <SpineRow key={r.id} race={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Body trend (self-contained SVG — responsive viewBox, no recharts) ── */
const TREND_RANGES = [
  { k: "7d", n: 7 },
  { k: "30d", n: 30 },
  { k: "90d", n: 90 },
] as const;
type TrendRange = (typeof TREND_RANGES)[number]["k"];

function MobileBodyTrend({ series }: { series: TrendPoint[] }) {
  const [range, setRange] = useState<TrendRange>("90d");
  const visible = useMemo(() => {
    const cfg = TREND_RANGES.find((r) => r.k === range)!;
    return series.slice(-cfg.n);
  }, [series, range]);
  if (visible.length < 2) return null;

  const W = 600;
  const H = 150;
  const bfs = visible.map((p) => p.bodyFatPct);
  const kgs = visible.map((p) => p.weightKg);
  const bfMin = Math.floor(Math.min(...bfs) * 2) / 2;
  const bfMax = Math.ceil(Math.max(...bfs) * 2) / 2;
  const kgMin = Math.floor(Math.min(...kgs));
  const kgMax = Math.ceil(Math.max(...kgs));
  const xs = (i: number) => (i / (visible.length - 1)) * W;
  const ybf = (v: number) => H - ((v - bfMin) / (bfMax - bfMin || 1)) * H;
  const ykg = (v: number) => H - ((v - kgMin) / (kgMax - kgMin || 1)) * H;
  const pathBf = visible.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ybf(p.bodyFatPct).toFixed(1)}`).join(" ");
  const pathKg = visible.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ykg(p.weightKg).toFixed(1)}`).join(" ");
  const latest = visible[visible.length - 1];
  const first = visible[0];
  const bfD = latest.bodyFatPct - first.bodyFatPct;
  const kgD = latest.weightKg - first.weightKg;

  const months: { i: number; label: string }[] = [];
  const seen = new Set<string>();
  visible.forEach((p, i) => {
    const m = p.date.slice(0, 7);
    if (!seen.has(m)) {
      seen.add(m);
      months.push({ i, label: new Date(`${p.date}T00:00`).toLocaleString("en-US", { month: "short" }) });
    }
  });

  const chips = [
    { color: "var(--color-data-1)", label: "Body fat", value: `${latest.bodyFatPct.toFixed(1)}%`, delta: bfD },
    { color: "var(--color-data-2)", label: "Weight", value: `${latest.weightKg.toFixed(1)}kg`, delta: kgD },
  ];

  return (
    <div style={{ padding: SECTION_PAD }}>
      <div style={{ background: "var(--color-surface-card)", borderRadius: "var(--radius-card)", padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, gap: 12 }}>
          <div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                color: "var(--color-text-tertiary)",
                marginBottom: 3,
              }}
            >
              Body composition · {range}
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 18, color: "var(--color-text-primary)", margin: 0 }}>
              Trending lean.
            </h2>
          </div>
          <div style={{ display: "inline-flex", background: "var(--color-surface-elevated)", borderRadius: "var(--radius-sm)", padding: 2, flexShrink: 0 }}>
            {TREND_RANGES.map((r) => {
              const on = r.k === range;
              return (
                <button
                  key={r.k}
                  onClick={() => setRange(r.k)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 500,
                    border: 0,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    borderRadius: "var(--radius-sm)",
                    background: on ? "var(--color-surface-card)" : "transparent",
                    color: on ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  }}
                >
                  {r.k}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 12 }}>
          {chips.map((c) => (
            <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: c.color }} />
              {c.label}
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {c.value}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  color: c.delta < 0 ? "var(--color-semantic-success)" : "var(--color-semantic-warning)",
                }}
              >
                {c.delta < 0 ? "↓" : "↑"}
                {Math.abs(c.delta).toFixed(1)}
              </span>
            </span>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block", overflow: "visible" }}>
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(150,150,150,0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={pathKg} fill="none" stroke="var(--color-data-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={pathBf} fill="none" stroke="var(--color-data-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <circle cx={xs(visible.length - 1)} cy={ykg(latest.weightKg)} r="3" fill="var(--color-data-2)" />
            <circle cx={xs(visible.length - 1)} cy={ybf(latest.bodyFatPct)} r="3" fill="var(--color-data-1)" />
          </svg>
          <div style={{ display: "flex", position: "relative", height: 16, marginTop: 4 }}>
            {months.map((m, k) => (
              <span
                key={k}
                style={{
                  position: "absolute",
                  left: `${(m.i / (visible.length - 1)) * 100}%`,
                  transform: "translateX(-50%)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-text-tertiary)",
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--color-text-muted)", marginTop: 10 }}>
          measured weekly · sat 7am
        </div>
      </div>
    </div>
  );
}
