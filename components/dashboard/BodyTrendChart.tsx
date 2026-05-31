"use client";

import type { TrendPoint } from "@/lib/dashboard/mock-data";
import { SectionHead } from "./SectionHead";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const RANGES = [
  { key: "7d", days: 7 },
  { key: "30d", days: 30 },
  { key: "90d", days: 90 },
  { key: "all", days: Infinity },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

export function BodyTrendChart({ series }: { series: TrendPoint[] }) {
  const [range, setRange] = useState<RangeKey>("90d");

  const visible = useMemo(() => {
    const cfg = RANGES.find((r) => r.key === range)!;
    if (!Number.isFinite(cfg.days)) return series;
    return series.slice(-cfg.days);
  }, [series, range]);

  // Pick one tick per month start in the visible range. Recharts uses these
  // as exact tick positions, so labels show only at month boundaries.
  const monthTicks = useMemo(() => {
    const seen = new Set<string>();
    const ticks: string[] = [];
    visible.forEach((p) => {
      const m = p.date.slice(0, 7); // YYYY-MM
      if (!seen.has(m)) {
        seen.add(m);
        ticks.push(p.date);
      }
    });
    return ticks;
  }, [visible]);

  const latest = visible[visible.length - 1];
  const earliest = visible[0];
  const bfDelta = latest && earliest ? latest.bodyFatPct - earliest.bodyFatPct : 0;
  const kgDelta = latest && earliest ? latest.weightKg - earliest.weightKg : 0;

  // Derive paired Y-axis domains so 4 gridlines line up cleanly.
  const bfMin = Math.floor(Math.min(...visible.map((p) => p.bodyFatPct)) * 2) / 2;
  const bfMax = Math.ceil(Math.max(...visible.map((p) => p.bodyFatPct)) * 2) / 2;
  const kgMin = Math.floor(Math.min(...visible.map((p) => p.weightKg)));
  const kgMax = Math.ceil(Math.max(...visible.map((p) => p.weightKg)));

  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <SectionHead
        size="md"
        overline={<>Body composition <Sep /> {range === "all" ? `${series.length} days` : range}</>}
        title="Trending lean."
        right={
          <div
            style={{
              display: "inline-flex",
              background: "var(--color-surface-elevated)",
              borderRadius: "var(--radius-sm)",
              padding: 2,
            }}
          >
            {RANGES.map((r) => {
              const active = r.key === range;
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRange(r.key)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: "var(--radius-sm)",
                    background: active ? "var(--color-surface-card)" : "transparent",
                    color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  {r.key}
                </button>
              );
            })}
          </div>
        }
      />

      {/* Legend strip with current values + deltas */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-lg)",
          fontSize: 11,
          color: "var(--color-text-tertiary)",
          marginBottom: "var(--space-sm)",
        }}
      >
        <LegendChip
          color="var(--color-data-1)"
          label="Body fat"
          value={latest ? `${latest.bodyFatPct.toFixed(1)}%` : "—"}
          delta={bfDelta}
          unit=""
        />
        <LegendChip
          color="var(--color-data-2)"
          label="Weight"
          value={latest ? `${latest.weightKg.toFixed(1)}kg` : "—"}
          delta={kgDelta}
          unit=""
        />
        <span style={{ marginLeft: "auto" }}>measured weekly · sat 7am</span>
      </div>

      <div style={{ height: 260, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visible} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickFormatter={(d: string) =>
                new Date(d).toLocaleString("en-US", { month: "short" })
              }
              ticks={monthTicks}
            />
            <YAxis
              yAxisId="bf"
              orientation="left"
              domain={[bfMin, bfMax]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v: number) => `${v}%`}
              width={36}
            />
            <YAxis
              yAxisId="kg"
              orientation="right"
              domain={[kgMin, kgMax]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v: number) => `${v}kg`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-outline)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
              itemStyle={{ color: "var(--color-text-primary)" }}
              formatter={(value, name) => {
                const v = Number(value);
                return name === "bodyFatPct" ? [`${v.toFixed(1)}%`, "BF"] : [`${v.toFixed(1)} kg`, "Weight"];
              }}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <Line
              yAxisId="bf"
              type="monotone"
              dataKey="bodyFatPct"
              stroke="var(--color-data-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: "var(--color-data-1)", strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="kg"
              type="monotone"
              dataKey="weightKg"
              stroke="var(--color-data-2)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: "var(--color-data-2)", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendChip({
  color,
  label,
  value,
  delta,
}: {
  color: string;
  label: string;
  value: string;
  delta: number;
  unit: string;
}) {
  const isGood = delta < 0; // for body comp, down = good
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          display: "inline-block",
        }}
      />
      {label}
      <span
        className="font-mono-sm"
        style={{ color: "var(--color-text-primary)" }}
      >
        {value}
      </span>
      {delta !== 0 && (
        <span
          className="font-mono-sm"
          style={{
            color: isGood
              ? "var(--color-semantic-success)"
              : "var(--color-semantic-warning)",
          }}
        >
          {delta < 0 ? "↓" : "↑"}
          {Math.abs(delta).toFixed(1)}
        </span>
      )}
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
