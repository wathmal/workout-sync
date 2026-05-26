import type { ReactNode } from "react";

export function SectionHead({
  overline,
  title,
  right,
  size = "lg",
}: {
  overline: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: "var(--space-sm)",
        gap: "var(--space-md)",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          className="text-label-md"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {overline}
        </div>
        <h2
          className={size === "lg" ? "text-headline-lg" : "text-headline-md"}
          style={{
            color: "var(--color-text-primary)",
            margin: "var(--space-2xs) 0 0",
          }}
        >
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}
