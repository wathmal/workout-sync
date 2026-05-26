import type { MuscleBucket, MuscleCoverageEntry } from "@/lib/dashboard/mock-data";
import { loadMuscleSvgs } from "@/lib/dashboard/muscle-svg-loader";
import { SectionHead } from "./SectionHead";

const BUCKET_COLOR: Record<MuscleBucket, string> = {
  1: "var(--color-semantic-success)",
  2: "color-mix(in srgb, var(--color-data-1) 70%, transparent)",
  3: "color-mix(in srgb, var(--color-data-1) 35%, transparent)",
  4: "var(--color-semantic-warning)",
  5: "var(--color-surface-disabled)",
};

const BUCKET_LABEL: Record<MuscleBucket, string> = {
  1: "Above",
  2: "Average",
  3: "Below",
  4: "Stale 7d+",
  5: "Untouched",
};

const SELECTOR: Record<string, string> = {
  chest: ".muscle.chest",
  "front-delts": ".muscle.arms.shoulders",
  biceps: ".muscle.arms.biceps",
  abs: ".muscle.abdominals",
  obliques: ".muscle.abductors",
  quads: ".muscle.quadriceps",
  forearms: ".muscle.arms.forearms",
  adductors: ".muscle.abductors",
  "rear-delts": ".muscle.delts.shoulders",
  traps: ".muscle.traps",
  lats: ".muscle.lats",
  "lower-back": ".muscle.back.lower",
  triceps: ".muscle.triceps",
  glutes: ".muscle.glutes",
  hamstrings: ".muscle.hamstrings",
  calves: ".muscle.calves",
};

function buildColorStyle(entries: MuscleCoverageEntry[], scope: string): string {
  const lines = entries.map((e) => {
    const sel = SELECTOR[e.group];
    if (!sel) return "";
    return `${scope} ${sel} { fill: ${BUCKET_COLOR[e.bucket]}; }`;
  });
  return [
    `${scope} svg { width: 100%; height: auto; max-height: 240px; }`,
    `${scope} .body-part { fill: color-mix(in srgb, var(--color-text-primary) 10%, transparent); transition: fill 200ms ease; }`,
    `${scope} .muscle { fill: var(--color-surface-disabled); transition: fill 200ms ease; }`,
    ...lines,
  ].join("\n");
}

interface Props {
  front: MuscleCoverageEntry[];
  back: MuscleCoverageEntry[];
  attention: { label: string; meta: string; bucket: MuscleBucket }[];
}

export function MuscleCoverage({ front, back, attention }: Props) {
  const svgs = loadMuscleSvgs();
  const frontStyle = buildColorStyle(front, ".mc-front");
  const backStyle = buildColorStyle(back, ".mc-back");
  const css = `${frontStyle}\n${backStyle}`;

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
        overline="Trailing 7 days"
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

      {/* 5-bucket scale */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          fontSize: 10,
          color: "var(--color-text-tertiary)",
        }}
      >
        {([1, 2, 3, 4, 5] as MuscleBucket[]).map((b) => (
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
        {attention.map((a, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: "var(--space-sm)",
              padding: "8px var(--space-sm)",
              background: "var(--color-surface-low)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: BUCKET_COLOR[a.bucket],
                flexShrink: 0,
              }}
            />
            <span
              style={{ color: "var(--color-text-primary)", fontSize: 13 }}
            >
              {a.label}
            </span>
            <span
              className="font-mono-sm"
              style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
            >
              {a.meta}
            </span>
          </div>
        ))}
      </div>
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
