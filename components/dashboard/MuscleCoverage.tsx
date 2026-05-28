"use client";

import type {
  AttentionRow,
  MuscleBucket,
  MuscleCoverageEntry,
  TrackedMuscle,
} from "@/lib/dashboard/muscle-coverage";
import { SectionHead } from "./SectionHead";
import { useHevy } from "@/app/_providers/hevy-provider";

const BUCKET_COLOR: Record<MuscleBucket, string> = {
  met: "var(--color-semantic-success)",
  below: "var(--color-semantic-warning)",
  untouched: "var(--color-surface-disabled)",
};

const BUCKET_LABEL: Record<MuscleBucket, string> = {
  met: "Met",
  below: "Below",
  untouched: "Untouched",
};

interface SideSelectors {
  front?: string;
  back?: string;
}

// Hevy muscle key → CSS selectors per side. Multiple selectors comma-joined.
// Hevy keys without an SVG region (adductors, lower_back) still appear in the
// attention list; they're absent here on purpose.
const SELECTOR: Partial<Record<TrackedMuscle, SideSelectors>> = {
  chest: { front: ".muscle.chest" },
  abdominals: { front: ".muscle.abdominals" },
  abductors: { front: ".muscle.abductors" },
  biceps: { front: ".muscle.arms.biceps" },
  forearms: { front: ".muscle.arms.forearms" },
  shoulders: {
    front: ".muscle.arms.shoulders",
    back: ".muscle.delts.shoulders",
  },
  calves: {
    front: ".muscle.calves.gastro, .muscle.calves.soleus",
    back: ".muscle.calves",
  },
  quadriceps: { front: ".muscle.quadriceps" },
  traps: { front: ".muscle.traps", back: ".muscle.traps" },
  glutes: { back: ".muscle.glutes" },
  hamstrings: { back: ".muscle.hamstrings" },
  lats: { back: ".muscle.lats" },
  triceps: { back: ".muscle.triceps" },
  upper_back: { back: ".muscle.traps" },
};

function buildColorStyle(entries: MuscleCoverageEntry[]): string {
  const baseRules = [
    `.mc-front svg, .mc-back svg { width: 100%; height: auto; max-height: 240px; }`,
    `.mc-front .body-part, .mc-back .body-part { fill: color-mix(in srgb, var(--color-text-primary) 10%, transparent); transition: fill 200ms ease; }`,
    `.mc-front .muscle, .mc-back .muscle { fill: var(--color-surface-disabled); transition: fill 200ms ease; }`,
  ];
  const coloured: string[] = [];
  for (const entry of entries) {
    const sides = SELECTOR[entry.group];
    if (!sides) continue;
    const color = BUCKET_COLOR[entry.bucket];
    if (sides.front) coloured.push(`.mc-front ${sides.front} { fill: ${color}; }`);
    if (sides.back) coloured.push(`.mc-back ${sides.back} { fill: ${color}; }`);
  }
  return [...baseRules, ...coloured].join("\n");
}

export function MuscleCoverage({ svgs }: { svgs: { front: string; back: string } }) {
  const { coverage, error, errorCode, loading, lastFetched } = useHevy();
  const entries = coverage.entries;
  const attention = coverage.attention;
  const css = buildColorStyle(entries);
  // Initial load (never fetched yet): suppress the "All tracked muscles met"
  // empty state so it doesn't flash before the first response.
  const pendingFirstLoad = loading && lastFetched === null && !error;

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
        width: "100%",
      }}
    >
      <SectionHead
        size="md"
        overline="This week"
        title="Muscle coverage."
      />

      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-md)",
        }}
      >
        <Figure label="Front" html={svgs.front} className="mc-front" />
        <Figure label="Back" html={svgs.back} className="mc-back" />
      </div>

      {/* 3-bucket legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          fontSize: 10,
          color: "var(--color-text-tertiary)",
        }}
      >
        {(["met", "below", "untouched"] as MuscleBucket[]).map((b) => (
          <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: BUCKET_COLOR[b],
                display: "inline-block",
              }}
            />
            {BUCKET_LABEL[b]}
          </span>
        ))}
      </div>

      {/* Needs attention list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: "var(--space-xs)",
        }}
      >
        <div
          className="text-label-md"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Needs attention
        </div>

        {error ? (
          <EmptyMessage error={errorCode ?? "fetch-fail"} />
        ) : pendingFirstLoad ? (
          <div
            style={{
              padding: "10px var(--space-sm)",
              background: "var(--color-surface-low)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-tertiary)",
              fontSize: 13,
            }}
          >
            Loading coverage…
          </div>
        ) : attention.length === 0 ? (
          <div
            style={{
              padding: "10px var(--space-sm)",
              background: "var(--color-surface-low)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-tertiary)",
              fontSize: 13,
            }}
          >
            All tracked muscles met this week.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            <RegionGroup label="Upper" rows={attention.filter((a) => a.region === "upper")} />
            <RegionGroup label="Lower" rows={attention.filter((a) => a.region === "lower")} />
          </div>
        )}
      </div>
    </div>
  );
}

function RegionGroup({ label, rows }: { label: string; rows: AttentionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}
      >
        {rows.map((a) => {
          const accent =
            a.sets === 0
              ? "var(--color-semantic-error)"
              : "var(--color-semantic-warning)";
          return (
            <div
              key={a.group}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: "var(--space-sm)",
                padding: "8px var(--space-sm)",
                background: "var(--color-surface-low)",
                borderRadius: "var(--radius-md)",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: 13,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.label}
              </span>
              <span
                className="font-mono-sm"
                style={{
                  color: accent,
                  fontSize: 12,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                {a.meta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyMessage({ error }: { error: "no-key" | "fetch-fail" }) {
  const text =
    error === "no-key"
      ? "Connect Hevy to track muscle coverage."
      : "Can't reach Hevy right now.";
  return (
    <div
      style={{
        padding: "10px var(--space-sm)",
        background: "var(--color-surface-low)",
        borderRadius: "var(--radius-md)",
        color: "var(--color-text-tertiary)",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function Figure({
  label,
  html,
  className,
}: {
  label: string;
  html: string;
  className: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div
        className={className}
        style={{ width: "100%", display: "grid", placeItems: "center" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <span
        className="text-label-md"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </span>
    </div>
  );
}
