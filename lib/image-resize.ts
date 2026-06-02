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
 * HEIC/HEIF detection, client-side. Non-Safari browsers can't decode HEIC in an
 * <img>, so when canvas decode fails we use this to decide whether to send the
 * raw file to the server (which transcodes via lib/food/photo-prep.ts) instead
 * of surfacing an error. Mirrors the server isHeic in lib/image-utils.ts.
 */
async function isHeicFile(file: File): Promise<boolean> {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  if (/\.(heic|heif)$/i.test(file.name)) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = (a: number, b: number) =>
      String.fromCharCode(...Array.from(head.subarray(a, b)));
    if (ascii(4, 8) === "ftyp") {
      const brand = ascii(8, 12).toLowerCase();
      return ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(brand);
    }
  } catch {
    // slice/arrayBuffer unavailable — fall through to false.
  }
  return false;
}

export interface PrepareOpts {
  /** Base64-length budget; result kept under this (string length, not bytes). */
  maxBase64Bytes?: number;
  /** Longest-edge pixel cap; larger images are downscaled to it. */
  maxDim?: number;
  /** JPEG quality steps, tried high→low until one fits the budget. */
  qualitySteps?: number[];
  /** When the smallest step still overshoots, send it anyway instead of throwing. */
  bestEffort?: boolean;
}

/**
 * Return a base64-encoded image suitable for /api/food/analyze/photo (and the
 * workout upload). Skips re-encode if the original is already under the byte
 * budget. Defaults preserve the original high-fidelity behavior; the food
 * "Meal photo" dropzone passes a smaller cap to cut FMA vision token cost.
 */
export async function prepareImageForUpload(
  file: File,
  opts?: PrepareOpts,
): Promise<PreparedImage> {
  const maxBytes = opts?.maxBase64Bytes ?? MAX_BASE64_BYTES;
  const maxDim = opts?.maxDim ?? MAX_DIM;
  const qualitySteps = opts?.qualitySteps ?? QUALITY_STEPS;
  const bestEffort = opts?.bestEffort ?? false;
  // EXIF date off the raw file first — resize below would strip it.
  const capturedAt = await extractCapturedAt(file);

  // Raw pass-through, also reused for the HEIC decode-fail fallback below.
  const rawResult = async (): Promise<PreparedImage> => ({
    base64: await fileToBase64(file),
    mimeType: file.type || "application/octet-stream",
    filename: file.name,
    byteLength: file.size,
    resized: false,
    capturedAt,
  });

  if (file.size * 1.34 < maxBytes) {
    return rawResult();
  }

  const dataUrl = await readAsDataUrl(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch (err) {
    // HEIC the browser can't decode in <img> (non-Safari) → send raw; the
    // server transcodes it. A genuinely corrupt non-HEIC image rethrows.
    if (await isHeicFile(file)) return rawResult();
    throw err;
  }

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const longest = Math.max(w, h);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  const baseName = file.name.replace(/\.[^.]+$/, "");
  let smallest: Blob | null = null;
  for (const q of qualitySteps) {
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", q),
    );
    if (!blob) continue;
    if (blob.size * 1.34 < maxBytes) {
      return {
        base64: await blobToBase64(blob),
        mimeType: "image/jpeg",
        filename: `${baseName}.jpg`,
        byteLength: blob.size,
        resized: true,
        capturedAt,
      };
    }
    if (!smallest || blob.size < smallest.size) smallest = blob;
  }

  // Soft target: when nothing fit, send the smallest re-encode rather than fail.
  if (bestEffort && smallest) {
    return {
      base64: await blobToBase64(smallest),
      mimeType: "image/jpeg",
      filename: `${baseName}.jpg`,
      byteLength: smallest.size,
      resized: true,
      capturedAt,
    };
  }

  throw new Error(
    "Image too large to compress. Pick a smaller photo or crop it first.",
  );
}
