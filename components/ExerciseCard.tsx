"use client";

import React, { useState } from "react";
import { Plus, Edit2 } from "lucide-react";
import { WorkoutExercise, Exercise } from "@/lib/types";
import { ExerciseRow } from "./ExerciseRow";
import { EquipBadge } from "@/app/_components/equip-badge";
import { ExercisePickerDropdown } from "@/components/ExercisePickerDropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  featured?: boolean;
  onUpdateSet: (
    setIndex: number,
    field: "kg" | "reps" | "distance" | "duration" | "completed",
    value: number | boolean,
  ) => void;
  onAddSet: () => void;
  onDeleteSet: (setIndex: number) => void;
  onExerciseChange: (newExercise: Exercise) => void;
  onDelete: () => void;
  onPickerOpenChange?: (open: boolean) => void;
}

const SET_HEADER_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px 1fr 1fr 88px 28px 22px",
  gap: 8,
  padding: "0 0 4px",
};

function HeaderCell({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <div
      className="text-label-sm"
      style={{
        color: "var(--color-text-tertiary)",
        textAlign: align,
        paddingLeft: align === "left" ? 10 : 0,
        fontSize: 8,
      }}
    >
      {children}
    </div>
  );
}

export function ExerciseCard({
  workoutExercise,
  featured,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onExerciseChange,
  onDelete,
  onPickerOpenChange,
}: ExerciseCardProps) {
  const [pickerOpen, _setPickerOpen] = useState(false);
  const setPickerOpen = (open: boolean) => {
    _setPickerOpen(open);
    onPickerOpenChange?.(open);
  };
  const ex = workoutExercise.exercise;
  const exerciseType = ex.type;
  const isCustom = ex.is_custom;
  const score = workoutExercise.matchScore;
  const pct = score !== undefined ? Math.round((score / 150) * 100) : null;
  const goodMatch = pct !== null && pct >= 40;

  const equipmentLabel = guessEquipmentLabel(ex.title);
  const muscleSecondary = ex.secondary_muscle_groups?.length
    ? ex.secondary_muscle_groups.slice(0, 2).join(" · ")
    : null;

  return (
    <div
      style={{
        background: "var(--color-card)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        boxShadow: featured ? "inset 0 0 0 2px var(--color-primary)" : "none",
        position: "relative",
      }}
    >
      {featured && (
        <div
          className="text-label-sm"
          style={{
            position: "absolute",
            top: -8,
            left: 16,
            background: "var(--color-primary)",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: "var(--radius-full)",
            fontSize: 9,
          }}
        >
          EDITING
        </div>
      )}

      <div className="exercise-card-header" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Drag handle */}
        <div style={{ cursor: "grab", opacity: 0.4, marginTop: 4 }} aria-hidden>
          <svg width="14" height="20" viewBox="0 0 12 20" fill="none">
            <circle cx="3" cy="3" r="1.4" fill="var(--color-text-tertiary)" />
            <circle cx="9" cy="3" r="1.4" fill="var(--color-text-tertiary)" />
            <circle cx="3" cy="10" r="1.4" fill="var(--color-text-tertiary)" />
            <circle cx="9" cy="10" r="1.4" fill="var(--color-text-tertiary)" />
            <circle cx="3" cy="17" r="1.4" fill="var(--color-text-tertiary)" />
            <circle cx="9" cy="17" r="1.4" fill="var(--color-text-tertiary)" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <EquipBadge official={!isCustom}>{equipmentLabel}</EquipBadge>
            <span
              className="text-body-sm"
              style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}
            >
              {capitalize(ex.primary_muscle_group)}
              {muscleSecondary && (
                <>
                  {" "}
                  <span style={{ color: "var(--color-text-muted)" }}>· {muscleSecondary}</span>
                </>
              )}
            </span>
          </div>
          <div
            className="text-title-lg"
            style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
          >
            {ex.title}
          </div>
        </div>

        {/* Match indicator */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          {isCustom ? (
            <span
              className="text-label-sm"
              style={{
                color: "var(--color-warning)",
                background: "rgba(184,134,11,0.10)",
                padding: "3px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              MANUAL
            </span>
          ) : pct !== null ? (
            <>
              <div
                className="text-headline-sm"
                style={{
                  color: goodMatch ? "var(--color-secondary)" : "var(--color-warning)",
                  fontWeight: 500,
                  fontSize: 16,
                }}
              >
                {pct}
                <span className="text-body-sm" style={{ fontWeight: 500, marginLeft: 1, fontSize: 11 }}>
                  %
                </span>
              </div>
              <div
                className="text-label-sm"
                style={{ color: "var(--color-text-tertiary)", fontSize: 8 }}
              >
                MATCH
              </div>
            </>
          ) : null}
        </div>

        {/* Edit (open picker) */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Change exercise"
              style={{
                width: 26,
                height: 26,
                border: "none",
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Edit2 size={13} color="var(--color-text-tertiary)" strokeWidth={1.6} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="p-0 border-0 bg-transparent shadow-none"
            style={{ width: "min(520px, calc(100vw - 16px))" }}
          >
            <ExercisePickerDropdown
              currentTitle={ex.title}
              readText={workoutExercise.rawDetection ?? ex.title}
              onSelect={(picked) => {
                onExerciseChange(picked);
                setPickerOpen(false);
              }}
              onCancel={() => setPickerOpen(false)}
            />
          </PopoverContent>
        </Popover>

        {/* Delete (right-most) — keep for utility */}
        <button
          onClick={onDelete}
          aria-label="Delete exercise"
          style={{
            width: 26,
            height: 26,
            border: "none",
            borderRadius: "var(--radius-full)",
            cursor: "pointer",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-tertiary)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Set table */}
      <div style={{ marginTop: 12, ...SET_HEADER_GRID }}>
        <HeaderCell align="center">SET</HeaderCell>
        <HeaderCell align="left">{firstColLabel(exerciseType)}</HeaderCell>
        <HeaderCell align="left">{secondColLabel(exerciseType)}</HeaderCell>
        <HeaderCell align="right">{volumeColLabel(exerciseType)}</HeaderCell>
        <div />
        <div />
      </div>
      {workoutExercise.sets.map((s, i) => (
        <ExerciseRow
          key={i}
          set={s}
          setNumber={i + 1}
          exerciseType={exerciseType}
          canDelete={workoutExercise.sets.length > 1}
          onWeightChange={
            exerciseType === "weight_reps" ? (v) => onUpdateSet(i, "kg", v) : undefined
          }
          onRepsChange={
            exerciseType === "weight_reps" || exerciseType === "reps_only"
              ? (v) => onUpdateSet(i, "reps", v)
              : undefined
          }
          onDistanceChange={
            exerciseType === "distance_duration" ? (v) => onUpdateSet(i, "distance", v) : undefined
          }
          onDurationChange={
            exerciseType === "duration" || exerciseType === "distance_duration"
              ? (v) => onUpdateSet(i, "duration", v)
              : undefined
          }
          onToggleComplete={() => onUpdateSet(i, "completed", !s.completed)}
          onDelete={() => onDeleteSet(i)}
        />
      ))}

      <button
        onClick={onAddSet}
        style={{
          marginTop: 4,
          height: 30,
          width: "100%",
          border: "none",
          borderRadius: "var(--radius-sm)",
          background: "transparent",
          color: "var(--color-primary)",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          cursor: "pointer",
        }}
      >
        <Plus size={12} color="var(--color-primary)" strokeWidth={1.8} /> Add set
      </button>
    </div>
  );
}

function firstColLabel(t: Exercise["type"]) {
  switch (t) {
    case "weight_reps":
      return "WEIGHT";
    case "reps_only":
      return "REPS";
    case "duration":
      return "TIME";
    case "distance_duration":
      return "DISTANCE";
  }
}
function secondColLabel(t: Exercise["type"]) {
  switch (t) {
    case "weight_reps":
      return "REPS";
    case "distance_duration":
      return "TIME";
    default:
      return "";
  }
}
function volumeColLabel(t: Exercise["type"]) {
  return t === "weight_reps" ? "VOLUME" : t === "reps_only" ? "TOTAL" : "";
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function guessEquipmentLabel(title: string): string {
  const m = title.match(/\(([^)]+)\)/);
  if (m) return m[1].toUpperCase();
  if (/barbell/i.test(title)) return "BARBELL";
  if (/dumbbell/i.test(title)) return "DUMBBELL";
  if (/kettlebell/i.test(title)) return "KETTLEBELL";
  if (/machine/i.test(title)) return "MACHINE";
  if (/cable/i.test(title)) return "CABLE";
  if (/smith/i.test(title)) return "SMITH MACHINE";
  return "BODYWEIGHT";
}
