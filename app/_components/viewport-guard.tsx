"use client";

import { useEffect, useState } from "react";

const MIN_WIDTH = 760;

export function ViewportGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tooSmall, setTooSmall] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MIN_WIDTH;
  });

  useEffect(() => {
    // Hydration gate: flip `ready` so the refusal UI can show after the
    // client has measured the real viewport. The cascade is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    const check = () => setTooSmall(window.innerWidth < MIN_WIDTH);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Avoid SSR / hydration mismatch — render children optimistically until
  // the first client-side measurement; then swap to refusal if needed.
  if (!ready || !tooSmall) return <>{children}</>;

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-2xl)",
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div
          className="text-label-md"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          DESKTOP ONLY
        </div>
        <h1
          className="text-headline-lg"
          style={{
            color: "var(--color-text-primary)",
            margin: "var(--space-sm) 0 var(--space-md)",
          }}
        >
          Use the mobile app for this view.
        </h1>
        <p
          className="text-body-md"
          style={{ color: "var(--color-text-secondary)", margin: 0 }}
        >
          The dashboard is built for ≥760px screens. Resize your window or
          switch to a laptop.
        </p>
      </div>
    </div>
  );
}
