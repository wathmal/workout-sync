import exifr from 'exifr';

/**
 * Extract date from image EXIF metadata (server-side)
 * Accepts a Buffer (from base64 string) and returns the date the photo was taken, or null if not available
 */
export async function extractImageDateFromBuffer(buffer: Buffer): Promise<Date | null> {
  try {
    const exifData = await exifr.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    });

    // Try DateTimeOriginal first (most accurate - when photo was taken)
    if (exifData?.DateTimeOriginal) {
      const date = new Date(exifData.DateTimeOriginal);
      if (!isNaN(date.getTime())) {
        console.log('📅 Extracted date from EXIF DateTimeOriginal:', date);
        return date;
      }
    }

    // Fall back to CreateDate
    if (exifData?.CreateDate) {
      const date = new Date(exifData.CreateDate);
      if (!isNaN(date.getTime())) {
        console.log('📅 Extracted date from EXIF CreateDate:', date);
        return date;
      }
    }

    // Last resort: ModifyDate
    if (exifData?.ModifyDate) {
      const date = new Date(exifData.ModifyDate);
      if (!isNaN(date.getTime())) {
        console.log('📅 Extracted date from EXIF ModifyDate:', date);
        return date;
      }
    }

    console.log('⚠️ No date found in image EXIF metadata');
    return null;
  } catch (error) {
    console.warn('⚠️ Error reading EXIF data:', error);
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
  
  console.log(`📅 Calculated workout start time: ${timeString} (45 mins before image, rounded to nearest half hour)`);
  
  return {
    date: workoutDate,
    timeString,
  };
}

