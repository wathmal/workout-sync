import { WorkoutExercise, WorkoutSet } from "./types";
import { matchExerciseWithFuzzy } from "./hevy-exercises";

/**
 * Convert a File object to base64 string
 */
export async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = base64String.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Parse the Groq API response and convert to WorkoutExercise array
 * Now uses Hevy exercise database with fuzzy matching
 */
export function parseGroqResponse(responseText: string): WorkoutExercise[] {
  try {
    const parsed = JSON.parse(responseText);
    
    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error("Invalid response format: missing exercises array");
    }
    
    console.log(`📋 Parsing ${parsed.exercises.length} exercise(s) from Groq response...`);
    
    const workoutExercises: WorkoutExercise[] = parsed.exercises.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ex: any, index: number) => {
        const detectedName = ex.name || ex.exercise_name || "Unknown Exercise";
        console.log(`\n[Exercise ${index + 1}/${parsed.exercises.length}]`);
        
        // Use Hevy database fuzzy matching
        const exercise = matchExerciseWithFuzzy(detectedName);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sets: WorkoutSet[] = (ex.sets || []).map((set: any, setIndex: number) => ({
          set_number: set.set_number || setIndex + 1,
          kg: parseFloat(set.kg || set.weight || "0"),
          reps: parseInt(set.reps || set.repetitions || "0", 10),
          previous_kg: parseFloat(set.kg || set.weight || "0"),
          previous_reps: parseInt(set.reps || set.repetitions || "0", 10),
          completed: false,
        }));
        
        console.log(`   Sets: ${sets.length}`);
        
        return {
          exercise,
          sets,
          notes: ex.notes || "",
          rest_timer_enabled: false,
        };
      }
    );
    
    console.log(`\n✅ Successfully parsed ${workoutExercises.length} exercise(s)`);
    
    return workoutExercises;
  } catch (error) {
    console.error("❌ Error parsing Groq response:", error);
    throw new Error(`Failed to parse workout data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Validate image file before processing
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 20 * 1024 * 1024; // 20MB
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a JPEG, PNG, or WebP image.",
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File size exceeds 20MB limit. Please upload a smaller image.",
    };
  }
  
  return { valid: true };
}

