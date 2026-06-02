"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  prepareImageForUpload,
  type PreparedImage,
  type PrepareOpts,
} from "@/lib/image-resize";
import { ACCEPT_ATTR, validateImageFile } from "@/lib/upload-utils";

type PrepareFn = (file: File, opts?: PrepareOpts) => Promise<PreparedImage>;

interface PhotoDropzoneProps {
  icon: ReactNode;
  label: string;
  busyLabel: string;
  /** Caller's async work (the API call) is in flight. */
  busy?: boolean;
  accept?: string;
  /** Resize/encode budget passed to the prepare fn (per use-case). */
  prepareOpts?: PrepareOpts;
  /** Taller drop target. */
  minHeight?: number;
  /** Passive window paste (Cmd/Ctrl+V). Disable on extra instances. */
  enablePaste?: boolean;
  /** Injectable for tests; defaults to the real client resize+EXIF prep. */
  prepare?: PrepareFn;
  onPrepared: (img: PreparedImage) => void;
  onError: (msg: string) => void;
}

/**
 * Dashed, striped photo drop target. Drag, click, or paste (Cmd/Ctrl+V).
 * Validates + prepares (client resize + EXIF) before handing back a
 * PreparedImage; the page owns the resulting API call and any preview.
 */
export function PhotoDropzone({
  icon,
  label,
  busyLabel,
  busy = false,
  accept = ACCEPT_ATTR,
  prepareOpts,
  minHeight,
  enablePaste = true,
  prepare = prepareImageForUpload,
  onPrepared,
  onError,
}: PhotoDropzoneProps) {
  const [preparing, setPreparing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const showBusy = busy || preparing;
  const busyRef = useRef(showBusy);
  busyRef.current = showBusy;

  const handleFile = async (file: File) => {
    if (busyRef.current) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      onError(validation.error ?? "Invalid file.");
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepare(file, prepareOpts);
      onPrepared(prepared);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not read image.");
    } finally {
      setPreparing(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ""; // allow re-picking the same file
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
    if (file) void handleFile(file);
  };

  // Passive paste — Cmd/Ctrl+V anywhere on the page.
  useEffect(() => {
    if (!enablePaste) return;
    const onPaste = (e: ClipboardEvent) => {
      if (busyRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void handleFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enablePaste]);

  return (
    <label
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-lg)",
        minHeight,
        border: `1px dashed ${
          dragActive ? "var(--color-primary)" : "var(--color-outline)"
        }`,
        borderRadius: "var(--radius-md)",
        background:
          "repeating-linear-gradient(45deg, var(--color-card) 0 18px, var(--color-low) 18px 36px)",
        cursor: showBusy ? "default" : "pointer",
        color: "var(--color-text-tertiary)",
        fontSize: 13,
        gap: 8,
        transition: "border-color 0.15s ease",
      }}
    >
      {showBusy ? <Loader2 size={14} className="spin" /> : icon}
      {showBusy ? busyLabel : label}
      <input
        type="file"
        accept={accept}
        onChange={onInputChange}
        style={{ display: "none" }}
      />
    </label>
  );
}
