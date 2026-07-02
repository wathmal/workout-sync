"use client";

import { SectionHead, Sep } from "./SectionHead";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { useDashboardWeek } from "@/app/_providers/dashboard-week-provider";
import { useShell } from "@/app/_providers/shell-provider";
import { RaceFuelBanner } from "./RaceFuelBanner";

const DOW_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const GRAMS_KEY = {
  protein: "proteinG",
  carbs: "carbsG",
  fat: "fatG",
} as const;

interface TipProps {
  active?: boolean;
  label?: string;
  payload?: {
    dataKey: string;
    name: string;
    value: number;
    fill: string;
    payload: {
      isPlanned: boolean;
      total: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    };
  }[];
}

function ChartTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  // Planned (future) days carry only the dashed ghost bar — nothing to show.
  if (payload[0]?.payload.isPlanned) return null;
  const rows = payload
    .filter((p) => p.dataKey !== "plannedGhost" && p.value > 0)
    .map((p) => ({
      ...p,
      grams: p.payload[GRAMS_KEY[p.dataKey as keyof typeof GRAMS_KEY]] ?? 0,
    }));
  if (!rows.length) return null;
  const total = rows.reduce((s, p) => s + p.value, 0);
  return (
    <div
      style={{
        minWidth: 150,
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-outline)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      }}
    >
      <p className="text-label-sm" style={{ margin: 0, color: "var(--color-text-tertiary)" }}>
        {label}
      </p>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((p) => (
          <div
            key={p.dataKey}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
          >
            <span
              className="text-body-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--color-text-secondary)",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
              {p.name}
            </span>
            <span className="font-mono-sm" style={{ color: "var(--color-text-primary)" }}>
              {Math.round(p.grams)} g
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: "1px solid var(--color-outline)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>Total</span>
        <span className="font-mono-sm" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
          {Math.round(total)} kcal
        </span>
      </div>
    </div>
  );
}

export function CalorieSummary() {
  const {
    foodWeek: week,
    today,
    target,
    foodLoading: loading,
    isCurrent,
    rangeLabel,
  } = useDashboardWeek();
  // On mobile the reference-line labels (P / P+C / target) eat a 96px right
  // margin and squeeze the bars — drop them there; the legend below covers it.
  const { isMobile } = useShell();

  // Targets as kcal contributions (P×4, C×4, F×9). Falls back to a neutral
  // 2500 kcal target when no row exists yet so the chart still renders.
  const fallback = { kcal: 2500, proteinG: 150, carbsG: 280, fatG: 80 };
  const t = target ?? fallback;
  const targetP = t.proteinG * 4;
  const targetC = t.carbsG * 4;
  const targetF = t.fatG * 9;
  const targetPC = targetP + targetC;
  const targetTotal = targetPC + targetF;
  const targetTotalKcal = targetTotal;

  // Build 7-day stack. Server-side `week` already orders Mon..Sun.
  const safeWeek = week.length ? week : Array.from({ length: 7 }).map((_, i) => ({
    date: "",
    dow: i,
    proteinKcal: 0,
    carbsKcal: 0,
    fatKcal: 0,
    totalKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    isToday: false,
    isPlanned: true,
  }));
  const chartData = safeWeek.map((d) => ({
    day: DOW_LABELS[d.dow] ?? "",
    protein: d.proteinKcal,
    carbs: d.carbsKcal,
    fat: d.fatKcal,
    // Grams ride along for the tooltip; bars stack kcal (the chart's axis).
    proteinG: d.proteinG,
    carbsG: d.carbsG,
    fatG: d.fatG,
    total: d.totalKcal,
    plannedGhost: d.isPlanned ? targetTotalKcal : 0,
    isToday: d.isToday,
    isPlanned: d.isPlanned,
  }));

  // Today's macros in grams from logged items (more accurate than kcal-back-derivation).
  const todayMacros = today.reduce(
    (acc, m) => ({
      protein: acc.protein + m.proteinG,
      carbs: acc.carbs + m.carbsG,
      fat: acc.fat + m.fatG,
    }),
    { protein: 0, carbs: 0, fat: 0 },
  );
  // Past weeks have no "today" — show the week's daily-average instead (Mon..Sun / 7).
  const weekAvgMacros = {
    protein: safeWeek.reduce((s, d) => s + d.proteinG, 0) / 7,
    carbs: safeWeek.reduce((s, d) => s + d.carbsG, 0) / 7,
    fat: safeWeek.reduce((s, d) => s + d.fatG, 0) / 7,
  };
  const weekAvgKcal = Math.round(safeWeek.reduce((s, d) => s + d.totalKcal, 0) / 7);
  const macros = isCurrent ? todayMacros : weekAvgMacros;
  const macroTargets = {
    protein: t.proteinG,
    carbs: t.carbsG,
    fat: t.fatG,
  };

  // Group today's items by batch so each meal appears as one row in the strip.
  // Prefer LLM-assigned meal_name; fall back to first-item + "N more".
  const todayGroups = (() => {
    type Acc = {
      mealName: string | null;
      firstName: string;
      count: number;
      kcal: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      time: string;
    };
    const map = new Map<string, Acc>();
    for (const m of today) {
      const prev = map.get(m.batchId);
      const time = new Date(m.loggedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (!prev) {
        map.set(m.batchId, {
          mealName: m.mealName,
          firstName: m.name,
          count: 1,
          kcal: m.kcal,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          time,
        });
      } else {
        prev.count += 1;
        prev.kcal += m.kcal;
        prev.proteinG += m.proteinG;
        prev.carbsG += m.carbsG;
        prev.fatG += m.fatG;
      }
    }
    return Array.from(map.values())
      .map((g) => ({
        name: g.mealName ?? (g.count > 1 ? `${g.firstName} + ${g.count - 1} more` : g.firstName),
        kcal: g.kcal,
        proteinG: g.proteinG,
        carbsG: g.carbsG,
        fatG: g.fatG,
        time: g.time,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  })();

  // Avg delta over completed days (not today, not planned).
  const completed = safeWeek.filter((d) => !d.isToday && !d.isPlanned && d.totalKcal > 0);
  const avgDelta = completed.length
    ? Math.round(
        completed.reduce((s, d) => s + (d.totalKcal - targetTotal), 0) / completed.length,
      )
    : 0;
  const todayTotalKcal = today.reduce((s, m) => s + m.kcal, 0);

  return (
    <Card>
      <SectionHead
        size="md"
        overline={<>Nutrition <Sep /> {isCurrent ? "This week" : rangeLabel}</>}
        title="Calories vs target."
        right={
          avgDelta !== 0 ? (
            <span
              className="font-mono-xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 999,
                background: "rgba(255,201,74,0.14)",
                color: "var(--color-semantic-warning)",
              }}
            >
              <AlertTriangle size={11} />
              {avgDelta > 0 ? "+" : ""}
              {avgDelta} avg
            </span>
          ) : null
        }
      />

      {isCurrent && <RaceFuelBanner baseCarbG={t.carbsG} baseProteinG={t.proteinG} />}

      <div style={{ height: 280, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 12, left: 0, bottom: 24 }}
            barCategoryGap="16%"
          >
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload }) => {
                const item = chartData.find((d) => d.day === payload.value);
                const accent = item?.isToday;
                const planned = item?.isPlanned;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={6}
                      dy={12}
                      textAnchor="middle"
                      fontFamily="var(--font-body)"
                      fontWeight={600}
                      fontSize={11}
                      letterSpacing="0.08em"
                      fill={accent ? "var(--color-brand-accent)" : "var(--color-text-tertiary)"}
                    >
                      {payload.value}
                    </text>
                    <text
                      x={0}
                      y={20}
                      dy={12}
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                      fontSize={11}
                      fill={
                        planned
                          ? "var(--color-text-muted)"
                          : item && item.total > targetTotal
                          ? "var(--color-semantic-warning)"
                          : accent
                          ? "var(--color-brand-accent)"
                          : "var(--color-text-secondary)"
                      }
                    >
                      {planned
                        ? "—"
                        : isMobile
                        ? item && item.total > 0
                          ? `${(item.total / 1000).toFixed(1)}k`
                          : "0"
                        : item?.total.toLocaleString()}
                    </text>
                  </g>
                );
              }}
              interval={0}
              height={48}
            />
            <YAxis
              domain={[0, 3500]}
              ticks={[0, 1000, 2000, 3000]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-text-tertiary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v: number) => (v === 0 ? "" : v >= 1000 ? `${(v / 1000).toFixed(0)},000` : `${v}`)}
              width={48}
            />
            <ReferenceLine
              y={targetP}
              stroke="var(--color-data-2)"
              strokeDasharray="2 3"
              strokeOpacity={0.55}
            />
            <ReferenceLine
              y={targetPC}
              stroke="var(--color-data-3)"
              strokeDasharray="2 3"
              strokeOpacity={0.55}
            />
            <ReferenceLine
              y={targetTotal}
              stroke="var(--color-data-4)"
              strokeDasharray="2 3"
              strokeOpacity={0.75}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Bar
              dataKey="plannedGhost"
              stackId="m"
              fill="transparent"
              stroke="var(--color-outline)"
              strokeDasharray="3 4"
              strokeWidth={1}
              maxBarSize={56}
            />
            <Bar dataKey="protein" name="Protein" stackId="m" fill="var(--color-data-2)" maxBarSize={56}>
              {chartData.map((d, i) => (
                <Cell key={i} fillOpacity={d.isPlanned ? 0 : d.isToday ? 0.85 : 1} />
              ))}
            </Bar>
            <Bar dataKey="carbs" name="Carbs" stackId="m" fill="var(--color-data-3)" maxBarSize={56}>
              {chartData.map((d, i) => (
                <Cell key={i} fillOpacity={d.isPlanned ? 0 : d.isToday ? 0.85 : 1} />
              ))}
            </Bar>
            <Bar
              dataKey="fat"
              name="Fat"
              stackId="m"
              fill="var(--color-data-4)"
              radius={[3, 3, 0, 0]}
              maxBarSize={56}
              stroke="var(--color-brand-accent)"
              strokeDasharray="3 4"
              strokeWidth={1.4}
            >
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fillOpacity={d.isPlanned ? 0 : d.isToday ? 0.85 : 1}
                  strokeOpacity={d.isToday ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Macro legend strip */}
      <div
        className="font-mono-xs"
        style={{
          display: "flex",
          gap: "var(--space-md)",
          marginTop: "var(--space-sm)",
          color: "var(--color-text-tertiary)",
        }}
      >
        <LegendSwatch color="var(--color-data-2)" label="Protein" />
        <LegendSwatch color="var(--color-data-3)" label="Carbs" />
        <LegendSwatch color="var(--color-data-4)" label="Fat" />
      </div>

      {/* Today's meals */}
      <div
        style={{
          marginTop: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            className="text-label-md"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {isCurrent ? (
              <>Today <Sep /> {todayGroups.length} {todayGroups.length === 1 ? "meal" : "meals"}</>
            ) : (
              "Daily average"
            )}
          </span>
          <span
            className="font-mono-sm"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {(isCurrent ? Math.round(todayTotalKcal) : weekAvgKcal).toLocaleString()} /{" "}
            {targetTotal.toLocaleString()} kcal{isCurrent ? "" : " avg/day"}
          </span>
        </div>
        {isCurrent && loading && todayGroups.length === 0 && (
          <div
            className="text-body-sm"
            style={{ padding: "var(--space-sm)", color: "var(--color-text-tertiary)" }}
          >
            Loading…
          </div>
        )}
        {isCurrent && !loading && todayGroups.length === 0 && (
          <div
            className="text-body-sm"
            style={{ padding: "var(--space-sm)", color: "var(--color-text-tertiary)" }}
          >
            Nothing logged yet today.
          </div>
        )}
        {isCurrent && todayGroups.map((m, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "48px 1fr auto",
              gap: "var(--space-sm)",
              alignItems: "center",
              padding: "6px var(--space-sm)",
              background: "var(--color-surface-low)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span
              className="font-mono-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {m.time}
            </span>
            <span
              className="text-body-sm"
              style={{ color: "var(--color-text-primary)" }}
            >
              {m.name}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span
                className="font-mono-xs"
                style={{
                  color: "var(--color-text-tertiary)",
                  whiteSpace: "nowrap",
                  display: "inline-block",
                  minWidth: 50,
                  textAlign: "right",
                }}
              >
                P {Math.round(m.proteinG)}
              </span>
              <span
                className="font-mono-sm"
                style={{
                  color: "var(--color-text-secondary)",
                  display: "inline-block",
                  minWidth: 80,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {Math.round(m.kcal)}
                <small style={{ color: "var(--color-text-tertiary)" }}> kcal</small>
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Macro progress strip — P/C/F in grams */}
      <div
        style={{
          marginTop: "var(--space-md)",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--space-sm)",
        }}
      >
        <MacroBar
          label="Protein"
          consumed={Math.round(macros.protein)}
          target={macroTargets.protein}
          color="var(--color-data-2)"
        />
        <MacroBar
          label="Carbs"
          consumed={Math.round(macros.carbs)}
          target={macroTargets.carbs}
          color="var(--color-data-3)"
        />
        <MacroBar
          label="Fat"
          consumed={Math.round(macros.fat)}
          target={macroTargets.fat}
          color="var(--color-data-4)"
        />
      </div>
    </Card>
  );
}

function MacroBar({
  label,
  consumed,
  target,
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <div
      style={{
        background: "var(--color-surface-low)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* label stacked over the value */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span
          className="text-label-sm"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {label}
        </span>
        <span
          className="font-mono-sm"
          style={{ color: "var(--color-text-primary)", whiteSpace: "nowrap" }}
        >
          {consumed}
          <span style={{ color: "var(--color-text-tertiary)" }}>
            {" "}/ {target}g
          </span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--color-surface-disabled)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 12, height: 8, background: color, borderRadius: 2 }} />
      {label}
    </span>
  );
}

