"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMeasurements } from "@/app/_providers/measurements-provider";
import {
  SAMPLE_BASELINE_INPUT,
  type BodyMeasurementsInput,
} from "@/lib/body/measurements";
import { Minus, Plus, Save } from "lucide-react";

export function BodyCard() {
  const { inputs, setInputs, hydrated } = useMeasurements();

  // Draft state — UI edits go here, only committed on Save (or Clear).
  const [draft, setDraft] = useState<BodyMeasurementsInput | null>(inputs);

  // Re-sync draft whenever the upstream snapshot changes (sample seed,
  // localStorage hydration, external commit).
  useEffect(() => {
    setDraft(inputs);
  }, [inputs]);

  const dirty = useMemo(() => !isEqual(draft, inputs), [draft, inputs]);

  const measuredLabel = useMemo(() => {
    if (!inputs?.measuredAt) return "no measurements yet";
    try {
      const d = new Date(inputs.measuredAt);
      return `measured ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    } catch {
      return inputs.measuredAt;
    }
  }, [inputs?.measuredAt]);

  const save = () => {
    if (!draft) return;
    setInputs({
      ...draft,
      measuredAt: new Date().toISOString().slice(0, 10),
    });
  };

  const reset = () => setDraft(inputs);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.titleStack}>
          <div style={styles.overline}>
            Body <span style={styles.dot} /> {measuredLabel}
          </div>
          <h2 style={styles.headline}>Front · Side.</h2>
        </div>
      </div>

      <ImagePair />

      {draft && (
        <MeasurementList
          draft={draft}
          baseline={inputs}
          onChange={(patch) => setDraft({ ...draft, ...patch })}
        />
      )}

      <div style={styles.footRow}>
        {hydrated && inputs && (
          <button
            type="button"
            style={styles.clearBtn}
            onClick={() => setInputs(null)}
          >
            Clear measurements
          </button>
        )}

        {hydrated && !inputs && (
          <button
            type="button"
            style={styles.seedBtn}
            onClick={() => setInputs(SAMPLE_BASELINE_INPUT)}
          >
            + Add Measurements
          </button>
        )}

        <div style={{ flex: 1 }} />

        {dirty && (
          <button type="button" style={styles.resetBtn} onClick={reset}>
            Reset
          </button>
        )}

        {draft && (
          <button
            type="button"
            style={{
              ...styles.saveBtn,
              ...(dirty ? styles.saveBtnDirty : styles.saveBtnQuiet),
            }}
            onClick={save}
            disabled={!dirty}
          >
            <Save size={14} />
            {dirty ? "Save" : "Saved"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Image pair (front · side) ──────────────────────────────────── */

function ImagePair() {
  return (
    <div style={styles.imagePair}>
      <ImageSlot label="Front" aspect="3 / 4" />
      <ImageSlot label="Side" aspect="3 / 4" />
    </div>
  );
}

function ImageSlot({ label, aspect }: { label: string; aspect: string }) {
  return (
    <div
      style={{
        ...styles.imageSlot,
        aspectRatio: aspect,
      }}
    >
      <span style={styles.imageSlotLabel}>{label}</span>
      <span style={styles.imageSlotHint}>No photo yet</span>
    </div>
  );
}

/* ── Measurement list ───────────────────────────────────────────── */

type FieldKey = Exclude<keyof BodyMeasurementsInput, "measuredAt" | "sex" | "ageYears">;

type FieldDef = {
  label: string;
  field: FieldKey;
  unit: string;
  step?: number;
  color?: string;
  min: number;
  max: number;
};

const FIELDS: FieldDef[] = [
  // Body composition
  { label: "Weight",      field: "weightKg",       unit: "kg", step: 0.1, min: 35, max: 200 },
  { label: "Lean mass",   field: "leanMassKg",     unit: "kg", step: 0.1, min: 25, max: 150 },
  { label: "Body fat",    field: "fatPercent",     unit: "%",  step: 0.1, min: 4,  max: 60 },

  // Core
  { label: "Neck",        field: "neckCm",         unit: "cm", color: "#008080", min: 25, max: 50 },
  { label: "Shoulder",    field: "shoulderCm",     unit: "cm", min: 80, max: 160 },
  { label: "Chest",       field: "chestCm",        unit: "cm", color: "#008000", min: 60, max: 150 },

  // Arms (L/R)
  { label: "L Bicep",     field: "leftBicepCm",    unit: "cm", color: "#ffa500", min: 18, max: 55 },
  { label: "R Bicep",     field: "rightBicepCm",   unit: "cm", color: "#ffa500", min: 18, max: 55 },
  { label: "L Forearm",   field: "leftForearmCm",  unit: "cm", color: "#ffd700", min: 18, max: 45 },
  { label: "R Forearm",   field: "rightForearmCm", unit: "cm", color: "#ffd700", min: 18, max: 45 },

  // Trunk
  { label: "Abdomen",     field: "abdomenCm",      unit: "cm", color: "#ff8c00", min: 50, max: 150 },
  { label: "Waist",       field: "waistCm",        unit: "cm", color: "#0000ff", min: 50, max: 150 },
  { label: "Hips",        field: "hipsCm",         unit: "cm", color: "#ff0000", min: 60, max: 160 },

  // Legs (L/R)
  { label: "L Thigh",     field: "leftThighCm",    unit: "cm", color: "#800080", min: 30, max: 90 },
  { label: "R Thigh",     field: "rightThighCm",   unit: "cm", color: "#800080", min: 30, max: 90 },
  { label: "L Calf",      field: "leftCalfCm",     unit: "cm", color: "#ff69b4", min: 25, max: 55 },
  { label: "R Calf",      field: "rightCalfCm",    unit: "cm", color: "#ff69b4", min: 25, max: 55 },
];

function MeasurementList({
  draft,
  baseline,
  onChange,
}: {
  draft: BodyMeasurementsInput;
  baseline: BodyMeasurementsInput | null;
  onChange: (patch: Partial<BodyMeasurementsInput>) => void;
}) {
  return (
    <div>
      <div style={styles.sectionLabel}>Measurements</div>
      <div style={styles.measList}>
        {FIELDS.map((f) => {
          const draftValue = draft[f.field] as number | null;
          const baselineValue = (baseline?.[f.field] as number | null) ?? null;
          return (
            <MeasurementRow
              key={f.field}
              def={f}
              value={draftValue}
              baseline={baselineValue}
              onChange={(v) => onChange({ [f.field]: v } as Partial<BodyMeasurementsInput>)}
            />
          );
        })}
      </div>
    </div>
  );
}

function MeasurementRow({
  def,
  value,
  baseline,
  onChange,
}: {
  def: FieldDef;
  value: number | null;
  baseline: number | null;
  onChange: (v: number) => void;
}) {
  const step = def.step ?? 0.5;
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : (def.min + def.max) / 2;

  const delta =
    typeof value === "number" && typeof baseline === "number"
      ? +(value - baseline).toFixed(2)
      : null;

  const decimals = step < 1 ? 1 : 0;
  const fmt = (n: number) => n.toFixed(decimals);

  const bump = (dir: 1 | -1) => {
    const next = clamp(numeric + dir * step, def.min, def.max);
    onChange(+next.toFixed(2));
  };

  return (
    <div style={styles.measRow}>
      <div style={styles.measRowHeader}>
        <span style={styles.measLabelWrap}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: def.color ?? "transparent",
              border: def.color ? "none" : "1px dashed rgba(255,255,255,0.15)",
              flexShrink: 0,
            }}
          />
          <span style={styles.measLabel}>{def.label}</span>
        </span>
        <span style={styles.measRowRight}>
          {delta !== null && delta !== 0 && (
            <span
              style={{
                ...styles.deltaPill,
                color:
                  delta > 0
                    ? "var(--color-semantic-warning)"
                    : "var(--color-semantic-success)",
              }}
            >
              {delta > 0 ? "↑" : "↓"}
              {fmt(Math.abs(delta))}
            </span>
          )}
          <button
            type="button"
            aria-label={`Decrease ${def.label}`}
            style={styles.stepBtn}
            onClick={() => bump(-1)}
          >
            <Minus size={12} />
          </button>
          <span style={styles.valueText}>{fmt(numeric)}</span>
          <button
            type="button"
            aria-label={`Increase ${def.label}`}
            style={styles.stepBtn}
            onClick={() => bump(1)}
          >
            <Plus size={12} />
          </button>
          <small style={styles.measUnit}>{def.unit}</small>
        </span>
      </div>
      <input
        type="range"
        className="thin-slider"
        min={def.min}
        max={def.max}
        step={step}
        value={numeric}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        style={{
          color: def.color ?? "var(--color-brand-accent)",
        }}
      />
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function isEqual(
  a: BodyMeasurementsInput | null,
  b: BodyMeasurementsInput | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof BodyMeasurementsInput>;
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/* ── Styles ─────────────────────────────────────────────────────── */

const styles: Record<string, CSSProperties> = {
  card: {
    background: "var(--color-surface-card)",
    borderRadius: 18,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
    color: "var(--color-text-primary)",
    fontFamily: "var(--font-inter, ui-sans-serif), system-ui, sans-serif",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: 16,
  },
  titleStack: { display: "flex", flexDirection: "column", gap: 6 },
  overline: {
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--color-text-tertiary)",
  },
  dot: {
    display: "inline-block",
    width: 4,
    height: 4,
    borderRadius: "50%",
    background: "var(--color-text-muted)",
    margin: "0 8px",
    verticalAlign: "middle",
  },
  headline: {
    margin: 0,
    fontFamily: "var(--font-space-grotesk, ui-sans-serif), system-ui, sans-serif",
    fontWeight: 500,
    fontSize: "1.25rem",
    letterSpacing: "-0.01em",
  },

  /* ── Image pair ── */
  imagePair: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  imageSlot: {
    position: "relative",
    background: "var(--color-surface-low)",
    borderRadius: 14,
    border: "1px dashed var(--color-outline)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  imageSlotLabel: {
    position: "absolute",
    top: 10,
    left: 12,
    fontFamily: "var(--font-space-grotesk, ui-sans-serif), system-ui, sans-serif",
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--color-text-tertiary)",
  },
  imageSlotHint: {
    fontSize: 12,
    color: "var(--color-text-muted)",
    fontStyle: "italic",
  },

  /* ── Section label ── */
  sectionLabel: {
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--color-text-tertiary)",
    marginBottom: 8,
  },

  /* ── Profile bar ── */
  profileBar: { display: "flex", flexDirection: "column", gap: 6 },
  profileRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px 12px",
  },
  profileField: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    background: "var(--color-surface-low)",
    borderRadius: 10,
    cursor: "default",
  },
  profileSeg: {
    display: "inline-flex",
    padding: 3,
    background: "var(--color-surface-chip)",
    borderRadius: 999,
  },
  profileSegBtn: {
    height: 22,
    padding: "0 10px",
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    border: 0,
    background: "transparent",
    color: "var(--color-text-secondary)",
    borderRadius: 999,
    cursor: "pointer",
  },
  profileSegBtnActive: {
    background: "var(--color-surface-base)",
    color: "var(--color-text-primary)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
  },

  /* ── Measurement list ── */
  measList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  measRow: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "10px 12px",
    background: "var(--color-surface-low)",
    borderRadius: 10,
  },
  measRowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  measLabelWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  measRowRight: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  deltaPill: {
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 4,
    background: "rgba(255,255,255,0.06)",
    marginRight: 4,
  },
  stepBtn: {
    width: 22,
    height: 22,
    display: "grid",
    placeItems: "center",
    border: 0,
    borderRadius: 5,
    background: "var(--color-surface-chip)",
    color: "var(--color-text-secondary)",
    cursor: "pointer",
  },
  valueText: {
    minWidth: 40,
    textAlign: "right",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: 14,
    color: "var(--color-text-primary)",
  },
  measLabel: { color: "var(--color-text-secondary)", fontSize: 13 },
  measUnit: { fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: 2 },
  measInputWrap: { display: "inline-flex", alignItems: "baseline", gap: 0 },
  measInput: {
    width: 64,
    height: 26,
    padding: "0 8px",
    textAlign: "right",
    background: "var(--color-surface-base)",
    border: 0,
    borderRadius: 6,
    color: "var(--color-text-primary)",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: 14,
    outline: 0,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
  },
  measSlider: {
    width: "100%",
    cursor: "pointer",
  },

  /* ── Footer row ── */
  footRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  seedBtn: {
    border: "1px solid #9100D0",
    background: "rgba(145,0,208,0.15)",
    color: "var(--color-brand-mark)",
    height: 30,
    padding: "0 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  saveBtn: {
    height: 30,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: 0,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  saveBtnDirty: {
    background: "var(--gradient-primary, #9100D0)",
    color: "#fff",
  },
  saveBtnQuiet: {
    background: "var(--color-surface-chip)",
    color: "var(--color-text-muted)",
    cursor: "default",
  },
  resetBtn: {
    height: 30,
    padding: "0 10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "var(--color-text-tertiary)",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
  },
  clearBtn: {
    border: "1px solid var(--color-outline)",
    background: "transparent",
    color: "var(--color-text-tertiary)",
    height: 30,
    padding: "0 12px",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
  },
};
