import "server-only";
import {
  isHeic,
  convertHeicToJpeg,
  extractImageDateFromBuffer,
} from "@/lib/image-utils";

export interface PreparedPhoto {
  base64: string;
  exifDateIso: string | null;
}

export async function preparePhoto(
  imageBase64: string,
  filename?: string,
  mimeType?: string,
  capturedAtIso?: string | null,
): Promise<PreparedPhoto> {
  let buf: Buffer = Buffer.from(imageBase64, "base64");
  if (isHeic(mimeType, filename, buf)) {
    buf = (await convertHeicToJpeg(buf)) as Buffer;
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
  };
}
