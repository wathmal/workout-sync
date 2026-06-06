"use client";

import { usePathname } from "next/navigation";

// Overview (/) renders its own MobileTopBar which carries the status-bar
// safe-area padding. Every other route has no top chrome, so the scroll
// container itself must clear the notch/status bar (viewport-fit=cover +
// black-translucent status bar would otherwise tuck content under the clock).
export function MobileMain({ children }: { children: React.ReactNode }) {
  const isOverview = usePathname() === "/";
  return (
    <main
      style={{
        minWidth: 0,
        paddingTop: isOverview ? 0 : "env(safe-area-inset-top, 0px)",
        paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {children}
    </main>
  );
}
