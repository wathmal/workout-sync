"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Overline } from "./overline";

interface HevyUser {
  connected: boolean;
  name?: string;
  url?: string;
}

interface NavItemProps {
  id: string;
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  icon: (size: number, color: string) => React.ReactNode;
}

function NavItem({ id, label, href, active, disabled, icon }: NavItemProps) {
  const color = active ? "var(--color-primary)" : "var(--color-text-tertiary)";
  const inner = (
    <div
      data-sidebar-item={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 32,
        padding: "0 10px",
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active ? "rgba(145,0,208,0.10)" : "transparent",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div style={{ width: 16, display: "flex" }}>{icon(16, color)}</div>
      <span
        data-sidebar-label
        className="text-title-sm"
        style={{
          fontWeight: active ? 500 : 400,
          color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
        }}
      >
        {label}
      </span>
    </div>
  );

  if (disabled || !href) {
    return (
      <div aria-disabled={disabled} role="link" tabIndex={-1}>
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  );
}

const iconSync = (s: number, c: string) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path
      d="M3 12a9 9 0 0115-6.7L21 8M21 12a9 9 0 01-15 6.7L3 16M21 3v5h-5M3 21v-5h5"
      stroke={c}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const iconHistory = (s: number, c: string) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path
      d="M3 12a9 9 0 109-9 9 9 0 00-7 3.5M3 4v3h3"
      stroke={c}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 7v5l3 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const iconTrend = (s: number, c: string) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path
      d="M3 17l6-6 4 4 8-8M14 7h7v7"
      stroke={c}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const iconSettings = (s: number, c: string) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.6" />
    <path
      d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H2a2 2 0 110-4h.09A1.7 1.7 0 003.6 8a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 008 3.6 1.7 1.7 0 009 2.05V2a2 2 0 114 0v.09A1.7 1.7 0 0015 3.6a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0020.4 8c.18.42.55.74 1.05 1H22a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z"
      stroke={c}
      strokeWidth="1.4"
    />
  </svg>
);

export function Sidebar() {
  const pathname = usePathname();
  const syncActive = pathname === "/" || pathname === "/review" || pathname === "/sync";

  const [user, setUser] = useState<HevyUser>({ connected: false });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hevy-user")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.connected) {
          setUser({ connected: true, name: data.name, url: data.url });
        } else {
          setUser({ connected: false });
        }
      })
      .catch(() => {
        if (!cancelled) setUser({ connected: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handle = user.url
    ? user.url.replace(/^https?:\/\/(www\.)?hevy\.com\/user\//, "@").replace(/\/$/, "")
    : null;

  return (
    <aside
      className="app-sidebar"
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--color-low)",
        padding: "16px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "2px 10px 16px",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: "var(--gradient-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 10v4M22 10v4M5 7v10a1 1 0 001 1h1a1 1 0 001-1V7a1 1 0 00-1-1H6a1 1 0 00-1 1zM16 7v10a1 1 0 001 1h1a1 1 0 001-1V7a1 1 0 00-1-1h-1a1 1 0 00-1 1zM8 12h8"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div
          data-sidebar-logo-text
          className="text-title-md"
          style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
        >
          Worksync
        </div>
      </div>

      <Overline style={{ padding: "6px 10px 4px", fontSize: 9 }}>
        <span data-sidebar-overline>WORKSPACE</span>
      </Overline>
      <NavItem id="sync" label="Sync" href="/" active={syncActive} icon={iconSync} />
      <NavItem id="history" label="History" disabled icon={iconHistory} />
      <NavItem id="trends" label="Trends" disabled icon={iconTrend} />

      <div style={{ flex: 1 }} />

      <Overline style={{ padding: "6px 10px 4px", fontSize: 9 }}>
        <span data-sidebar-overline>ACCOUNT</span>
      </Overline>
      <NavItem id="settings" label="Settings" disabled icon={iconSettings} />

      <div
        data-sidebar-chip
        style={{
          marginTop: 8,
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          background: "var(--color-card)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: user.connected ? "var(--color-success)" : "var(--color-text-muted)",
            flexShrink: 0,
          }}
        />
        <div data-sidebar-chip-body style={{ flex: 1, minWidth: 0 }}>
          <div
            className="text-title-sm"
            style={{
              color: "var(--color-text-primary)",
              fontWeight: 500,
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.connected ? user.name ?? "Hevy connected" : "Not connected"}
          </div>
          <div
            className="text-body-sm"
            style={{
              fontSize: 10,
              color: "var(--color-text-tertiary)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.connected ? handle ?? "Hevy" : "Add HEVY_API_KEY"}
          </div>
        </div>
      </div>
    </aside>
  );
}
