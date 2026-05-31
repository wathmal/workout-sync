"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: "var(--space-lg)",
        background: "color-mix(in srgb, var(--color-surface-base) 70%, transparent)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-outline)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 24px 64px -16px rgba(0,0,0,0.5)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-lg) var(--space-xl)",
            borderBottom: "1px solid var(--color-outline)",
          }}
        >
          <span className="text-title-sm" style={{ color: "var(--color-text-primary)" }}>
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "inline-flex",
              padding: 6,
              borderRadius: 999,
              border: 0,
              background: "transparent",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: "var(--space-xl)" }}>{children}</div>

        {footer && (
          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-sm)",
              padding: "var(--space-md) var(--space-xl) var(--space-lg)",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
