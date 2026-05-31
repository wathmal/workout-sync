"use client";

import type { CSSProperties, ReactNode } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-outline)",
  background: "var(--color-surface-elevated)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
};

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="text-label-md"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
        {hint && (
          <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
            {" "}
            · {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 36,
        padding: "0 16px",
        borderRadius: 8,
        border: 0,
        background: "var(--gradient-primary)",
        color: "var(--color-text-on-brand)",
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: 14,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 36,
        padding: "0 14px",
        borderRadius: 8,
        border: "1px solid var(--color-outline)",
        background: "transparent",
        color: danger ? "var(--color-semantic-error)" : "var(--color-text-secondary)",
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
