"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Size = "md" | "lg";

interface BaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  size?: Size;
  children?: ReactNode;
}

const sizePrimary: Record<Size, React.CSSProperties> = {
  md: { padding: "14px 26px", fontSize: 16, fontWeight: 500 },
  lg: { padding: "18px 32px", fontSize: 18, fontWeight: 500 },
};

const sizeGhost: Record<Size, React.CSSProperties> = {
  md: { padding: "13px 24px", fontSize: 16, fontWeight: 500 },
  lg: { padding: "17px 26px", fontSize: 18, fontWeight: 500 },
};

export function WPrimary({ children, icon, size = "md", style, disabled, ...rest }: BaseProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "var(--color-text-muted)" : "var(--gradient-primary)",
        color: "var(--color-on-brand)",
        borderRadius: "var(--radius-full)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: disabled ? "none" : "0 8px 24px -10px rgba(145,0,208,0.40)",
        fontFamily: "var(--font-body)",
        opacity: disabled ? 0.7 : 1,
        ...sizePrimary[size],
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function WGhost({ children, icon, size = "md", style, disabled, ...rest }: BaseProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        background: "transparent",
        color: "var(--color-primary)",
        border: "1.5px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
        borderRadius: "var(--radius-full)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: "var(--font-body)",
        opacity: disabled ? 0.5 : 1,
        ...sizeGhost[size],
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function WText({
  children,
  icon,
  color = "var(--color-primary)",
  style,
  ...rest
}: BaseProps & { color?: string }) {
  return (
    <button
      {...rest}
      style={{
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color,
        padding: 0,
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        fontSize: 14,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
