"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CircleUser, Moon, RefreshCw, Sun } from "lucide-react";
import { refreshDashboard } from "@/app/_actions/refresh";

const REFRESH_MIN = 15;

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/upload", label: "Log Workout" },
  { href: "/food", label: "Log Food" },
] as const;

const ENV_LABEL = "DEV";

function WordmarkGlyph() {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 7,
        flexShrink: 0,
        background: "var(--gradient-primary)",
      }}
    >
      <svg viewBox="0 0 1024 1024" width="16" height="16" fill="#fff" fillOpacity="0.95">
        <path d="M180 200 L770 200 C780 200 790 204 797 211 L853 271 C863 281 863 297 853 307 L797 367 C790 374 780 378 770 378 L350 378 L350 470 L620 470 C630 470 639 474 646 481 L687 524 C696 534 696 549 687 559 L646 602 C639 609 630 613 620 613 L350 613 L350 868 C350 880 340 890 328 890 L202 890 C190 890 180 880 180 868 L180 222 C180 210 190 200 202 200 Z" />
      </svg>
    </span>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [mins, setMins] = useState(0);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as
      | "dark"
      | "light"
      | null) ?? "dark";
    setTheme(current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setMins((m) => m + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const sinceCycle = mins % REFRESH_MIN;
  const updated =
    sinceCycle === 0
      ? "Last updated just now"
      : `Last updated ${sinceCycle}m ago`;

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
    <nav
      aria-label="Primary"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        padding: "0 24px",
        background: "var(--color-surface-base)",
        borderBottom: "1px solid var(--color-outline)",
      }}
    >
      {/* Logo cluster — two-line stack + env pill, mirrors vocab-app admin */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
          textDecoration: "none",
          color: "var(--color-text-primary)",
        }}
      >
        <WordmarkGlyph />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 18,
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
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-text-tertiary)",
              }}
            >
              Sync
            </span>
          </div>
          <span
            style={{
              width: "fit-content",
              padding: "1px 8px",
              lineHeight: 1.2,
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "color-mix(in srgb, var(--color-semantic-success) 18%, transparent)",
              color: "var(--color-semantic-success)",
            }}
          >
            {ENV_LABEL}
          </span>
        </div>
      </Link>

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 4,
        }}
      >
        {TABS.map((t) => {
          const active = pathname === t.href ||
            (t.href !== "/" && pathname.startsWith(`${t.href}/`));
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              style={{
                position: "relative",
                padding: "21px 12px",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: active ? 500 : 400,
                color: active
                  ? "var(--color-text-primary)"
                  : "var(--color-text-tertiary)",
                textDecoration: "none",
                transition: "color var(--motion-fast) var(--ease)",
              }}
            >
              {t.label}
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 0,
                    height: 2,
                    background: "var(--color-brand-accent)",
                    borderRadius: "2px 2px 0 0",
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Right cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span
          suppressHydrationWarning
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--color-text-tertiary)",
            whiteSpace: "nowrap",
          }}
          className="topnav-updated"
        >
          {mounted ? updated : ""}
        </span>

        <button
          type="button"
          onClick={() =>
            startRefresh(async () => {
              await refreshDashboard();
              router.refresh();
              setMins(0);
            })
          }
          disabled={refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 36,
            padding: "0 16px",
            borderRadius: 8,
            border: 0,
            background: "var(--gradient-primary)",
            color: "var(--color-text-on-brand)",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 14,
            cursor: refreshing ? "default" : "pointer",
            opacity: refreshing ? 0.7 : 1,
            transition: "filter 120ms, transform 120ms",
          }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-tl-spin" : ""} />
          Refresh
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            padding: 8,
            borderRadius: 999,
            border: 0,
            background: "transparent",
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mounted ? (
            theme === "dark" ? <Sun size={18} /> : <Moon size={18} />
          ) : (
            <span style={{ width: 18, height: 18, display: "inline-block" }} />
          )}
        </button>

        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "var(--color-surface-elevated)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <CircleUser size={18} color="var(--color-text-tertiary)" />
        </div>
      </div>
    </nav>
  );
}
