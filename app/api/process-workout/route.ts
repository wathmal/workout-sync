import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { parseGroqResponse } from "@/lib/groq/helpers";
import {
  WORKOUT_EXTRACTION_SYSTEM_PROMPT,
  WORKOUT_EXTRACTION_USER_PROMPT,
  LM_VISION_SYSTEM_PROMPT,
  LM_VISION_USER_PROMPT,
  WORKOUT_EXTRACTION_JSON_SCHEMA,
} from "@/lib/groq/prompts";
import {
  extractImageDateFromBuffer,
  calculateWorkoutStartTime,
  isHeic,
  convertHeicToJpeg,
} from "@/lib/image-utils";
import { runAgent, getAgentHarnessProvider } from "@/lib/agents";
import { AgentLoopError } from "@/lib/agents/types";

type VisionProvider = "groq" | "lm-studio";

const VISION_PROVIDER: VisionProvider =
  (process.env.VISION_PROVIDER as VisionProvider) || "groq";
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const LM_STUDIO_VISION_MODEL =
  process.env.LM_STUDIO_VISION_MODEL || "qwen/qwen2.5-vl-7b";

// Initialize Groq client lazily
function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

async function callGroqVision(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      { role: "system", content: WORKOUT_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: WORKOUT_EXTRACTION_USER_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_completion_tokens: 2048,
    top_p: 1,
    stream: false,
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from Groq API");
  return content;
}

async function callLMStudioVision(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const res = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LM_STUDIO_VISION_MODEL,
      messages: [
        { role: "system", content: LM_VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: LM_VISION_USER_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "workout_extraction",
          strict: true,
          schema: WORKOUT_EXTRACTION_JSON_SCHEMA,
        },
      },
      temperature: 0.1,
      max_tokens: 4096,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `LM Studio HTTP ${res.status}: ${text.slice(0, 300)}`
    );
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = json.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from LM Studio");
  return content;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { image, mimeType, filename } = body as {
      image?: string;
      mimeType?: string;
      filename?: string;
    };

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    if (VISION_PROVIDER === "groq" && !process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "API configuration error. Please contact support." },
        { status: 500 }
      );
    }

    console.log(
      `🔄 Processing workout image with vision provider: ${VISION_PROVIDER}` +
        (VISION_PROVIDER === "lm-studio"
          ? ` (${LM_STUDIO_VISION_MODEL} @ ${LM_STUDIO_URL})`
          : "")
    );
    console.log("📊 Image size:", Math.round(image.length / 1024), "KB (base64)");

    const originalBuffer = Buffer.from(image, 'base64');

    // Extract date from EXIF on the original buffer (exifr supports HEIC).
    let extractedDate: Date | null = null;
    let workoutStartTime: { date: Date; timeString: string } | null = null;
    try {
      extractedDate = await extractImageDateFromBuffer(originalBuffer);
      if (extractedDate) {
        workoutStartTime = calculateWorkoutStartTime(extractedDate);
        console.log("📅 Extracted workout date/time from image EXIF:", workoutStartTime);
      }
    } catch (error) {
      console.warn("⚠️ Could not extract date from image EXIF:", error);
    }

    // HEIC → JPEG conversion if needed. Groq vision officially lists JPEG/PNG/WEBP.
    let groqImageBase64 = image;
    let groqMimeType = mimeType || "image/jpeg";
    let convertedImageBase64: string | null = null;
    if (isHeic(mimeType, filename, originalBuffer)) {
      try {
        console.log("🔁 Converting HEIC → JPEG...");
        const jpegBuffer = await convertHeicToJpeg(originalBuffer);
        groqImageBase64 = jpegBuffer.toString('base64');
        groqMimeType = "image/jpeg";
        convertedImageBase64 = groqImageBase64;
        console.log(
          `✅ HEIC converted: ${Math.round(originalBuffer.length / 1024)}KB → ${Math.round(jpegBuffer.length / 1024)}KB`
        );
      } catch (error) {
        console.error("❌ HEIC conversion failed:", error);
        return NextResponse.json(
          {
            error: "Failed to convert HEIC image. Please upload a JPEG or PNG.",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 400 }
        );
      }
    }

    // Agent harness path: bypasses single-shot extraction entirely.
    const agentProvider = getAgentHarnessProvider();
    if (agentProvider !== "off") {
      console.log(`🤖 Agent harness active: ${agentProvider}`);
      try {
        const agentResult = await runAgent(groqImageBase64, groqMimeType);
        const scores = agentResult.workout
          .map((ex) => ex.matchScore ?? 0)
          .filter((s) => s > 0);
        const avgScore = scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;
        return NextResponse.json({
          success: true,
          exercises: agentResult.workout,
          raw_response: agentResult.telemetrySummary,
          extractedDate: extractedDate?.toISOString() || null,
          workoutStartDate: workoutStartTime?.date.toISOString() || null,
          workoutStartTime: workoutStartTime?.timeString || null,
          convertedImageBase64,
          modelName: agentResult.modelLabel,
          confidence: Math.round((avgScore / 150) * 100),
        });
      } catch (err) {
        const isAgentErr = err instanceof AgentLoopError;
        const status = isAgentErr && err.reason === "timeout" ? 504 : isAgentErr ? 422 : 500;
        const details = err instanceof Error ? err.message : "Unknown error";
        console.error("❌ Agent harness failed:", err);
        return NextResponse.json(
          {
            error: "Agent extraction failed",
            details,
            agentProvider,
          },
          { status },
        );
      }
    }

    const responseContent =
      VISION_PROVIDER === "lm-studio"
        ? await callLMStudioVision(groqImageBase64, groqMimeType)
        : await callGroqVision(groqImageBase64, groqMimeType);

    console.log(`✅ ${VISION_PROVIDER} response:`);
    console.log(responseContent);
    console.log("---");

    // Parse the response
    const workoutExercises = await parseGroqResponse(responseContent);

    console.log("📋 Parsed Exercises:");
    console.log(JSON.stringify(workoutExercises, null, 2));
    console.log("---");

    // Compute average match score → confidence percentage (0-100).
    const scores = workoutExercises
      .map((ex) => ex.matchScore ?? 0)
      .filter((s) => s > 0);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    const confidence = Math.round((avgScore / 150) * 100);

    // Return the parsed workout data along with extracted date/time.
    // convertedImageBase64 is set only when input was HEIC — client uses it for preview.
    return NextResponse.json({
      success: true,
      exercises: workoutExercises,
      raw_response: responseContent,
      extractedDate: extractedDate?.toISOString() || null,
      workoutStartDate: workoutStartTime?.date.toISOString() || null,
      workoutStartTime: workoutStartTime?.timeString || null,
      convertedImageBase64,
      modelName:
        VISION_PROVIDER === "lm-studio"
          ? `${LM_STUDIO_VISION_MODEL} · LM Studio`
          : "Llama 4 Scout · Groq",
      confidence,
    });
  } catch (error) {
    console.error("❌ Error processing workout image:", error);

    // Determine error type and return appropriate response
    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. Please try again in a moment.",
            details: error.message,
          },
          { status: 429 }
        );
      }

      if (error.message.includes("invalid") || error.message.includes("parse")) {
        return NextResponse.json(
          {
            error: "Failed to process image. The image may not contain valid workout data.",
            details: error.message,
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to process image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

