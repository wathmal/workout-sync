import { CSSProperties, ReactNode } from "react";

export function Overline({
  children,
  color,
  className,
  style,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`text-label-md ${className ?? ""}`}
      style={{ color: color ?? "var(--color-text-tertiary)", ...style }}
    >
      {children}
    </div>
  );
}
