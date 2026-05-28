"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkout } from "@/app/_providers/workout-provider";
import { useHevy, type SyncSummary } from "@/app/_providers/hevy-provider";
import { ExerciseCard } from "@/components/ExerciseCard";
import { WorkoutExercise, Exercise, DuplicateWorkoutInfo } from "@/lib/types";
import { calculateWorkoutMetrics, formatVolume } from "@/lib/mock-data";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ExercisePickerDropdown } from "@/components/ExercisePickerDropdown";
import { Overline } from "@/app/_components/overline";
import { WGhost, WPrimary, WText } from "@/app/_components/web-button";
import { EquipBadge } from "@/app/_components/equip-badge";
import {
  AlertTriangle,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Send,
  Plus,
  ExternalLink,
  Check,
} from "lucide-react";

function partOfDay(date: Date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function fmtTime12(timeHHMM: string) {
  const [h, m] = timeHHMM.split(":").map(Number);
  const period = h >= 12 ? "p" : "a";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")}${period}`;
}

export default function ReviewPage() {
  const router = useRouter();
  const {
    processedExercises,
    setProcessedExercises,
    uploadedImage,
    setUploadedImage,
    caption,
    setCaption,
    extractedWorkoutDate,
    extractedWorkoutTime,
    detectionModel,
    detectionConfidence,
  } = useWorkout();

  const { commitWorkout, findDuplicateForDate } = useHevy();
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);

  const [exercises, setExercises] = useState<WorkoutExercise[]>(processedExercises);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateWorkoutInfo | null>(null);
  const [showDup, setShowDup] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const [workoutDate, setWorkoutDate] = useState<Date>(extractedWorkoutDate ?? new Date());
  const [workoutTime, setWorkoutTime] = useState<string>(extractedWorkoutTime ?? "08:00");
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [pickerOpenIndex, setPickerOpenIndex] = useState<number | null>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reflect EXIF-extracted date/time when first loaded.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (extractedWorkoutDate) setWorkoutDate(extractedWorkoutDate);
  }, [extractedWorkoutDate]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (extractedWorkoutTime) setWorkoutTime(extractedWorkoutTime);
  }, [extractedWorkoutTime]);

  // Bounce back to upload if no exercises
  useEffect(() => {
    if (processedExercises.length === 0) {
      router.push("/");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExercises(processedExercises);
    }
  }, [processedExercises, router]);

  // Manage blob URL for image preview — recreate on file change, revoke on unmount.
  useEffect(() => {
    if (!uploadedImage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(uploadedImage);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadedImage]);

  // Duplicate check — fetches workouts for the selected date from Hevy.
  // Race-safe: a stale in-flight response can't overwrite a newer one.
  useEffect(() => {
    let cancelled = false;
    findDuplicateForDate(workoutDate)
      .then((dup) => {
        if (cancelled) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDuplicate(dup);
      })
      .catch(() => {
        if (cancelled) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDuplicate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workoutDate, findDuplicateForDate]);

  // Set updates. For weight (and reps when changing the first row), if the
  // user fills a value into one set we propagate it down to all subsequent
  // sets that still hold the default 0 — so users editing a freshly-detected
  // exercise don't have to retype the same weight on every row.
  const handleUpdateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: "kg" | "reps" | "distance" | "duration" | "completed",
    value: number | boolean,
  ) => {
    const next = [...exercises];
    const ex = next[exerciseIndex];
    const set = ex.sets[setIndex];
    const t = ex.exercise.type;
    if (field === "completed") {
      set.completed = value as boolean;
    } else if (typeof value === "number") {
      if (field === "kg" && t === "weight_reps") {
        const prev = set.weight_kg ?? set.kg ?? 0;
        set.weight_kg = value;
        set.kg = value;
        if (value > 0) {
          // Propagate down. A row is "trailing" if its weight is 0 (default)
          // or equals the source's previous value (so multi-keystroke edits
          // like "3" → "34" → "340" keep the downstream rows in lockstep
          // until the user explicitly overrides one).
          for (let j = setIndex + 1; j < ex.sets.length; j++) {
            const downstream = ex.sets[j];
            const dw = downstream.weight_kg ?? downstream.kg ?? 0;
            if (dw === 0 || dw === prev) {
              downstream.weight_kg = value;
              downstream.kg = value;
            }
          }
        }
      } else if (field === "reps" && (t === "weight_reps" || t === "reps_only")) {
        const prev = set.reps ?? 0;
        set.reps = value;
        if (value > 0) {
          for (let j = setIndex + 1; j < ex.sets.length; j++) {
            const downstream = ex.sets[j];
            const dr = downstream.reps ?? 0;
            if (dr === 0 || dr === prev) {
              downstream.reps = value;
            }
          }
        }
      } else if (field === "distance" && t === "distance_duration") {
        set.distance_meters = value;
      } else if (field === "duration" && (t === "duration" || t === "distance_duration")) {
        set.duration_seconds = value;
      }
    }
    setExercises(next);
    setProcessedExercises(next);
  };

  const handleDeleteSet = (exerciseIndex: number, setIndex: number) => {
    const next = [...exercises];
    const ex = next[exerciseIndex];
    if (ex.sets.length <= 1) return;
    ex.sets.splice(setIndex, 1);
    ex.sets.forEach((s, idx) => {
      s.set_number = idx + 1;
    });
    setExercises(next);
    setProcessedExercises(next);
  };

  const handleAddSet = (exerciseIndex: number) => {
    const next = [...exercises];
    const ex = next[exerciseIndex];
    const last = ex.sets[ex.sets.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newSet: any = { set_number: ex.sets.length + 1, completed: false };
    switch (ex.exercise.type) {
      case "weight_reps":
        newSet.weight_kg = last.weight_kg ?? last.kg ?? 0;
        newSet.reps = last.reps ?? 0;
        newSet.kg = newSet.weight_kg;
        break;
      case "reps_only":
        newSet.reps = last.reps ?? 0;
        break;
      case "duration":
        newSet.duration_seconds = last.duration_seconds ?? 0;
        break;
      case "distance_duration":
        newSet.distance_meters = last.distance_meters ?? 0;
        newSet.duration_seconds = last.duration_seconds ?? 0;
        break;
    }
    ex.sets.push(newSet);
    setExercises(next);
    setProcessedExercises(next);
  };

  const handleExerciseChange = (exerciseIndex: number, newExercise: Exercise) => {
    const next = [...exercises];
    const oldType = next[exerciseIndex].exercise.type;
    const newType = newExercise.type;
    next[exerciseIndex].exercise = newExercise;
    next[exerciseIndex].matchScore = 150;
    if (oldType !== newType) {
      next[exerciseIndex].sets = next[exerciseIndex].sets.map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m: any = { set_number: s.set_number, completed: s.completed };
        switch (newType) {
          case "weight_reps":
            m.weight_kg = s.weight_kg ?? s.kg ?? 0;
            m.reps = s.reps ?? 0;
            m.kg = m.weight_kg;
            break;
          case "reps_only":
            m.reps = s.reps ?? 0;
            break;
          case "duration":
            m.duration_seconds = s.duration_seconds ?? 0;
            break;
          case "distance_duration":
            m.distance_meters = s.distance_meters ?? 0;
            m.duration_seconds = s.duration_seconds ?? 0;
            break;
        }
        return m;
      });
    }
    setExercises(next);
    setProcessedExercises(next);
  };

  const handleDeleteExercise = (exerciseIndex: number) => {
    if (confirm("Delete this exercise?")) {
      const next = exercises.filter((_, i) => i !== exerciseIndex);
      setExercises(next);
      setProcessedExercises(next);
    }
  };

  const handleAddExercise = (ex: Exercise) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sets: any[] = Array.from({ length: 3 }, (_, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base: any = { set_number: i + 1, completed: false };
      switch (ex.type) {
        case "weight_reps":
          base.weight_kg = 0;
          base.reps = 0;
          base.kg = 0;
          break;
        case "reps_only":
          base.reps = 0;
          break;
        case "duration":
          base.duration_seconds = 0;
          break;
        case "distance_duration":
          base.distance_meters = 0;
          base.duration_seconds = 0;
          break;
      }
      return base;
    });
    const next = [
      ...exercises,
      { exercise: ex, sets, notes: "", rest_timer_enabled: false, matchScore: 150 } as WorkoutExercise,
    ];
    setExercises(next);
    setProcessedExercises(next);
    setAddPickerOpen(false);
  };

  const metrics = calculateWorkoutMetrics(exercises);
  const totalCount = exercises.length;

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    const [hh, mm] = workoutTime.split(":").map(Number);
    const combined = new Date(workoutDate);
    combined.setHours(hh, mm, 0, 0);
    const workout = {
      id: `workout-${Date.now()}`,
      duration_minutes: durationMinutes,
      total_volume_kg: metrics.total_volume_kg,
      total_sets: metrics.total_sets,
      exercises,
      date: combined,
      caption,
      sync_to_hevy: true,
      share_to_instagram: false,
    };
    try {
      const summary = await commitWorkout(workout);
      setSyncResult(summary);
    } catch (err) {
      setSyncError((err as Error).message ?? "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAnother = () => {
    setSyncResult(null);
    setProcessedExercises([]);
    setUploadedImage(null);
    setCaption("");
    router.push("/");
  };

  const handleDiscard = () => {
    if (confirm("Discard this workout?")) router.push("/");
  };

  const headlineDate = format(workoutDate, "MMM dd");
  const headlineTime = fmtTime12(workoutTime);
  const dayName = format(workoutDate, "EEEE");
  const [hh, mm] = workoutTime.split(":").map(Number);
  const _dayDt = new Date(workoutDate);
  _dayDt.setHours(hh, mm, 0, 0);
  const dayPart = partOfDay(_dayDt);

  if (syncResult) {
    return (
      <SyncedHero
        summary={syncResult}
        exercises={exercises}
        onSyncAnother={handleSyncAnother}
        onEdit={() => setSyncResult(null)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div className="edit-page-header" style={{ padding: "var(--space-xl) var(--space-2xl) var(--space-md)" }}>
        <div
          className="edit-heading-row"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Overline>STEP 02 · EDIT</Overline>
            <h1
              className="text-headline-lg edit-heading"
              style={{
                color: "var(--color-text-primary)",
                margin: "8px 0 0",
                fontSize: 28,
                lineHeight: 1.15,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span>
                {dayName} {dayPart},
              </span>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    style={{
                      background: "var(--color-low)",
                      border: "none",
                      color: "var(--color-text-tertiary)",
                      borderRadius: "var(--radius-full)",
                      cursor: "pointer",
                      padding: "2px 12px",
                      fontFamily: "inherit",
                      fontSize: "inherit",
                      fontWeight: 400,
                      lineHeight: "inherit",
                    }}
                  >
                    {headlineDate}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  style={{
                    width: "auto",
                    padding: 8,
                    background: "var(--color-card)",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    boxShadow:
                      "0 16px 40px -10px rgba(28,27,27,0.10), 0 0 0 1px rgba(28,27,27,0.06)",
                  }}
                >
                  <Calendar
                    mode="single"
                    selected={workoutDate}
                    onSelect={(d) => {
                      if (d) {
                        setWorkoutDate(d);
                        setDatePopoverOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              <input
                type="time"
                lang="en-US"
                step={60}
                value={workoutTime}
                onChange={(e) => setWorkoutTime(e.target.value || "08:00")}
                style={{
                  background: "var(--color-low)",
                  border: "none",
                  color: "var(--color-text-tertiary)",
                  borderRadius: "var(--radius-full)",
                  outline: "none",
                  padding: "2px 12px",
                  width: 170,
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  fontWeight: 400,
                  lineHeight: "inherit",
                }}
              />
            </h1>
          </div>
          <div className="edit-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <WGhost onClick={handleDiscard} disabled={isSyncing}>
              Discard
            </WGhost>
            <WPrimary
              onClick={handleSync}
              disabled={isSyncing || exercises.length === 0}
              icon={<Send size={16} color="#fff" strokeWidth={1.7} />}
            >
              {isSyncing ? "Syncing…" : "Sync to Hevy"}
            </WPrimary>
          </div>
        </div>
        {syncError && (
          <div
            className="text-body-sm animate-slide-down"
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "rgba(186,26,26,0.08)",
              color: "var(--color-error)",
              borderRadius: "var(--radius-md)",
            }}
          >
            {syncError}
          </div>
        )}
      </div>

      {/* Tonal break */}
      <div className="edit-page-body" style={{ background: "var(--color-low)", padding: "var(--space-lg) var(--space-2xl) var(--space-2xl)" }}>
        <div
          className="edit-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Stat strip */}
            <div
              className="web-stat-strip"
              style={{
                background: "var(--color-card)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 18px",
                display: "grid",
                gridTemplateColumns: "1.3fr 1.3fr 1fr 1fr",
                gap: 18,
                alignItems: "flex-end",
              }}
            >
              <div>
                <Overline>DURATION</Overline>
                <div
                  className="stat-cell-value"
                  style={{
                    color: "var(--color-text-primary)",
                    marginTop: 2,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "baseline",
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value) || 0))}
                    className="stat-cell-input"
                    style={{
                      width: 56,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      fontSize: 22,
                      color: "var(--color-text-primary)",
                      padding: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                  <span
                    className="text-body-sm"
                    style={{
                      color: "var(--color-text-tertiary)",
                      marginLeft: 3,
                      fontWeight: 500,
                    }}
                  >
                    m
                  </span>
                </div>
              </div>
              {(
                [
                  ["VOLUME", formatVolume(metrics.total_volume_kg), "kg"],
                  ["SETS", String(metrics.total_sets), null],
                  ["EXERCISES", String(totalCount), null],
                ] as const
              ).map(([label, value, suffix]) => (
                <div key={label}>
                  <Overline>{label}</Overline>
                  <div
                    className="font-mono-lg stat-cell-value"
                    style={{
                      color: "var(--color-text-primary)",
                      marginTop: 2,
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {value}
                    {suffix && (
                      <span
                        className="text-body-sm"
                        style={{
                          color: "var(--color-text-tertiary)",
                          marginLeft: 3,
                          fontWeight: 500,
                        }}
                      >
                        {suffix}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Duplicate banner */}
            {duplicate && showDup && (
              <div
                className="animate-slide-down"
                style={{
                  background: "rgba(184,134,11,0.10)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <AlertTriangle size={16} color="var(--color-warning)" strokeWidth={1.6} />
                <div className="text-body-sm" style={{ flex: 1, color: "var(--color-warning)" }}>
                  <span style={{ fontWeight: 600 }}>Possible duplicate.</span> A workout was logged
                  on {format(duplicate.date, "MMM dd")} at {duplicate.time} — &ldquo;{duplicate.name}&rdquo;.
                </div>
                <button
                  onClick={() => setShowDup(false)}
                  aria-label="Dismiss"
                  style={{
                    width: 28,
                    height: 28,
                    border: "none",
                    borderRadius: "var(--radius-full)",
                    cursor: "pointer",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={14} color="var(--color-warning)" />
                </button>
              </div>
            )}

            {/* Section header */}
            <div style={{ padding: "12px 4px 0" }}>
              <Overline>{totalCount} EXERCISES DETECTED</Overline>
            </div>

            {exercises.map((ex, i) => (
              <ExerciseCard
                key={i}
                workoutExercise={ex}
                featured={pickerOpenIndex === i}
                onUpdateSet={(setIndex, field, value) =>
                  handleUpdateSet(i, setIndex, field, value)
                }
                onAddSet={() => handleAddSet(i)}
                onDeleteSet={(setIndex) => handleDeleteSet(i, setIndex)}
                onExerciseChange={(newEx) => handleExerciseChange(i, newEx)}
                onDelete={() => handleDeleteExercise(i)}
                onPickerOpenChange={(open) => setPickerOpenIndex(open ? i : null)}
              />
            ))}

            {/* Add exercise */}
            <Popover open={addPickerOpen} onOpenChange={setAddPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  style={{
                    height: 40,
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    background: "transparent",
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: "inset 0 0 0 1.5px var(--color-outline)",
                  }}
                >
                  <Plus size={13} color="var(--color-text-secondary)" /> Add exercise
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                sideOffset={8}
                className="p-0 border-0 bg-transparent shadow-none"
                style={{ width: 520 }}
              >
                <ExercisePickerDropdown
                  onSelect={handleAddExercise}
                  onCancel={() => setAddPickerOpen(false)}
                />
              </PopoverContent>
            </Popover>

            {/* Caption */}
            <div style={{ marginTop: 8 }}>
              <Overline style={{ marginBottom: 6 }}>
                CAPTION · SYNCED AS WORKOUT DESCRIPTION
              </Overline>
              <textarea
                placeholder="Add a note about this workout…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="text-body-sm"
                style={{
                  background: "var(--color-card)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  color: "var(--color-text-primary)",
                  minHeight: 56,
                  width: "100%",
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "var(--font-body)",
                }}
              />
            </div>
          </div>

          {/* RIGHT — sticky */}
          <div
            className="edit-rail"
            style={{
              position: "sticky",
              top: 16,
              alignSelf: "start",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              maxHeight: "calc(100vh - 32px)",
            }}
          >
            {/* Source photo */}
            <div
              style={{
                background: "var(--color-card)",
                borderRadius: "var(--radius-lg)",
                padding: 12,
              }}
            >
              {imageUrl ? (
                <TransformWrapper
                  initialScale={1}
                  minScale={0.5}
                  maxScale={4}
                  centerOnInit
                  wheel={{ step: 0.3 }}
                  doubleClick={{ mode: "reset" }}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0 2px 8px",
                        }}
                      >
                        <Overline>SOURCE PHOTO</Overline>
                        <div style={{ display: "flex", gap: 6 }}>
                          <ZoomBtn ariaLabel="Zoom in" onClick={() => zoomIn()}>
                            <ZoomIn size={13} color="var(--color-text-tertiary)" />
                          </ZoomBtn>
                          <ZoomBtn ariaLabel="Zoom out" onClick={() => zoomOut()}>
                            <ZoomOut size={13} color="var(--color-text-tertiary)" />
                          </ZoomBtn>
                          <ZoomBtn ariaLabel="Reset zoom" onClick={() => resetTransform()}>
                            <Maximize2 size={13} color="var(--color-text-tertiary)" />
                          </ZoomBtn>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 320,
                          borderRadius: "var(--radius-xl)",
                          overflow: "hidden",
                          background: "var(--color-low)",
                          position: "relative",
                        }}
                      >
                        <TransformComponent
                          wrapperClass="!w-full !h-full"
                          contentClass="!w-full !h-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageUrl}
                            alt="Workout source"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              cursor: "grab",
                            }}
                          />
                        </TransformComponent>
                      </div>
                    </>
                  )}
                </TransformWrapper>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 4px 12px",
                    }}
                  >
                    <Overline>SOURCE PHOTO</Overline>
                  </div>
                  <div
                    className="text-body-md"
                    style={{
                      height: 320,
                      borderRadius: "var(--radius-md)",
                      background: "var(--color-low)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    No image
                  </div>
                </>
              )}
            </div>

            {/* Detection summary */}
            <div
              style={{
                background: "var(--color-card)",
                borderRadius: "var(--radius-lg)",
                padding: 14,
              }}
            >
              <Overline>DETECTION SUMMARY</Overline>
              <div
                style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}
              >
                {(() => {
                  const confColor =
                    detectionConfidence === null
                      ? "var(--color-text-primary)"
                      : detectionConfidence >= 60
                        ? "var(--color-secondary)"
                        : "var(--color-warning)";
                  const rows: Array<[string, string, string]> = [
                    ["Model", detectionModel ?? "—", "var(--color-text-primary)"],
                    [
                      "Confidence",
                      detectionConfidence !== null ? `${detectionConfidence}%` : "—",
                      confColor,
                    ],
                    [
                      "EXIF date",
                      extractedWorkoutDate
                        ? `${format(extractedWorkoutDate, "MMM dd")} · ${headlineTime}`
                        : "—",
                      "var(--color-text-primary)",
                    ],
                  ];
                  return rows.map(([k, v, c]) => (
                    <div
                      key={k}
                      className="text-body-sm"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <span style={{ color: "var(--color-text-tertiary)" }}>{k}</span>
                      <span
                        className="text-title-sm"
                        style={{ color: c, fontWeight: 500 }}
                      >
                        {v}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function ZoomBtn({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 28,
        height: 28,
        border: "none",
        borderRadius: 8,
        background: "var(--color-low)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

// ── Synced hero (post-commit state of /review) ──────────────────────────

function SyncedHero({
  summary,
  exercises,
  onSyncAnother,
  onEdit,
}: {
  summary: SyncSummary;
  exercises: WorkoutExercise[];
  onSyncAnother: () => void;
  onEdit: () => void;
}) {
  const dateStr = format(summary.date, "MMM dd");
  const timeStr = summary.time ? fmtTime12(summary.time) : "";

  return (
    <div className="sync-page-shell" style={{ maxWidth: 1400, margin: "0 auto", padding: "var(--space-xl) var(--space-2xl)" }}>
      <div
        className="web-grid-6040"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 28,
          alignItems: "start",
          marginBottom: 16,
        }}
      >
        <div>
          <Overline>STEP 03 · SYNCED</Overline>
          <h1
            className="text-display-md sync-display"
            style={{
              fontSize: 80,
              lineHeight: 0.92,
              letterSpacing: "-2.4px",
              margin: "10px 0 10px",
              color: "var(--color-text-primary)",
            }}
          >
            Synced.
          </h1>
          <p
            className="text-body-md"
            style={{ color: "var(--color-text-secondary)", margin: 0, maxWidth: 440 }}
          >
            Your workout is in your training log. Logged at{" "}
            <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
              {dateStr}
              {timeStr && ` · ${timeStr}`}
            </span>
            .
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            <WPrimary
              icon={<ExternalLink size={14} color="#fff" strokeWidth={1.6} />}
              onClick={() => window.open(summary.hevy_url ?? "https://hevy.com", "_blank")}
            >
              Open in Hevy
            </WPrimary>
            <WGhost onClick={onSyncAnother}>Sync another</WGhost>
          </div>
        </div>

        <div
          style={{
            background: "var(--color-low)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
          }}
        >
          <Overline>THIS WORKOUT</Overline>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 10,
            }}
          >
            {(
              [
                ["DURATION", `${summary.duration_minutes}m`],
                ["VOLUME", `${formatVolume(summary.total_volume_kg)} kg`],
                ["TOTAL SETS", String(summary.total_sets)],
                ["EXERCISES", String(exercises.length)],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: "var(--color-card)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                }}
              >
                <Overline style={{ fontSize: 9 }}>{k}</Overline>
                <div
                  className="font-mono-lg"
                  style={{
                    color: "var(--color-text-primary)",
                    marginTop: 2,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--color-low)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
          marginTop: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Overline>LOGGED EXERCISES · {exercises.length}</Overline>
          <WText onClick={onEdit}>Edit workout</WText>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exercises.map((we, i) => {
            const ex = we.exercise;
            const setsCount = we.sets.length;
            const summary = `${setsCount} ${setsCount === 1 ? "set" : "sets"}`;
            let volume = "";
            switch (ex.type) {
              case "weight_reps": {
                const vol = we.sets.reduce(
                  (acc, s) => acc + (s.weight_kg ?? s.kg ?? 0) * (s.reps ?? 0),
                  0,
                );
                volume = `${formatVolume(vol)} kg`;
                break;
              }
              case "reps_only": {
                const reps = we.sets.reduce((acc, s) => acc + (s.reps ?? 0), 0);
                volume = `${reps} reps`;
                break;
              }
              case "duration": {
                const sec = we.sets.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
                const mins = Math.floor(sec / 60);
                volume = `${mins}m`;
                break;
              }
              case "distance_duration": {
                const dist = we.sets.reduce((acc, s) => acc + (s.distance_meters ?? 0), 0);
                volume = `${dist} m`;
                break;
              }
            }
            return (
              <div
                key={i}
                className="sync-logged-row"
                style={{
                  background: "var(--color-card)",
                  borderRadius: "var(--radius-md)",
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 120px 22px",
                  gap: 14,
                  alignItems: "center",
                  padding: "10px 14px",
                }}
              >
                <div className="sync-logged-ident">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <EquipBadge official={!ex.is_custom}>
                      {guessEquipment(ex.title)}
                    </EquipBadge>
                    <span
                      className="text-body-sm"
                      style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}
                    >
                      {capitalize(ex.primary_muscle_group)}
                    </span>
                  </div>
                  <div
                    className="text-title-md"
                    style={{ color: "var(--color-text-primary)", marginTop: 2, fontWeight: 500 }}
                  >
                    {ex.title}
                  </div>
                </div>
                <div
                  className="text-body-sm sync-logged-summary"
                  style={{ color: "var(--color-text-tertiary)", fontWeight: 500, fontSize: 12 }}
                >
                  {summary}
                </div>
                <div
                  className="font-mono-sm sync-logged-volume"
                  style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
                >
                  {volume}
                </div>
                <div
                  className="sync-logged-check"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "var(--color-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={10} color="#fff" strokeWidth={2.4} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function guessEquipment(title: string): string {
  const m = title.match(/\(([^)]+)\)/);
  if (m) return m[1].toUpperCase();
  if (/barbell/i.test(title)) return "BARBELL";
  if (/dumbbell/i.test(title)) return "DUMBBELL";
  if (/kettlebell/i.test(title)) return "KETTLEBELL";
  if (/machine/i.test(title)) return "MACHINE";
  if (/cable/i.test(title)) return "CABLE";
  return "BODYWEIGHT";
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
