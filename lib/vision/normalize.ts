import "server-only";

import {
  convertHeicToJpegUnder,
  extractImageDateFromBuffer,
  calculateWorkoutStartTime,
  isHeic,
} from "../image-utils";
import { VisionError } from "./errors";

// Groq rejects vision requests whose base64 image exceeds ~4MB. A full-res
// 12MP HEIC transcodes to a 5-6MB JPEG at q0.9, so bound the conversion under
// the cap (with headroom). Tightest of the providers normalize() feeds, so
// safe for LM Studio / agent paths too.
const GROQ_MAX_BASE64_LEN = 3_900_000;

export interface NormalizedImage {
  imageBase64: string;
  mimeType: string;
  /** Set only when input was HEIC. Client uses it to render the preview. */
  convertedImageBase64: string | null;
  extractedDate: Date | null;
  workoutStartTime: { date: Date; timeString: string } | null;
}

/**
 * Extract EXIF date from the original buffer (exifr supports HEIC) and
 * transcode HEIC → JPEG if needed so downstream providers see a format
 * they all accept.
 */
export async function normalizeImage(
  buffer: Buffer,
  mimeType: string | undefined,
  filename: string | undefined,
  originalBase64: string,
  capturedAt?: Date | null,
): Promise<NormalizedImage> {
  let extractedDate: Date | null = null;
  let workoutStartTime: { date: Date; timeString: string } | null = null;
  try {
    // Client-extracted date wins (survives a client resize that strips EXIF);
    // fall back to parsing the received buffer.
    extractedDate =
      capturedAt && !Number.isNaN(capturedAt.getTime())
        ? capturedAt
        : await extractImageDateFromBuffer(buffer);
    if (extractedDate) {
      workoutStartTime = calculateWorkoutStartTime(extractedDate);
      console.log("Extracted workout date/time from image EXIF:", workoutStartTime);
    }
  } catch (error) {
    console.warn("Could not extract date from image EXIF:", error);
  }

  if (!isHeic(mimeType, filename, buffer)) {
    return {
      imageBase64: originalBase64,
      mimeType: mimeType || "image/jpeg",
      convertedImageBase64: null,
      extractedDate,
      workoutStartTime,
    };
  }

  try {
    console.log("Converting HEIC → JPEG...");
    const jpegBuffer = await convertHeicToJpegUnder(buffer, GROQ_MAX_BASE64_LEN);
    const jpegBase64 = jpegBuffer.toString("base64");
    console.log(
      `HEIC converted: ${Math.round(buffer.length / 1024)}KB → ${Math.round(jpegBuffer.length / 1024)}KB`,
    );
    return {
      imageBase64: jpegBase64,
      mimeType: "image/jpeg",
      convertedImageBase64: jpegBase64,
      extractedDate,
      workoutStartTime,
    };
  } catch (error) {
    throw new VisionError(
      "format",
      "Failed to convert HEIC image. Please upload a JPEG or PNG.",
      error,
    );
  }
}
