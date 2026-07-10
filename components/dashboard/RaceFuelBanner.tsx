"use client";

import { useDashboardWeek } from "@/app/_providers/dashboard-week-provider";
import { useMeasurements } from "@/app/_providers/measurements-provider";
import { useRaces } from "@/app/_providers/race-provider";
import {
  fuelPlan,
  FIRST_GEL_MIN,
  GEL_CARB_G,
  GEL_INTERVAL_MIN,
  type FuelPlan,
} from "@/lib/race/fueling";
import { lastResultDurationMin, parseDurationMin } from "@/lib/race/types";
import type { DayAgenda } from "@/lib/dashboard/mock-data";

// Fallback bodyweight when no measurement is stored yet (matches the sample baseline).
const DEFAULT_WEIGHT_KG = 68;

interface Fact {
  k: string; // label, left
  v: string; // mono value, right
  meta: string; // quiet mono context, right of label
}

/**
 * Race-fueling ledger on the Calorie card (claude.ai/design "hairline" variant):
 * no tinted box, values in tabular mono on hairline rows, amber reserved for the
 * flag + state pill. Shows the agenda's selected day — or today — and renders
 * nothing when that day has no fueling phase. Numbers from the pure fuelPlan()
 * engine (bodyweight × g/kg × phase).
 */
export function RaceFuelBanner({
  baseCarbG,
  baseProteinG,
}: {
  baseCarbG: number;
  baseProteinG?: number;
}) {
  const { agendaDays, selectedDayIdx } = useDashboardWeek();
  const { inputs } = useMeasurements();
  const { views } = useRaces();

  const day: DayAgenda | undefined =
    selectedDayIdx != null ? agendaDays[selectedDayIdx] : agendaDays.find((d) => d.isToday);
  if (!day) return null;

  const weightKg = inputs?.weightKg ?? DEFAULT_WEIGHT_KG;

  // Race day beats load day if both ever land on one date.
  const race = day.races?.[0];
  const ctx = race
    ? { daysUntil: 0, category: race.category, raceName: race.name }
    : day.fuel
    ? { daysUntil: day.fuel.daysToRace, category: day.fuel.category, raceName: day.fuel.raceName }
    : null;
  if (!ctx) return null;

  // Gel schedule sized to the athlete's own clock: the race's target time when
  // parseable, else the most recent completed result in the same category.
  const targetView = views.find((v) => v.name === ctx.raceName);
  const expectedDurationMin =
    parseDurationMin(targetView?.eventTarget) ??
    lastResultDurationMin(views, ctx.category) ??
    undefined;

  const plan = fuelPlan({
    daysUntil: ctx.daysUntil,
    category: ctx.category,
    weightKg,
    baseCarbG,
    expectedDurationMin,
  });
  if (!plan) return null;

  const facts = factsFor(plan, ctx.category, baseCarbG, baseProteinG);

  return (
    <div style={{ marginBottom: "var(--space-md)", display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="text-label-sm" style={{ color: "var(--color-text-tertiary)", whiteSpace: "nowrap", minWidth: 0 }}>
        RACE FUELING · {ctx.raceName.toUpperCase()}
      </span>

      {/* ledger: hairline rows, label left / value right */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {facts.map((f, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "baseline",
              gap: 12,
              padding: "8px 2px",
              borderTop: i ? "1px solid var(--color-outline)" : "none",
            }}
          >
            <span className="text-body-sm" style={{ color: "var(--color-text-secondary)" }}>{f.k}</span>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10, whiteSpace: "nowrap" }}>
              <span className="font-mono-sm" style={{ color: "var(--color-text-muted)" }}>
                {f.meta}
              </span>
              <span className="font-mono-sm" style={{ color: "var(--color-text-primary)" }}>
                {f.v}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function factsFor(
  plan: FuelPlan,
  category: string,
  baseCarbG: number,
  baseProteinG?: number,
): Fact[] {
  if (plan.phase === "load") {
    return [
      { k: "Carb target", v: `${plan.carbTargetG}g`, meta: `${plan.carbPerKg} g/kg` },
      ...(plan.carbDeltaG > 0
        ? [{ k: "vs base", v: `+${plan.carbDeltaG}g`, meta: `over ${Math.round(baseCarbG)}g` }]
        : []),
      ...(plan.sodiumMg > 0
        ? [{ k: "Sodium", v: `~${plan.sodiumMg}mg`, meta: "with dinner" }]
        : []),
      { k: "Fibre + fat", v: "low", meta: "easy gut" },
      { k: "Protein", v: "keep", meta: baseProteinG ? `${Math.round(baseProteinG)}g` : "" },
    ];
  }
  return [
    { k: "Pre-race meal", v: `~${plan.morningCarbG}g carbs`, meta: "3h out" },
    { k: "Caffeine", v: `${plan.caffeineMg}mg`, meta: "45min out" },
    { k: "Hydration", v: `${plan.fluidMl}ml + ${plan.sodiumMg}mg Na`, meta: "90min out" },
    category === "hyrox"
      ? {
          k: "In-race fuel",
          v: `${plan.inRaceGelCount} gels ~${GEL_CARB_G}g`,
          meta: `${FIRST_GEL_MIN}min in, every ${GEL_INTERVAL_MIN}min`,
        }
      : { k: "In-race fuel", v: `${plan.inRaceCarbPerH}g/h`, meta: "throughout" },
    {
      k: "In-race sodium",
      v: `${plan.inRaceSodiumMgPerH}mg/h`,
      meta: category === "hyrox" ? "sip at roxzones" : "throughout",
    },
    { k: "Refill", v: `${plan.recoveryCarbPerH}g/h × 4h`, meta: "after finish" },
  ];
}
