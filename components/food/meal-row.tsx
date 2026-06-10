import type React from "react";

/**
 * Shared visual tokens for meal/food rows so every surface — the food page
 * TodayStrip, the Favorites tab, and the dashboard CalorieSummary — renders the
 * same macro chips, kcal cell, and icon buttons. Keep all meal-row presentation
 * here; don't fork per-surface copies.
 */

export const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: 0,
  color: "var(--color-text-tertiary)",
  cursor: "pointer",
  padding: 0,
};

export function MacroChips({
  p,
  c,
  f,
  className,
}: {
  p: number;
  c: number;
  f: number;
  className?: string;
}) {
  // padStart to 3 chars + white-space: pre keeps the leading space so single-
  // and double-digit values align under each other in the monospace font.
  const fmt = (n: number) => String(Math.round(n)).padStart(3, " ");
  const sep = <span style={{ color: "var(--color-outline)" }}>·</span>;
  const cell: React.CSSProperties = { whiteSpace: "pre" };
  return (
    <span
      className={`font-mono-sm food-macros ${className ?? ""}`}
      style={{
        fontSize: 11,
        color: "var(--color-text-tertiary)",
        display: "inline-flex",
        alignItems: "baseline",
        justifyContent: "flex-end",
        gap: 6,
        width: 140,
      }}
    >
      <span style={cell}>P {fmt(p)}</span>
      <span className="food-macros-extra" style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        {sep}
        <span style={cell}>C {fmt(c)}</span>
        {sep}
        <span style={cell}>F {fmt(f)}</span>
      </span>
    </span>
  );
}

export function KcalCell({
  kcal,
  size = 13,
  className,
}: {
  kcal: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`font-mono-sm ${className ?? ""}`}
      style={{
        fontSize: size,
        color: "var(--color-text-secondary)",
        display: "inline-block",
        width: 86,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {Math.round(kcal)}
      <small style={{ color: "var(--color-text-tertiary)" }}> kcal</small>
    </span>
  );
}
