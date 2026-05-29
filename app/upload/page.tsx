"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, AlertCircle, Info, X } from "lucide-react";
import { useWorkout } from "@/app/_providers/workout-provider";
import { processWorkoutImage } from "@/lib/mock-data";
import { Overline } from "@/app/_components/overline";
import { PhotoDropzone } from "@/app/_components/photo-dropzone";
import type { PreparedImage } from "@/lib/image-resize";

/** Formats the prepared image emits as a renderable preview File. */
const RENDERABLE_MIME = /^image\/(jpe?g|png|webp)$/i;

function base64ToFile(base64: string, name: string, mime: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export default function UploadPage() {
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

    // Optimistic preview: the prepared image is browser-renderable for non-HEIC
    // and for client-resized HEIC. Only small pass-through HEIC needs the
    // server-converted JPEG (set below from the response).
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
      console.error("Error processing image:", err);
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
    <div
      className="upload-page-shell"
      style={{
        padding: "var(--space-xl) var(--space-2xl)",
        maxWidth: 900,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl)",
      }}
    >
      {/* Errors / fallback banners */}
      {error && (
        <Banner tone="error" onDismiss={() => setError(null)} icon={<AlertCircle size={18} />}>
          {error}
        </Banner>
      )}
      {isUsingFallback && (
        <Banner tone="info" onDismiss={() => setIsUsingFallback(false)} icon={<Info size={18} />}>
          Using sample data. Add your GROQ_API_KEY to process real workout images.{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline" }}
          >
            Get API Key →
          </a>
        </Banner>
      )}

      {/* Capture card — mirrors the /food "Log a meal" card layout */}
      <div
        style={{
          background: "var(--color-surface-card)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          width: "100%",
        }}
      >
        <div>
          <Overline>Step 01 · Capture</Overline>
          <h2
            className="text-headline-md"
            style={{ color: "var(--color-text-primary)", margin: "var(--space-2xs) 0 0" }}
          >
            From the gym board to Hevy.
          </h2>
        </div>

        <label
          className="text-label-md"
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Workout photo
        </label>
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

      {/* How it works — compact 3-up below fold */}
      <div
        className="web-grid-howitworks"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
        }}
      >
        {(
          [
            ["01", "Capture", "Whiteboard, screenshot, or handwritten note — all work."],
            ["02", "Parse", "Vision extracts exercises, sets, reps, and matches Hevy's catalog."],
            ["03", "Sync", "Edit anything, then push the session to your training log."],
          ] as const
        ).map(([n, t, d]) => (
          <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                color: "var(--color-primary)",
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {n}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                className="text-title-md"
                style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
              >
                {t}
              </div>
              <div
                className="text-body-sm"
                style={{ color: "var(--color-text-secondary)", marginTop: 2, fontSize: 12 }}
              >
                {d}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Banner({
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
      ? { bg: "rgba(186,26,26,0.08)", fg: "var(--color-error)" }
      : { bg: "rgba(184,134,11,0.10)", fg: "var(--color-warning)" };
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
      <div className="text-body-sm" style={{ flex: 1, color: palette.fg }}>
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: palette.fg,
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
