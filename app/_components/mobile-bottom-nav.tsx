"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dumbbell, Utensils, Flag } from "lucide-react";

// 4-tab nav. Body composition lives inside the Overview scroll (no separate
// tab — see plan). /review is a forward step of the workout flow, so it keeps
// the Workout tab lit.
const ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard, match: (p: string) => p === "/" },
  {
    href: "/upload",
    label: "Workout",
    icon: Dumbbell,
    match: (p: string) => p.startsWith("/upload") || p.startsWith("/review"),
  },
  { href: "/food", label: "Food", icon: Utensils, match: (p: string) => p.startsWith("/food") },
  { href: "/races", label: "Races", icon: Flag, match: (p: string) => p.startsWith("/races") },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        zIndex: 100,
        background: "var(--color-glass)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid var(--color-outline)",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {ITEMS.map((item) => {
        const on = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "10px 4px 8px",
              minHeight: 56,
              textDecoration: "none",
              color: on ? "var(--color-brand-accent)" : "var(--color-text-muted)",
              transition: "color 120ms var(--ease)",
            }}
          >
            <Icon size={20} strokeWidth={on ? 2.2 : 1.8} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: on ? 600 : 400,
                fontSize: 10,
                letterSpacing: "0.04em",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
