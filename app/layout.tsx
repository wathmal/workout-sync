import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WorkoutProvider } from "@/app/_providers/workout-provider";
import { MeasurementsProvider } from "@/app/_providers/measurements-provider";
import { FoodLogProvider } from "@/app/_providers/food-log-provider";
import { RaceProvider } from "@/app/_providers/race-provider";
import { HevyProvider } from "@/app/_providers/hevy-provider";
import { AgendaProvider } from "@/app/_providers/agenda-provider";
import { DashboardWeekProvider } from "@/app/_providers/dashboard-week-provider";
import { ShellProvider } from "@/app/_providers/shell-provider";
import { TopNav } from "@/app/_components/top-nav";
import { Footer } from "@/app/_components/footer";
import { MobileBottomNav } from "@/app/_components/mobile-bottom-nav";
import { MobileMain } from "@/app/_components/mobile-main";
import { SwRegister } from "@/app/_components/sw-register";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fit Sync",
  description:
    "All in one personal training dashboard. Log workouts, track macros, body composition and races.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fit Sync",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D0D0D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before React hydrates → no flash of wrong theme.
const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem('workout-sync:theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Shell decided server-side in middleware.ts — one tree, no client flash.
  const isMobile = (await headers()).get("x-shell") === "m";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <WorkoutProvider>
          <MeasurementsProvider>
            <HevyProvider>
              <FoodLogProvider>
                <RaceProvider>
                  <AgendaProvider>
                    <DashboardWeekProvider>
                      <ShellProvider isMobile={isMobile}>
                        {isMobile ? (
                          <div
                            className="app-shell app-shell--mobile"
                            style={{
                              position: "relative",
                              maxWidth: 480,
                              margin: "0 auto",
                              minHeight: "100dvh",
                              background: "var(--color-surface-base)",
                              boxShadow: "0 0 0 1px var(--color-outline)",
                            }}
                          >
                            <MobileMain>{children}</MobileMain>
                            <MobileBottomNav />
                          </div>
                        ) : (
                          <div
                            className="app-shell"
                            style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
                          >
                            <TopNav />
                            <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
                            <Footer />
                          </div>
                        )}
                        <SwRegister />
                      </ShellProvider>
                    </DashboardWeekProvider>
                  </AgendaProvider>
                </RaceProvider>
              </FoodLogProvider>
            </HevyProvider>
          </MeasurementsProvider>
        </WorkoutProvider>
      </body>
    </html>
  );
}
