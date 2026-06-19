"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Camera, Clock, RotateCcw, X, AlertCircle, Info } from "lucide-react";
import { Overline } from "@/app/_components/overline";
import { PhotoDropzone } from "@/app/_components/photo-dropzone";
import { useWorkout } from "@/app/_providers/workout-provider";
import { processWorkoutImage } from "@/lib/mock-data";
import { useSuggestion } from "@/components/dashboard/use-suggestion";
import type { MenuItem, SuggestedMuscle } from "@/lib/dashboard/suggest-engine";
import type { PreparedImage } from "@/lib/image-resize";

const RENDERABLE_MIME = /^image\/(jpe?g|png|webp)$/i;

function base64ToFile(base64: string, name: string, mime: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

// Session time model (seconds). per set = work + rest; per move = walk + setup.
const WORK_PER_SET = 40;
const REST_PER_SET = 90;
const SETUP_PER_MOVE = 180;

type Mode = "suggest" | "log";

export default function WorkoutPage() {
  const { suggestion, loading, error, generate, selectRegion } = useSuggestion();
  const [mode, setMode] = useState<Mode>("suggest");

  // per-muscle selected exercise + discarded groups (persist across mode toggle)
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [discarded, setDiscarded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void generate();
  }, [generate]);

  const muscles = suggestion?.muscles ?? [];
  const active = muscles.filter((m) => !discarded[m.muscle]);

  const estimate = useMemo(() => {
    let sets = 0;
    let sec = 0;
    for (const m of active) {
      sets += m.dose;
      sec += m.dose * (WORK_PER_SET + REST_PER_SET) + SETUP_PER_MOVE;
    }
    return { sets, sec, groups: active.length };
  }, [active]);

  const discardedCount = muscles.length - active.length;

  function resetPlan() {
    setDiscarded({});
    setSelected({});
  }

  return (
    <div className="uw" style={{ maxWidth: 860, margin: "0 auto", padding: "var(--space-xl) clamp(var(--space-md), 4vw, var(--space-2xl)) var(--space-3xl)" }}>
      <style dangerouslySetInnerHTML={{ __html: UW_CSS }} />

      <div className="uw-hdr">
        <div>
          <Overline>Workout</Overline>
          <h1 className="text-headline-md" style={{ color: "var(--color-text-primary)", margin: "var(--space-2xs) 0 0" }}>
            Today.
          </h1>
        </div>
        <div className="uw-seg" role="tablist">
          <button className={mode === "suggest" ? "on" : ""} onClick={() => setMode("suggest")} role="tab" aria-selected={mode === "suggest"}>
            <Sparkles size={14} /> Suggest
          </button>
          <button className={mode === "log" ? "on" : ""} onClick={() => setMode("log")} role="tab" aria-selected={mode === "log"}>
            <Camera size={14} /> Log workout
          </button>
        </div>
      </div>

      {/* Suggest pane */}
      <div style={{ display: mode === "suggest" ? "block" : "none" }}>
        {loading ? (
          <div className="uw-panel"><div className="uw-notice">Building your session…</div></div>
        ) : error ? (
          <div className="uw-panel"><div className="uw-notice">Couldn&apos;t build a suggestion: {error}</div></div>
        ) : !suggestion ? null : (
          <div className="uw-panel">
            <div className="uw-ehead">
              <div>
                <div className="uw-regionrow">
                  <div className="uw-rsel" role="tablist" aria-label="Region">
                    <button
                      role="tab"
                      className={suggestion.region === "upper" ? "on" : ""}
                      onClick={() => selectRegion("upper")}
                      aria-selected={suggestion.region === "upper"}
                    >
                      Upper
                    </button>
                    <button
                      role="tab"
                      className={suggestion.region === "lower" ? "on" : ""}
                      onClick={() => selectRegion("lower")}
                      aria-selected={suggestion.region === "lower"}
                    >
                      Lower
                    </button>
                  </div>
                  <span className="text-label-sm" style={{ color: "var(--color-text-tertiary)" }}>
                    {estimate.groups} group{estimate.groups === 1 ? "" : "s"} behind
                  </span>
                </div>
                {active.length > 0 && (
                  <>
                    <div className="uw-etime">
                      <Clock size={16} className="clock" />
                      <span className="big">~{fmtDur(estimate.sec)}</span>
                      <span className="est">est. time</span>
                    </div>
                    <div className="uw-ebreak">
                      ≈ {estimate.sets} sets · ~2½ min/set incl. rest · +3 min walk &amp; setup per move
                    </div>
                  </>
                )}
              </div>
              {discardedCount > 0 && (
                <button className="uw-reset" onClick={resetPlan}>
                  <RotateCcw size={13} /> Reset · {discardedCount} discarded
                </button>
              )}
            </div>

            {active.length > 0 ? (
              <div className="uw-bands">
                {active.map((m) => (
                  <Band
                    key={m.muscle}
                    muscle={m}
                    selectedIndex={selected[m.muscle] ?? 0}
                    onSelect={(j) => setSelected((s) => ({ ...s, [m.muscle]: j }))}
                    onDiscard={() => setDiscarded((d) => ({ ...d, [m.muscle]: true }))}
                  />
                ))}
              </div>
            ) : muscles.length > 0 ? (
              <div className="uw-empty text-body-sm">
                Every group discarded.{" "}
                <a onClick={resetPlan}>Reset</a> to bring them back.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Log workout pane — same PhotoDropzone surface as Upload + Food */}
      <div style={{ display: mode === "log" ? "block" : "none" }}>
        <LogPane />
      </div>
    </div>
  );
}

function LogPane() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const {
    setUploadedImage,
    setProcessedExercises,
    setExtractedWorkoutDate,
    setExtractedWorkoutTime,
    setDetectionModel,
    setDetectionConfidence,
  } = useWorkout();

  const handlePrepared = async (prepared: PreparedImage) => {
    setError(null);
    setIsUsingFallback(false);
    setExtractedWorkoutDate(null);
    setExtractedWorkoutTime(null);

    const renderable = RENDERABLE_MIME.test(prepared.mimeType);
    if (renderable) {
      setUploadedImage(base64ToFile(prepared.base64, prepared.filename, prepared.mimeType));
    }

    setIsProcessing(true);
    try {
      const result = await processWorkoutImage(prepared);
      setProcessedExercises(result.exercises);
      if (!renderable && result.convertedImageFile) {
        setUploadedImage(result.convertedImageFile);
      }
      if (result.workoutStartDate && result.workoutStartTime) {
        setExtractedWorkoutDate(result.workoutStartDate);
        setExtractedWorkoutTime(result.workoutStartTime);
      }
      setDetectionModel(result.modelName);
      setDetectionConfidence(result.confidence);
      if (
        result.exercises.length === 1 &&
        result.exercises[0].exercise.title === "Push Press" &&
        result.exercises[0].sets.length === 5
      ) {
        setIsUsingFallback(true);
      }
      router.push("/review");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      if (message.includes("API key") || message.includes("configuration")) {
        setError("API not configured. Add your GROQ_API_KEY to continue.");
      } else if (message.includes("rate limit")) {
        setError("Rate limit exceeded. Wait a moment and try again.");
      } else if (message.includes("network") || message.includes("fetch")) {
        setError("Network error. Check your connection and try again.");
      } else if (message.includes("Invalid file") || message.includes("size exceeds")) {
        setError(message);
      } else {
        setError("Failed to process image: " + message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="uw-panel">
      {error && (
        <LogBanner tone="error" icon={<AlertCircle size={16} />} onDismiss={() => setError(null)}>
          {error}
        </LogBanner>
      )}
      {isUsingFallback && (
        <LogBanner tone="info" icon={<Info size={16} />} onDismiss={() => setIsUsingFallback(false)}>
          Using sample data. Add your GROQ_API_KEY to process real workout images.
        </LogBanner>
      )}

      <span className="text-label-md" style={{ color: "var(--color-text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Workout photo
      </span>
      <PhotoDropzone
        icon={<Camera size={14} />}
        label="Tap to pick a workout photo · or paste"
        busyLabel="Processing…"
        busy={isProcessing}
        minHeight={260}
        onPrepared={handlePrepared}
        onError={setError}
      />
    </div>
  );
}

function LogBanner({
  tone,
  icon,
  onDismiss,
  children,
}: {
  tone: "error" | "info";
  icon: React.ReactNode;
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  const palette =
    tone === "error"
      ? { bg: "rgba(255,107,107,0.10)", fg: "var(--color-semantic-error)" }
      : { bg: "rgba(255,201,74,0.12)", fg: "var(--color-semantic-warning)" };
  return (
    <div
      className="animate-slide-down"
      style={{
        background: palette.bg,
        color: palette.fg,
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      <div className="text-body-sm" style={{ flex: 1, color: palette.fg }}>{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: palette.fg, display: "flex", alignItems: "center" }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function Band({
  muscle,
  selectedIndex,
  onSelect,
  onDiscard,
}: {
  muscle: SuggestedMuscle;
  selectedIndex: number;
  onSelect: (j: number) => void;
  onDiscard: () => void;
}) {
  return (
    <div className="uw-band">
      <div className="uw-blabel">
        <span className="text-title-sm">{muscle.label}</span>
        <span className="uw-bdef">
          <span className="warn">~{muscle.dose} sets</span>
          <span className="sub"> · {muscle.current}/{muscle.target} wk</span>
        </span>
      </div>
      <div className="uw-bex">
        {muscle.menu.map((item, j) => (
          <div
            key={item.templateId}
            className={`uw-cell${j === selectedIndex ? " sel" : ""}`}
            onClick={() => onSelect(j)}
          >
            <span className="dot" />
            <span className="nm">{item.title}</span>
            <span className="last">{cellLoad(item)}</span>
          </div>
        ))}
      </div>
      <button className="uw-discard" title={`Discard ${muscle.label}`} onClick={onDiscard}>
        <X size={15} />
      </button>
    </div>
  );
}

function cellLoad(item: MenuItem): string {
  if (!item.fromHistory) return "new";
  if (item.lastWeightKg != null) {
    return `${item.lastWeightKg}kg${item.lastReps != null ? `×${item.lastReps}` : ""}`;
  }
  if (item.lastReps != null) return `${item.lastReps} reps`;
  return "logged";
}

function fmtDur(sec: number): string {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

const UW_CSS = `
.uw { display:flex; flex-direction:column; gap:var(--space-lg); }
.uw-hdr { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--space-lg); flex-wrap:wrap; }
.uw-seg { display:inline-flex; background:var(--color-surface-low); border-radius:var(--radius-full); padding:3px; gap:2px; }
.uw-seg button { font-family:var(--font-body); cursor:pointer; border:none; background:transparent; color:var(--color-text-tertiary); font-size:13px; font-weight:600; height:32px; padding:0 18px; border-radius:var(--radius-full); display:inline-flex; align-items:center; gap:6px; transition:color var(--motion-fast) var(--ease); }
.uw-seg button.on { background:var(--color-surface-card); color:var(--color-text-primary); box-shadow:0 1px 2px rgba(0,0,0,0.3); }
.uw-regionrow { display:flex; align-items:center; gap:var(--space-sm); }
.uw-rsel { display:inline-flex; background:var(--color-surface-low); border-radius:var(--radius-full); padding:3px; gap:2px; }
.uw-rsel button { font-family:var(--font-body); cursor:pointer; border:none; background:transparent; color:var(--color-text-tertiary); font-size:12px; font-weight:600; height:28px; padding:0 14px; border-radius:var(--radius-full); transition:color var(--motion-fast) var(--ease); }
.uw-rsel button.on { background:var(--color-surface-elevated); color:var(--color-text-primary); box-shadow:0 1px 2px rgba(0,0,0,0.3); }
.uw-panel { background:var(--color-surface-card); border-radius:var(--radius-card); padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-sm); }
.uw-ehead { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding-bottom:12px; margin-bottom:4px; border-bottom:1px solid var(--color-outline); }
.uw-etime { display:flex; align-items:baseline; gap:9px; margin-top:7px; white-space:nowrap; }
.uw-etime .clock { color:var(--color-text-tertiary); align-self:center; }
.uw-etime .big { font-family:var(--font-mono); font-weight:500; font-size:27px; color:var(--color-text-primary); letter-spacing:-0.5px; font-variant-numeric:tabular-nums; }
.uw-etime .est { font-family:var(--font-body); font-weight:600; font-size:10px; letter-spacing:1.4px; text-transform:uppercase; color:var(--color-text-muted); }
.uw-ebreak { font-family:var(--font-mono); font-size:11px; color:var(--color-text-muted); margin-top:5px; }
.uw-reset { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-body); font-weight:600; font-size:12px; color:var(--color-text-secondary); background:var(--color-surface-elevated); border:none; box-shadow:inset 0 0 0 1px var(--color-outline); height:32px; padding:0 14px; border-radius:8px; cursor:pointer; white-space:nowrap; transition:color var(--motion-fast) var(--ease); }
.uw-reset:hover { color:var(--color-text-primary); }
.uw-bands { border-radius:var(--radius-md); overflow:hidden; }
.uw-band { display:grid; grid-template-columns:172px 1fr auto; align-items:stretch; gap:16px; padding:12px 14px; background:var(--color-surface-low); }
.uw-band + .uw-band { border-top:1px solid var(--color-outline); }
.uw-blabel { display:flex; flex-direction:column; justify-content:center; gap:5px; border-right:1px solid var(--color-outline); padding-right:16px; }
.uw-bdef { font-family:var(--font-mono); font-size:11px; }
.uw-bdef .warn { color:var(--color-semantic-warning); }
.uw-bdef .sub { color:var(--color-text-muted); }
.uw-bex { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.uw-cell { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:9px; padding:8px 11px; background:var(--color-surface-card); border-radius:var(--radius-sm); cursor:pointer; min-width:0; transition:background var(--motion-fast) var(--ease); }
.uw-cell:hover { background:var(--color-surface-elevated); }
.uw-cell .dot { width:7px; height:7px; border-radius:var(--radius-full); border:1.5px solid var(--color-text-muted); flex-shrink:0; }
.uw-cell.sel { box-shadow:inset 0 0 0 1px var(--color-brand-accent); }
.uw-cell.sel .dot { background:var(--color-brand-accent); border-color:var(--color-brand-accent); }
.uw-cell .nm { font-size:13px; color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.uw-cell .last { font-family:var(--font-mono); font-size:10px; color:var(--color-text-muted); white-space:nowrap; }
.uw-discard { align-self:center; display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:none; background:transparent; color:var(--color-text-muted); border-radius:var(--radius-sm); cursor:pointer; transition:color var(--motion-fast) var(--ease), background var(--motion-fast) var(--ease); }
.uw-discard:hover { color:var(--color-semantic-error); background:var(--color-surface-card); }
.uw-empty { padding:28px 14px; text-align:center; color:var(--color-text-muted); }
.uw-empty a { color:var(--color-brand-accent); text-decoration:none; cursor:pointer; }
.uw-notice { padding:10px 12px; background:var(--color-surface-low); border-radius:var(--radius-md); color:var(--color-text-tertiary); font-size:13px; }
`;
