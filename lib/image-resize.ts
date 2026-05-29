/**
 * Client-side image downscale. Decodes via HTMLImageElement + canvas, re-encodes
 * to JPEG. Caps max dimension and iterates quality so the resulting base64
 * stays under FMA's 5MB upstream cap.
 *
 * iOS Safari can decode HEIC in <img> natively, so canvas re-encode handles
 * iPhone uploads without needing a server-side resize lib.
 */
const MAX_BASE64_BYTES = 4_800_000; // upstream cap is 5_242_880; keep headroom
const MAX_DIM = 2048;
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];

export interface PreparedImage {
  base64: string;
  mimeType: string;
  filename: string;
  /** Bytes of the encoded image (not base64 length). */
  byteLength: number;
  /** True if downscaled/re-encoded; false if original was small enough. */
  resized: boolean;
  /**
   * EXIF capture date parsed client-side from the ORIGINAL file, before any
   * canvas re-encode strips it. null when absent/unreadable.
   */
  capturedAt: Date | null;
}

/**
 * Read the EXIF capture date off the original file, client-side, BEFORE resize.
 * Canvas re-encode drops EXIF, so this must run on the raw file. exifr is
 * lazy-imported so it stays out of the initial bundle (only loads on pick).
 */
async function extractCapturedAt(file: File): Promise<Date | null> {
  try {
    const { parse } = await import("exifr");
    const out = await parse(file, [
      "DateTimeOriginal",
      "CreateDate",
      "DateTimeDigitized",
    ]);
    const d: unknown =
      out?.DateTimeOriginal ?? out?.CreateDate ?? out?.DateTimeDigitized;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return readAsDataUrl(blob).then((url) => url.slice(url.indexOf(",") + 1));
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // btoa for binary string. Chunk to avoid arg-count overflow on big arrays.
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return btoa(bin);
}

/**
 * Return a base64-encoded image suitable for /api/food/analyze/photo.
 * Skips re-encode if original is already under the size budget.
 */
export async function prepareImageForUpload(
  file: File,
  opts?: { maxBase64Bytes?: number },
): Promise<PreparedImage> {
  const maxBytes = opts?.maxBase64Bytes ?? MAX_BASE64_BYTES;
  // EXIF date off the raw file first — resize below would strip it.
  const capturedAt = await extractCapturedAt(file);

  if (file.size * 1.34 < maxBytes) {
    const base64 = await fileToBase64(file);
    return {
      base64,
      mimeType: file.type || "application/octet-stream",
      filename: file.name,
      byteLength: file.size,
      resized: false,
      capturedAt,
    };
  }

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const longest = Math.max(w, h);
  if (longest > MAX_DIM) {
    const scale = MAX_DIM / longest;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  for (const q of QUALITY_STEPS) {
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", q),
    );
    if (!blob) continue;
    if (blob.size * 1.34 < maxBytes) {
      const base64 = await blobToBase64(blob);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      return {
        base64,
        mimeType: "image/jpeg",
        filename: `${baseName}.jpg`,
        byteLength: blob.size,
        resized: true,
        capturedAt,
      };
    }
  }

  throw new Error(
    "Image too large to compress. Pick a smaller photo or crop it first.",
  );
}
