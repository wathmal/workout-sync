"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, RefreshCw, Sun, Moon } from "lucide-react";
import { useHevy } from "@/app/_providers/hevy-provider";
import { useFoodLog } from "@/app/_providers/food-log-provider";
import { useAgenda } from "@/app/_providers/agenda-provider";

// Overview-only top chrome (per plan, off-dashboard pages keep their own
// header). Mock visual + the real TopNav refresh/sync/theme wiring.
export function MobileTopBar() {
  const { refresh: refreshHevy, lastFetched: hevyLastFetched } = useHevy();
  const { refresh: refreshFood, lastFetched: foodLastFetched } = useFoodLog();
  const { sync: syncAgenda, syncError } = useAgenda();

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const current =
      (document.documentElement.getAttribute("data-theme") as "dark" | "light" | null) ??
      "dark";
    setTheme(current);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const oldest = (() => {
    const a = hevyLastFetched ?? Infinity;
    const b = foodLastFetched ?? Infinity;
    const min = Math.min(a, b);
    return Number.isFinite(min) ? min : null;
  })();
  const ageMin = oldest == null ? null : Math.max(0, Math.floor((now - oldest) / 60_000));
  const updated =
    refreshing ? "Refreshing…" : ageMin == null ? "" : ageMin === 0 ? "just now" : `${ageMin}m ago`;

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("workout-sync:theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--color-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--color-outline)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        height: 52,
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "var(--gradient-primary)",
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 1024 1024" width="16" height="16" fill="#fff" fillOpacity="0.95">
            <path d="M180 200 L770 200 C780 200 790 204 797 211 L853 271 C863 281 863 297 853 307 L797 367 C790 374 780 378 770 378 L350 378 L350 470 L620 470 C630 470 639 474 646 481 L687 524 C696 534 696 549 687 559 L646 602 C639 609 630 613 620 613 L350 613 L350 868 C350 880 340 890 328 890 L202 890 C190 890 180 880 180 868 L180 222 C180 210 190 200 202 200 Z" />
          </svg>
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
              color: "var(--color-text-primary)",
            }}
          >
            Fit
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 400,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            Sync
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {syncError && !refreshing && (
          <span
            title={syncError}
            aria-label={`Sync error: ${syncError}`}
            style={{ display: "inline-flex", color: "var(--color-semantic-warning)" }}
          >
            <AlertTriangle size={14} />
          </span>
        )}
        <span
          suppressHydrationWarning
          style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--color-text-muted)" }}
        >
          {mounted ? updated : ""}
        </span>
        <button
          type="button"
          onClick={() =>
            startRefresh(async () => {
              await Promise.all([refreshHevy(), refreshFood(), syncAgenda()]);
              setNow(Date.now());
            })
          }
          disabled={refreshing}
          aria-label="Refresh"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 30,
            padding: "0 12px",
            borderRadius: 8,
            border: 0,
            background: "var(--gradient-primary)",
            color: "var(--color-text-on-brand)",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 12,
            cursor: refreshing ? "default" : "pointer",
            opacity: refreshing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={12} className={refreshing ? "animate-tl-spin" : ""} />
          Refresh
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            padding: 6,
            borderRadius: 999,
            border: 0,
            background: "transparent",
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
            display: "inline-flex",
          }}
        >
          {mounted ? theme === "dark" ? <Sun size={16} /> : <Moon size={16} /> : <span style={{ width: 16, height: 16 }} />}
        </button>
      </div>
    </header>
  );
}
