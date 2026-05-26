"use client";

import type { OverviewMock } from "@/lib/dashboard/mock-data";
import { SectionHead } from "./SectionHead";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertTriangle } from "lucide-react";

type Calories = OverviewMock["calories"];

// Mock targets stored as kcal contributions, not grams. Stack boundaries map
// to cumulative kcal totals: P, P+C, P+C+F (= total target).
export function CalorieSummary({ data }: { data: Calories }) {
  const targetP = data.targetProtein;
  const targetPC = targetP + data.targetCarbs;
  const targetTotal = targetPC + data.targetFat;

  const targetTotalKcal = data.targetProtein + data.targetCarbs + data.targetFat;
  const chartData = data.week.map((d) => ({
    day: d.day,
    protein: d.protein,
    carbs: d.carbs,
    fat: d.fat,
    total: d.total,
    plannedGhost: d.isPlanned ? targetTotalKcal : 0,
    isToday: !!d.isToday,
    isPlanned: !!d.isPlanned,
  }));

  // Today's macros in grams (derived from kcal stack) for the bottom strip.
  const today = data.week.find((d) => d.isToday);
  const macros = today
    ? {
        protein: Math.round(today.protein / 4),
        carbs: Math.round(today.carbs / 4),
        fat: Math.round(today.fat / 9),
      }
    : { protein: 0, carbs: 0, fat: 0 };
  const macroTargets = {
    protein: Math.round(data.targetProtein / 4),
    carbs: Math.round(data.targetCarbs / 4),
    fat: Math.round(data.targetFat / 9),
  };

  return (
    <Card>
      <SectionHead
        size="md"
        overline={<>Nutrition <Sep /> May 18 – 24</>}
        title="Calories vs target."
        right={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(255,201,74,0.14)",
              color: "var(--color-semantic-warning)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={11} />
            +{data.avgDelta} avg
          </span>
        }
      />

      <div style={{ height: 280, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 96, left: 0, bottom: 24 }}
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
                      {planned ? "—" : item?.total.toLocaleString()}
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
              label={{
                value: "P",
                position: "right",
                fill: "var(--color-data-2)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
            <ReferenceLine
              y={targetPC}
              stroke="var(--color-data-3)"
              strokeDasharray="2 3"
              strokeOpacity={0.55}
              label={{
                value: "P+C",
                position: "right",
                fill: "var(--color-data-3)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
            <ReferenceLine
              y={targetTotal}
              stroke="var(--color-data-4)"
              strokeDasharray="2 3"
              strokeOpacity={0.75}
              label={{
                value: "target · P+C+F",
                position: "right",
                fill: "var(--color-data-4)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
            <Bar
              dataKey="plannedGhost"
              stackId="m"
              fill="transparent"
              stroke="var(--color-outline)"
              strokeDasharray="3 4"
              strokeWidth={1}
              isAnimationActive={false}
              maxBarSize={56}
            />
            <Bar dataKey="protein" stackId="m" fill="var(--color-data-2)" isAnimationActive={false} maxBarSize={56}>
              {chartData.map((d, i) => (
                <Cell key={i} fillOpacity={d.isPlanned ? 0 : d.isToday ? 0.85 : 1} />
              ))}
            </Bar>
            <Bar dataKey="carbs" stackId="m" fill="var(--color-data-3)" isAnimationActive={false} maxBarSize={56}>
              {chartData.map((d, i) => (
                <Cell key={i} fillOpacity={d.isPlanned ? 0 : d.isToday ? 0.85 : 1} />
              ))}
            </Bar>
            <Bar
              dataKey="fat"
              stackId="m"
              fill="var(--color-data-4)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false} maxBarSize={56}
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
        style={{
          display: "flex",
          gap: "var(--space-md)",
          marginTop: "var(--space-sm)",
          fontSize: 11,
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
            Today <Sep /> {data.todayMeals.length} meals
          </span>
          <span
            className="font-mono-sm"
            style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}
          >
            {data.todayMeals.reduce((s, m) => s + m.kcal, 0).toLocaleString()} /{" "}
            {data.targetTotal.toLocaleString()} kcal
          </span>
        </div>
        {data.todayMeals.map((m, i) => (
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
              className="font-mono-sm"
              style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}
            >
              {m.time}
            </span>
            <span
              style={{ fontSize: 13, color: "var(--color-text-primary)" }}
            >
              {m.name}
            </span>
            <span
              className="font-mono-sm"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {m.kcal}
              <small style={{ color: "var(--color-text-tertiary)" }}> kcal</small>
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
          consumed={macros.protein}
          target={macroTargets.protein}
          color="var(--color-data-2)"
        />
        <MacroBar
          label="Carbs"
          consumed={macros.carbs}
          target={macroTargets.carbs}
          color="var(--color-data-3)"
        />
        <MacroBar
          label="Fat"
          consumed={macros.fat}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          className="text-label-md"
          style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}
        >
          {label}
        </span>
        <span
          className="font-mono-sm"
          style={{ fontSize: 14, color: "var(--color-text-primary)" }}
        >
          {consumed}
          <small style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>
            {" "}/ {target}g
          </small>
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
