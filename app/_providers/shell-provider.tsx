"use client";

import { createContext, useContext } from "react";

// Seeded from the server-decided `x-shell` header (see middleware.ts). Lets any
// client component branch on viewport class without re-measuring window width.
const ShellContext = createContext<{ isMobile: boolean }>({ isMobile: false });

export function ShellProvider({
  isMobile,
  children,
}: {
  isMobile: boolean;
  children: React.ReactNode;
}) {
  return (
    <ShellContext.Provider value={{ isMobile }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  return useContext(ShellContext);
}
