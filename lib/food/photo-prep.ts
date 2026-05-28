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
): Promise<PreparedPhoto> {
  let buf: Buffer = Buffer.from(imageBase64, "base64");
  if (isHeic(mimeType, filename, buf)) {
    buf = (await convertHeicToJpeg(buf)) as Buffer;
  }
  const exifDate = await extractImageDateFromBuffer(buf).catch(() => null);
  return {
    base64: buf.toString("base64"),
    exifDateIso: exifDate ? exifDate.toISOString() : null,
  };
}
