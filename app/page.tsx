"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Clipboard, AlertCircle, Info, X } from "lucide-react";
import { useWorkout } from "@/app/_providers/workout-provider";
import { processWorkoutImage } from "@/lib/mock-data";
import { Overline } from "@/app/_components/overline";
import { WPrimary, WGhost } from "@/app/_components/web-button";

const ACCEPTED = "image/*,.heic,.heif";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const {
    setUploadedImage,
    setProcessedExercises,
    setExtractedWorkoutDate,
    setExtractedWorkoutTime,
    setDetectionModel,
    setDetectionConfidence,
  } = useWorkout();

  const processFile = async (file: File) => {
    setUploadedImage(file);
    setError(null);
    setIsUsingFallback(false);
    setExtractedWorkoutDate(null);
    setExtractedWorkoutTime(null);
    setIsProcessing(true);
    try {
      const result = await processWorkoutImage(file);
      setProcessedExercises(result.exercises);
      if (result.convertedImageFile) {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleChooseFile = () => fileInputRef.current?.click();

  const handlePasteClick = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t: string) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `pasted.${imageType.split("/")[1]}`, { type: imageType });
          await processFile(file);
          return;
        }
      }
      setError("No image on clipboard. Copy an image first.");
    } catch (err) {
      console.error(err);
      setError("Could not read clipboard. Allow clipboard access or use Choose file.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = () => setDragActive(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Global paste handler
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            return;
          }
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        padding: "20px 40px 24px",
        maxWidth: 1280,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 20,
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

      {/* Hero stack: heading top, drop area below */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Heading block */}
        <div>
          <Overline>STEP 01 · CAPTURE</Overline>
          <h1
            className="text-display-sm"
            style={{
              color: "var(--color-text-primary)",
              margin: "8px 0 8px",
              maxWidth: 720,
              fontSize: 40,
              lineHeight: 1.02,
            }}
          >
            From the gym&nbsp;board to Hevy in one&nbsp;shot.
          </h1>
          <p
            className="text-body-sm"
            style={{
              color: "var(--color-text-secondary)",
              margin: 0,
              maxWidth: 640,
            }}
          >
            Drop a photo of any workout board, screenshot, or note. Vision parses every exercise,
            set, and rep — you review, then sync.
          </p>
        </div>

        {/* Drop area fills remaining vertical space */}
        <div
          style={{
            background: "var(--color-low)",
            borderRadius: "var(--radius-lg)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
              minHeight: 280,
              flex: 1,
              borderRadius: "var(--radius-lg)",
              background:
                "repeating-linear-gradient(45deg, var(--color-card) 0 18px, var(--color-low) 18px 36px)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: 18,
              outline: dragActive ? "2px solid var(--color-primary)" : "none",
              outlineOffset: -6,
              transition: "outline 0.15s ease",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--radius-lg)",
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 12px 24px -8px rgba(145,0,208,0.40)",
              }}
            >
              <Camera size={26} color="#fff" strokeWidth={1.6} />
            </div>
            <div
              className="text-headline-sm"
              style={{ color: "var(--color-text-primary)", marginTop: 2, textAlign: "center" }}
            >
              {isProcessing ? "Processing…" : "Drop your workout photo"}
            </div>
            <div
              className="text-body-sm"
              style={{
                color: "var(--color-text-tertiary)",
                textAlign: "center",
                fontSize: 12,
              }}
            >
              PNG · JPG · HEIC up to 20 MB · or paste from clipboard
            </div>
            <div
              style={{
                marginTop: 4,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <WPrimary
                icon={<Camera size={14} color="#fff" strokeWidth={1.7} />}
                onClick={handleChooseFile}
                disabled={isProcessing}
              >
                Choose file
              </WPrimary>
              <WGhost onClick={handlePasteClick} disabled={isProcessing} icon={<Clipboard size={13} />}>
                Paste image
              </WGhost>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </div>
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
