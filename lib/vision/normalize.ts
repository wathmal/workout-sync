import "server-only";

import {
  convertHeicToJpeg,
  extractImageDateFromBuffer,
  calculateWorkoutStartTime,
  isHeic,
} from "../image-utils";
import { VisionError } from "./errors";

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
): Promise<NormalizedImage> {
  let extractedDate: Date | null = null;
  let workoutStartTime: { date: Date; timeString: string } | null = null;
  try {
    extractedDate = await extractImageDateFromBuffer(buffer);
    if (extractedDate) {
      workoutStartTime = calculateWorkoutStartTime(extractedDate);
      console.log("📅 Extracted workout date/time from image EXIF:", workoutStartTime);
    }
  } catch (error) {
    console.warn("⚠️ Could not extract date from image EXIF:", error);
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
    console.log("🔁 Converting HEIC → JPEG...");
    const jpegBuffer = await convertHeicToJpeg(buffer);
    const jpegBase64 = jpegBuffer.toString("base64");
    console.log(
      `✅ HEIC converted: ${Math.round(buffer.length / 1024)}KB → ${Math.round(jpegBuffer.length / 1024)}KB`,
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
