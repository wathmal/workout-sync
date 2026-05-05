import { ReactNode } from "react";

export function EquipBadge({
  children,
  official = false,
}: {
  children: ReactNode;
  official?: boolean;
}) {
  return (
    <span
      className="text-label-sm"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-low)",
        color: official ? "var(--color-primary)" : "var(--color-text-tertiary)",
      }}
    >
      {children}
    </span>
  );
}
