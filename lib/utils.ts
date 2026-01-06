import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert seconds to MM:SS format
 */
export function secondsToMMSS(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Convert MM:SS format to seconds
 */
export function mmssToSeconds(mmss: string): number {
  if (!mmss || mmss.trim() === "") return 0;
  
  // Handle formats like "1:30", "2:00", "0:45"
  const parts = mmss.split(":");
  if (parts.length === 2) {
    const mins = parseInt(parts[0] || "0", 10);
    const secs = parseInt(parts[1] || "0", 10);
    if (isNaN(mins) || isNaN(secs)) return 0;
    return mins * 60 + secs;
  }
  
  // If no colon, treat as seconds
  const seconds = parseInt(mmss, 10);
  return isNaN(seconds) ? 0 : seconds;
}
