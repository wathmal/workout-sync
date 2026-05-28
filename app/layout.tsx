import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WorkoutProvider } from "@/app/_providers/workout-provider";
import { MeasurementsProvider } from "@/app/_providers/measurements-provider";
import { FoodLogProvider } from "@/app/_providers/food-log-provider";
import { HevyProvider } from "@/app/_providers/hevy-provider";
import { TopNav } from "@/app/_components/top-nav";
import { Footer } from "@/app/_components/footer";

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
  description: "From the gym board to Hevy in one shot.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
                <div className="app-shell" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
                  <TopNav />
                  <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
                  <Footer />
                </div>
              </FoodLogProvider>
            </HevyProvider>
          </MeasurementsProvider>
        </WorkoutProvider>
      </body>
    </html>
  );
}
