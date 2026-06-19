"use client";

import Link from "next/link";

/** Button on the muscle-coverage card → opens the suggestion page. */
export function SuggestWorkout() {
  return (
    <Link
      href="/suggest"
      style={{
        marginTop: "var(--space-xs)",
        padding: "10px var(--space-sm)",
        width: "100%",
        background: "var(--color-brand-primary)",
        color: "var(--color-text-on-brand)",
        border: "none",
        borderRadius: "var(--radius-md)",
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      Suggest today&apos;s workout
    </Link>
  );
}
