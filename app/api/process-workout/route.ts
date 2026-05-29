import { NextRequest, NextResponse } from "next/server";
import { extractWorkout, VisionError } from "@/lib/vision";
import { AgentLoopError } from "@/lib/agents/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, mimeType, filename, capturedAt } = body as {
      image?: string;
      mimeType?: string;
      filename?: string;
      capturedAt?: string | null;
    };

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 },
      );
    }

    console.log("📊 Image size:", Math.round(image.length / 1024), "KB (base64)");

    const buffer = Buffer.from(image, "base64");
    const capturedDate = typeof capturedAt === "string" ? new Date(capturedAt) : undefined;
    const result = await extractWorkout(buffer, mimeType, filename, image, capturedDate);

    return NextResponse.json({
      success: true,
      exercises: result.exercises,
      raw_response: result.rawResponse,
      extractedDate: result.extractedDate?.toISOString() || null,
      workoutStartDate: result.workoutStartTime?.date.toISOString() || null,
      workoutStartTime: result.workoutStartTime?.timeString || null,
      convertedImageBase64: result.convertedImageBase64,
      modelName: result.modelName,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("❌ Error processing workout image:", error);
    return mapErrorToResponse(error);
  }
}

function mapErrorToResponse(error: unknown): NextResponse {
  if (error instanceof AgentLoopError) {
    const status = error.reason === "timeout" ? 504 : 422;
    return NextResponse.json(
      {
        error: "Agent extraction failed",
        details: error.message,
      },
      { status },
    );
  }

  if (error instanceof VisionError) {
    const status =
      error.kind === "config" ? 500 :
      error.kind === "format" ? 400 :
      error.kind === "rate_limit" ? 429 :
      422;
    return NextResponse.json(
      { error: error.message, kind: error.kind },
      { status },
    );
  }

  if (error instanceof Error) {
    if (error.message.includes("rate limit")) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again in a moment.",
          details: error.message,
        },
        { status: 429 },
      );
    }
    if (error.message.includes("invalid") || error.message.includes("parse")) {
      return NextResponse.json(
        {
          error: "Failed to process image. The image may not contain valid workout data.",
          details: error.message,
        },
        { status: 422 },
      );
    }
  }

  return NextResponse.json(
    {
      error: "Failed to process image",
      details: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  );
}
