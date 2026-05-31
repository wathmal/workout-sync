import { overviewMock } from "@/lib/dashboard/mock-data";
import { ViewportGuard } from "@/app/_components/viewport-guard";
import { OverviewHeading } from "@/components/dashboard/OverviewHeading";
import { WeeklyAgenda } from "@/components/dashboard/WeeklyAgenda";
import { CalorieSummary } from "@/components/dashboard/CalorieSummary";
import { MuscleCoverageCard } from "@/components/dashboard/MuscleCoverageCard";
import { ManualLog } from "@/components/dashboard/ManualLog";
import { RaceTimeline } from "@/components/dashboard/RaceTimeline";
import { BodyTrendChart } from "@/components/dashboard/BodyTrendChart";
import { BodyCard } from "@/components/body-card/BodyCard";

export default function OverviewPage() {
  return (
    <ViewportGuard>
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
        <OverviewHeading data={overviewMock.heading} />

        <WeeklyAgenda days={overviewMock.agenda} rangeLabel="May 18 – 24" />

        <section
          aria-label="Calorie tracking, muscle coverage, manual logging"
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
          <div style={{ minWidth: 0, display: "flex" }}>
            <ManualLog data={overviewMock.actions} />
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
    </ViewportGuard>
  );
}
