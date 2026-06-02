import "server-only";
import {
  isHeic,
  convertHeicToJpegUnder,
  extractImageDateFromBuffer,
} from "@/lib/image-utils";

// FMA caps the base64 STRING length of the image at 5_242_880 chars (not the
// decoded bytes). Keep headroom so the encoded JPEG clears it.
const FMA_MAX_BASE64_LEN = 5_000_000;

export interface PreparedPhoto {
  base64: string;
  exifDateIso: string | null;
  /** True when HEIC was transcoded to JPEG server-side. */
  converted: boolean;
}

export async function preparePhoto(
  imageBase64: string,
  filename?: string,
  mimeType?: string,
  capturedAtIso?: string | null,
): Promise<PreparedPhoto> {
  let buf: Buffer = Buffer.from(imageBase64, "base64");
  let converted = false;
  if (isHeic(mimeType, filename, buf)) {
    buf = await convertHeicToJpegUnder(buf, FMA_MAX_BASE64_LEN);
    converted = true;
  }
  // Client-extracted date wins (survives a client resize that strips EXIF);
  // fall back to parsing the received buffer.
  const clientDate = capturedAtIso ? new Date(capturedAtIso) : null;
  const exifDate =
    clientDate && !Number.isNaN(clientDate.getTime())
      ? clientDate
      : await extractImageDateFromBuffer(buf).catch(() => null);
  return {
    base64: buf.toString("base64"),
    exifDateIso: exifDate ? exifDate.toISOString() : null,
    converted,
  };
}
