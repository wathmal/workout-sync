import { headers } from "next/headers";
import { overviewMock } from "@/lib/dashboard/mock-data";
import { loadMuscleSvgs } from "@/lib/dashboard/muscle-svg-loader";
import { OverviewHeading } from "@/components/dashboard/OverviewHeading";
import { WeeklyAgendaLive } from "@/components/dashboard/WeeklyAgendaLive";
import { CalorieSummary } from "@/components/dashboard/CalorieSummary";
import { MuscleCoverageCard } from "@/components/dashboard/MuscleCoverageCard";
import { FitnessCard } from "@/components/dashboard/FitnessCard";
import { RaceTimeline } from "@/components/dashboard/RaceTimeline";
import { BodyTrendChart } from "@/components/dashboard/BodyTrendChart";
import { BodyCard } from "@/components/body-card/BodyCard";
import { MobileOverview } from "@/components/mobile/MobileOverview";
import { AutoRefresh } from "@/app/_components/auto-refresh";
import { readFitnessSeries } from "@/lib/fitness/queries";
import type { FitnessPoint } from "@/lib/fitness/types";

export default async function OverviewPage() {
  const isMobile = (await headers()).get("x-shell") === "m";

  // Fitness series (P1). Guarded — a missing DB/table must not blank the dashboard.
  let fitnessSeries: FitnessPoint[] = [];
  try {
    fitnessSeries = await readFitnessSeries(30);
  } catch (err) {
    console.warn("[overview] fitness series read failed:", (err as Error).message);
  }

  if (isMobile) {
    // Bespoke mobile dashboard — merged single scroll, live providers.
    return (
      <>
        <AutoRefresh />
        <MobileOverview
          svgs={loadMuscleSvgs()}
          trend={overviewMock.trend}
          fitness={fitnessSeries}
        />
      </>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "var(--space-xl) var(--space-2xl) var(--space-3xl)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2xl)",
      }}
    >
      <AutoRefresh />
      <OverviewHeading />

      <WeeklyAgendaLive />

      <section
        aria-label="Calorie tracking, muscle coverage, fitness trends"
        style={{
          display: "grid",
          gridTemplateColumns: "5fr 3fr 4fr",
          gap: "var(--space-xl)",
          alignItems: "stretch",
        }}
      >
        <div style={{ minWidth: 0, display: "flex" }}>
          <CalorieSummary />
        </div>
        <div style={{ minWidth: 0, display: "flex" }}>
          <MuscleCoverageCard />
        </div>
        {/* ManualLog hidden for now — Fitness Trends takes the slot. Restore = swap back. */}
        <div style={{ minWidth: 0, display: "flex" }}>
          <FitnessCard series={fitnessSeries} />
        </div>
      </section>

      <RaceTimeline />

      <section
        aria-label="Body shape and composition trend"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 3fr",
          gap: "var(--space-xl)",
          alignItems: "stretch",
        }}
      >
        <div style={{ minWidth: 0, minHeight: 0 }}>
          <BodyCard />
        </div>
        <div style={{ minWidth: 0 }}>
          <BodyTrendChart series={overviewMock.trend} />
        </div>
      </section>
    </div>
  );
}
