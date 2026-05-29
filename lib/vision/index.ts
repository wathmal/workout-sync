import "server-only";

import { WorkoutExercise } from "../types";
import { parseGroqResponse } from "../groq/helpers";
import { runAgent, getAgentHarnessProvider } from "../agents";
import { normalizeImage } from "./normalize";
import { callSingleShot, getSingleShotProvider } from "./single-shot";

export { VisionError } from "./errors";
export type { VisionErrorKind } from "./errors";

export interface ExtractionResult {
  exercises: WorkoutExercise[];
  rawResponse: string;
  modelName: string;
  /** 0-100 derived from mean match score across exercises. */
  confidence: number;
  extractedDate: Date | null;
  workoutStartTime: { date: Date; timeString: string } | null;
  /** Set only when the input image was HEIC. */
  convertedImageBase64: string | null;
}

/**
 * Extract workout data from a raw image buffer. Normalizes HEIC → JPEG,
 * pulls EXIF date, then dispatches to the configured provider (agent
 * harness if enabled, otherwise single-shot Groq or LM Studio).
 *
 * Throws VisionError (config / format / extraction / rate_limit) or
 * AgentLoopError. Callers map those to HTTP statuses.
 */
export async function extractWorkout(
  buffer: Buffer,
  mimeType: string | undefined,
  filename: string | undefined,
  originalBase64: string,
  capturedAt?: Date | null,
): Promise<ExtractionResult> {
  const normalized = await normalizeImage(
    buffer,
    mimeType,
    filename,
    originalBase64,
    capturedAt,
  );

  const agentProvider = getAgentHarnessProvider();
  if (agentProvider !== "off") {
    console.log(`🤖 Agent harness active: ${agentProvider}`);
    const agentResult = await runAgent(normalized.imageBase64, normalized.mimeType);
    return {
      exercises: agentResult.workout,
      rawResponse: agentResult.telemetrySummary,
      modelName: agentResult.modelLabel,
      confidence: confidenceFromScores(agentResult.workout),
      extractedDate: normalized.extractedDate,
      workoutStartTime: normalized.workoutStartTime,
      convertedImageBase64: normalized.convertedImageBase64,
    };
  }

  const provider = getSingleShotProvider();
  console.log(
    `🔄 Single-shot vision provider: ${provider}` +
      (provider === "lm-studio" ? ` (LM Studio)` : ""),
  );

  const { rawResponse, modelName } = await callSingleShot(
    provider,
    normalized.imageBase64,
    normalized.mimeType,
  );

  console.log(`✅ ${provider} response:`);
  console.log(rawResponse);
  console.log("---");

  const workoutExercises = await parseGroqResponse(rawResponse);

  console.log("📋 Parsed Exercises:");
  console.log(JSON.stringify(workoutExercises, null, 2));
  console.log("---");

  return {
    exercises: workoutExercises,
    rawResponse,
    modelName,
    confidence: confidenceFromScores(workoutExercises),
    extractedDate: normalized.extractedDate,
    workoutStartTime: normalized.workoutStartTime,
    convertedImageBase64: normalized.convertedImageBase64,
  };
}

function confidenceFromScores(exercises: WorkoutExercise[]): number {
  const scores = exercises
    .map((ex) => ex.matchScore ?? 0)
    .filter((s) => s > 0);
  const avg = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;
  return Math.round((avg / 150) * 100);
}
