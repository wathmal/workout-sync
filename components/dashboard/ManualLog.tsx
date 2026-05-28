"use client";

import Link from "next/link";
import {
  RefreshCw,
  Upload,
  ArrowRight,
  Camera,
  AlignLeft,
  Sparkles,
} from "lucide-react";
import { useFoodLog } from "@/app/_providers/food-log-provider";
import type { QuickAddSuggestion } from "@/lib/food/types";

interface ActionsData {
  lastSync: string;
  /** Static fallback chips shown when no recent logs exist. */
  quickAdd: { name: string; kcal: number }[];
}

/**
 * Two-card quick-action stack that mirrors the rightmost column of the
 * middle row in tmp/dashboard.html: "Log a workout" + "Log a meal".
 */
export function ManualLog({ data }: { data: ActionsData }) {
  const { quickAdd: live, addMeal } = useFoodLog();
  const chips: QuickAddSuggestion[] = live.length
    ? live
    : data.quickAdd.map((q) => ({
        name: q.name,
        kcal: q.kcal,
        grams: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      }));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl)",
        flex: 1,
        width: "100%",
      }}
    >
      <WorkoutCard />
      <MealCard
        quickAdd={chips}
        onQuickAdd={async (q) => {
          if (!Number.isFinite(q.grams) || q.grams <= 0) return; // static fallback w/o macros — skip
          await addMeal({
            loggedAt: new Date().toISOString(),
            source: "manual",
            items: [
              {
                name: q.name,
                grams: q.grams,
                kcal: q.kcal,
                proteinG: q.proteinG,
                carbsG: q.carbsG,
                fatG: q.fatG,
                confidence: null,
                warnings: null,
              },
            ],
          }).catch((err) => console.error(err));
        }}
      />
    </div>
  );
}

function WorkoutCard() {
  return (
    <Card>
      <CardHeader
        overline="Strength · Hevy"
        title="Log a workout."
        pill={null}
      />
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: "0.875rem",
        }}
      >
        Snap your set sheet or open the live logger. Pushes to Hevy.
      </p>
      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
        }}
      >
        <SecondaryButton href="/upload" icon={<Upload size={14} />}>
          Upload
        </SecondaryButton>
        <PrimaryButton href="/upload" icon={<ArrowRight size={14} strokeWidth={2.2} />}>
          Open log
        </PrimaryButton>
      </div>
    </Card>
  );
}

function MealCard({
  quickAdd,
  onQuickAdd,
}: {
  quickAdd: QuickAddSuggestion[];
  onQuickAdd: (q: QuickAddSuggestion) => Promise<void> | void;
}) {
  return (
    <Card>
      <CardHeader
        overline="Nutrition · Auto-detect"
        title="Log a meal."
        pill={
          <Pill tone="brand">
            <Sparkles size={11} strokeWidth={2.5} />
            AI
          </Pill>
        }
      />
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: "0.875rem",
        }}
      >
        Drop a photo or type what you ate. Macros auto-extract and stay editable.
      </p>
      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
        }}
      >
        <SecondaryButton href="/food?mode=snap" icon={<Camera size={14} />}>
          Snap
        </SecondaryButton>
        <PrimaryButton href="/food?mode=text" icon={<AlignLeft size={14} strokeWidth={2.2} />}>
          Type meal
        </PrimaryButton>
      </div>

      {quickAdd.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xs)",
          }}
        >
          <span
            className="text-label-md"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Quick add
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {quickAdd.map((q) => (
              <button
                key={q.name}
                type="button"
                onClick={() => void onQuickAdd(q)}
                style={{
                  background: "var(--color-surface-chip)",
                  color: "var(--color-text-primary)",
                  padding: "5px 10px",
                  borderRadius: "var(--radius-full)",
                  fontSize: 12,
                  fontWeight: 500,
                  border: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                + {q.name}
                <span
                  className="font-mono-sm"
                  style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
                >
                  {Math.round(q.kcal)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        flex: 1,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  overline,
  title,
  pill,
}: {
  overline: string;
  title: string;
  pill: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "var(--space-sm)",
      }}
    >
      <div>
        <div
          className="text-label-md"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {overline}
        </div>
        <h2
          className="text-headline-md"
          style={{
            color: "var(--color-text-primary)",
            margin: "var(--space-2xs) 0 0",
          }}
        >
          {title}
        </h2>
      </div>
      {pill}
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "info" | "brand";
}) {
  const palette =
    tone === "brand"
      ? { fg: "var(--color-brand-accent)", bg: "rgba(174,51,237,0.16)" }
      : { fg: "var(--color-semantic-info)", bg: "rgba(91,163,245,0.16)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        justifyContent: "center",
        height: 36,
        padding: "0 var(--space-md)",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-brand-primary)",
        color: "var(--color-text-on-brand)",
        fontWeight: 500,
        fontSize: "0.875rem",
        textDecoration: "none",
      }}
    >
      {icon}
      {children}
    </Link>
  );
}

function SecondaryButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        justifyContent: "center",
        height: 36,
        padding: "0 var(--space-md)",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-elevated)",
        color: "var(--color-text-primary)",
        boxShadow: "inset 0 0 0 1px var(--color-outline)",
        fontWeight: 500,
        fontSize: "0.875rem",
        textDecoration: "none",
      }}
    >
      {icon}
      {children}
    </Link>
  );
}
