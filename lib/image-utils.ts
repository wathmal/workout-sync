import "server-only";

import exifr from 'exifr';
import convert from 'heic-convert';

const HEIC_MIMES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const HEIC_EXT = /\.(heic|heif)$/i;
const HEIC_BRANDS = ['heic', 'heix', 'mif1', 'msf1', 'heim', 'heis', 'hevc', 'hevx'];

/**
 * Detect HEIC/HEIF by mime, filename extension, or ISO BMFF brand at offset 4-12.
 * iOS Safari frequently reports an empty file.type for HEIC, so the extension
 * and magic-byte fallbacks are required, not optional.
 */
export function isHeic(mimeType?: string | null, filename?: string | null, buffer?: Buffer): boolean {
  if (mimeType && HEIC_MIMES.includes(mimeType.toLowerCase())) return true;
  if (filename && HEIC_EXT.test(filename)) return true;
  if (buffer && buffer.length >= 12) {
    const ftyp = buffer.slice(4, 8).toString('ascii');
    if (ftyp === 'ftyp') {
      const brand = buffer.slice(8, 12).toString('ascii').toLowerCase();
      if (HEIC_BRANDS.includes(brand)) return true;
    }
  }
  return false;
}

export async function convertHeicToJpeg(buffer: Buffer, quality = 0.9): Promise<Buffer> {
  const output = await convert({ buffer, format: 'JPEG', quality });
  return Buffer.from(output);
}

/** base64 string length for a buffer of `n` raw bytes (no newlines). */
export function base64Length(n: number): number {
  return Math.ceil(n / 3) * 4;
}

/**
 * Convert HEIC → JPEG, stepping quality down until the BASE64-ENCODED output
 * stays under `maxBase64Len` characters. FMA's cap is on the base64 string
 * length (`image.source.base64`), not the decoded image, so a ~4MB JPEG —
 * raw bytes well under "5MB" — still encodes to ~5.3M base64 chars and is
 * rejected. heic-convert has no resize knob, so quality is the only lever.
 * Returns the smallest result if even the lowest quality overshoots.
 */
export async function convertHeicToJpegUnder(
  buffer: Buffer,
  maxBase64Len: number,
  qualitySteps: number[] = [0.8, 0.6, 0.45, 0.3],
): Promise<Buffer> {
  let last: Buffer | null = null;
  for (const quality of qualitySteps) {
    const out = Buffer.from(await convert({ buffer, format: 'JPEG', quality }));
    if (base64Length(out.length) <= maxBase64Len) return out;
    last = out;
  }
  return last as Buffer;
}


/**
 * Extract date from image EXIF metadata (server-side)
 * Accepts a Buffer (from base64 string) and returns the date the photo was taken, or null if not available
 */
export async function extractImageDateFromBuffer(buffer: Buffer): Promise<Date | null> {
  try {
    // Broad parse — `pick` plus HEIC sometimes returns nothing because exifr
    // skips segments when the picked tags don't appear in the first parsed
    // block. Letting exifr walk the full TIFF/EXIF chain then reading the
    // fields manually is more reliable for HEIC.
    const exifData = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      translateValues: true,
      reviveValues: true,
      mergeOutput: true,
    });

    // Try DateTimeOriginal first (most accurate - when photo was taken)
    if (exifData?.DateTimeOriginal) {
      const date = new Date(exifData.DateTimeOriginal);
      if (!isNaN(date.getTime())) {
        console.log('Extracted date from EXIF DateTimeOriginal:', date);
        return date;
      }
    }

    // Fall back to CreateDate
    if (exifData?.CreateDate) {
      const date = new Date(exifData.CreateDate);
      if (!isNaN(date.getTime())) {
        console.log('Extracted date from EXIF CreateDate:', date);
        return date;
      }
    }

    // Last resort: ModifyDate
    if (exifData?.ModifyDate) {
      const date = new Date(exifData.ModifyDate);
      if (!isNaN(date.getTime())) {
        console.log('Extracted date from EXIF ModifyDate:', date);
        return date;
      }
    }

    console.log('No date found in image EXIF metadata');
    return parseExifWithReader(buffer);
  } catch (error) {
    // exifr v7's HEIC detector requires ftyp box length ≤50 AND `heic` in
    // compatibleBrands list (offset 16+). Many real iOS HEIC files have a
    // 0x34 (52)-byte ftyp with brands like {mif1, MiHB, MiHA, heix} — exifr
    // bails with "Unknown file format" even though the major brand IS heic.
    // Fall back to exifreader, which parses these correctly.
    const message = error instanceof Error ? error.message : String(error);
    if (/unknown file format/i.test(message)) {
      const fallback = await parseExifWithReader(buffer);
      if (fallback) return fallback;
    }
    console.warn('Error reading EXIF data:', error);
    return null;
  }
}

async function parseExifWithReader(buffer: Buffer): Promise<Date | null> {
  try {
    const ExifReader = (await import('exifreader')).default;
    const tags = ExifReader.load(buffer, { expanded: false });
    const fields = ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime', 'CreateDate'] as const;
    for (const f of fields) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tag = (tags as any)[f];
      if (!tag) continue;
      // EXIF dates: "YYYY:MM:DD HH:MM:SS" — Date constructor needs ISO format.
      const raw = String(tag.description ?? tag.value);
      const iso = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
      const date = new Date(iso);
      if (!isNaN(date.getTime())) {
        console.log(`Extracted date via exifreader (${f}):`, date);
        return date;
      }
    }
    return null;
  } catch (err) {
    console.warn('exifreader fallback failed:', err);
    return null;
  }
}

/**
 * Calculate workout start time: 45 minutes before image date, rounded to nearest half hour
 * Examples:
 * - Image at 6:20 PM → 45 mins before = 5:35 PM → rounds to 5:30 PM
 * - Image at 6:50 PM → 45 mins before = 6:05 PM → rounds to 6:00 PM
 * - Image at 7:15 AM → 45 mins before = 6:30 AM → rounds to 6:30 AM
 */
export function calculateWorkoutStartTime(imageDate: Date): { date: Date; timeString: string } {
  // Create a copy to avoid mutating the original
  const workoutDate = new Date(imageDate);
  
  // Subtract 45 minutes
  workoutDate.setMinutes(workoutDate.getMinutes() - 45);
  
  // Round to nearest half hour
  const minutes = workoutDate.getMinutes();
  let roundedMinutes: number;
  
  if (minutes < 15) {
    // Round down to 0
    roundedMinutes = 0;
  } else if (minutes >= 15 && minutes < 45) {
    // Round to 30
    roundedMinutes = 30;
  } else {
    // Round up to next hour (0 minutes, increment hour)
    roundedMinutes = 0;
    workoutDate.setHours(workoutDate.getHours() + 1);
  }
  
  workoutDate.setMinutes(roundedMinutes);
  workoutDate.setSeconds(0);
  workoutDate.setMilliseconds(0);
  
  // Format time as HH:MM string
  const hours = workoutDate.getHours().toString().padStart(2, '0');
  const mins = workoutDate.getMinutes().toString().padStart(2, '0');
  const timeString = `${hours}:${mins}`;
  
  console.log(`Calculated workout start time: ${timeString} (45 mins before image, rounded to nearest half hour)`);
  
  return {
    date: workoutDate,
    timeString,
  };
}

