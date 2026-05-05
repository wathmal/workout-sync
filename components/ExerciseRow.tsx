"use client";

import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { WorkoutSet, Exercise } from "@/lib/types";
import { secondsToMMSS, mmssToSeconds } from "@/lib/utils";

interface ExerciseRowProps {
  set: WorkoutSet;
  exerciseType: Exercise["type"];
  setNumber: number;
  canDelete?: boolean;
  onWeightChange?: (value: number) => void;
  onRepsChange?: (value: number) => void;
  onDistanceChange?: (value: number) => void;
  onDurationChange?: (value: number) => void;
  onToggleComplete: () => void;
  onDelete?: () => void;
}

const cellShell: React.CSSProperties = {
  background: "var(--color-low)",
  borderRadius: "var(--radius-md)",
  position: "relative",
};

const inputBase: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 14,
  background: "transparent",
  border: "none",
  outline: "none",
  width: "100%",
  padding: "7px 10px",
  borderRadius: "var(--radius-sm)",
};

function SuffixLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-label-sm"
      style={{
        position: "absolute",
        right: 12,
        top: "50%",
        transform: "translateY(-50%)",
        color: "var(--color-text-muted)",
        pointerEvents: "none",
      }}
    >
      {children}
    </span>
  );
}

export function ExerciseRow({
  set,
  exerciseType,
  setNumber,
  canDelete = true,
  onWeightChange,
  onRepsChange,
  onDistanceChange,
  onDurationChange,
  onToggleComplete,
  onDelete,
}: ExerciseRowProps) {
  const done = set.completed;
  const ink = done ? "var(--color-secondary)" : "var(--color-text-primary)";
  const cellBg = done ? "rgba(0,108,76,0.07)" : "var(--color-low)";

  const durationDisplay = set.duration_seconds !== undefined ? secondsToMMSS(set.duration_seconds) : "0:00";
  const [durationInput, setDurationInput] = useState(durationDisplay);
  const [isFocused, setIsFocused] = useState(false);
  const displayDuration = isFocused ? durationInput : durationDisplay;

  const weight = set.weight_kg ?? set.kg ?? 0;
  const reps = set.reps ?? 0;

  const renderWeight = exerciseType === "weight_reps" && onWeightChange;
  const renderReps = (exerciseType === "weight_reps" || exerciseType === "reps_only") && onRepsChange;
  const renderDistance = exerciseType === "distance_duration" && onDistanceChange;
  const renderDuration = (exerciseType === "duration" || exerciseType === "distance_duration") && onDurationChange;

  const volume =
    exerciseType === "weight_reps" ? weight * reps : exerciseType === "reps_only" ? reps : 0;

  // Density grid: SET / WEIGHT / REPS / VOLUME / done / delete
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr 1fr 88px 28px 22px",
        gap: 8,
        alignItems: "center",
        padding: "3px 0",
      }}
    >
      <div
        className="font-mono-sm"
        style={{
          fontWeight: 600,
          color: done ? "var(--color-secondary)" : "var(--color-text-tertiary)",
          textAlign: "center",
        }}
      >
        {setNumber}
      </div>

      {/* First value cell */}
      <div style={{ ...cellShell, background: cellBg }}>
        {renderWeight ? (
          <>
            <input
              type="number"
              value={weight}
              onChange={(e) => onWeightChange!(Number(e.target.value))}
              style={{ ...inputBase, color: ink }}
            />
            <SuffixLabel>KG</SuffixLabel>
          </>
        ) : renderReps && exerciseType === "reps_only" ? (
          <>
            <input
              type="number"
              value={reps}
              onChange={(e) => onRepsChange!(Number(e.target.value))}
              style={{ ...inputBase, color: ink }}
            />
            <SuffixLabel>REPS</SuffixLabel>
          </>
        ) : renderDistance ? (
          <>
            <input
              type="number"
              step="0.1"
              value={set.distance_meters ?? 0}
              onChange={(e) => onDistanceChange!(Number(e.target.value))}
              style={{ ...inputBase, color: ink }}
            />
            <SuffixLabel>M</SuffixLabel>
          </>
        ) : renderDuration ? (
          <>
            <input
              type="text"
              value={displayDuration}
              onFocus={() => {
                setIsFocused(true);
                setDurationInput(durationDisplay);
              }}
              onBlur={() => {
                setIsFocused(false);
                onDurationChange!(mmssToSeconds(durationInput));
              }}
              onChange={(e) => setDurationInput(e.target.value)}
              style={{ ...inputBase, color: ink }}
              pattern="[0-9]+:[0-5][0-9]"
            />
            <SuffixLabel>TIME</SuffixLabel>
          </>
        ) : null}
      </div>

      {/* Second value cell */}
      <div style={{ ...cellShell, background: cellBg }}>
        {exerciseType === "weight_reps" && renderReps ? (
          <>
            <input
              type="number"
              value={reps}
              onChange={(e) => onRepsChange!(Number(e.target.value))}
              style={{ ...inputBase, color: ink }}
            />
            <SuffixLabel>REPS</SuffixLabel>
          </>
        ) : exerciseType === "distance_duration" && renderDuration ? (
          <>
            <input
              type="text"
              value={displayDuration}
              onFocus={() => {
                setIsFocused(true);
                setDurationInput(durationDisplay);
              }}
              onBlur={() => {
                setIsFocused(false);
                onDurationChange!(mmssToSeconds(durationInput));
              }}
              onChange={(e) => setDurationInput(e.target.value)}
              style={{ ...inputBase, color: ink }}
              pattern="[0-9]+:[0-5][0-9]"
            />
            <SuffixLabel>TIME</SuffixLabel>
          </>
        ) : null}
      </div>

      {/* Volume readout */}
      <div
        style={{
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 0,
        }}
      >
        {exerciseType === "weight_reps" ? (
          <>
            <span
              className="font-mono-sm"
              style={{ fontWeight: 500, color: "var(--color-text-primary)" }}
            >
              {volume}
            </span>
            <span
              className="text-label-sm"
              style={{ color: "var(--color-text-tertiary)", fontSize: 8 }}
            >
              KG VOL
            </span>
          </>
        ) : exerciseType === "reps_only" ? (
          <>
            <span
              className="font-mono-sm"
              style={{ fontWeight: 500, color: "var(--color-text-primary)" }}
            >
              {reps}
            </span>
            <span
              className="text-label-sm"
              style={{ color: "var(--color-text-tertiary)", fontSize: 8 }}
            >
              REPS
            </span>
          </>
        ) : null}
      </div>

      {/* Done check */}
      <button
        onClick={onToggleComplete}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        style={{
          width: 28,
          height: 28,
          border: "none",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          background: done ? "var(--color-secondary)" : "var(--color-low)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Check size={13} color={done ? "#fff" : "var(--color-text-muted)"} strokeWidth={2} />
      </button>

      {/* Delete set */}
      <button
        onClick={onDelete}
        disabled={!canDelete || !onDelete}
        aria-label="Delete set"
        title="Delete set"
        style={{
          width: 22,
          height: 22,
          border: "none",
          borderRadius: "var(--radius-sm)",
          cursor: canDelete && onDelete ? "pointer" : "not-allowed",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: canDelete && onDelete ? 1 : 0.3,
        }}
      >
        <X size={12} color="var(--color-text-tertiary)" strokeWidth={1.8} />
      </button>
    </div>
  );
}
