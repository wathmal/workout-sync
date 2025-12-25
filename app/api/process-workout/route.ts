import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { parseGroqResponse } from "@/lib/groq-helpers";
import {
  WORKOUT_EXTRACTION_SYSTEM_PROMPT,
  WORKOUT_EXTRACTION_USER_PROMPT,
} from "@/lib/prompts";
import { extractImageDateFromBuffer, calculateWorkoutStartTime } from "@/lib/image-utils";

// Initialize Groq client lazily
function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { image, mimeType } = body;

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "API configuration error. Please contact support." },
        { status: 500 }
      );
    }

    console.log("🔄 Processing workout image with Groq Vision API...");
    console.log("📊 Image size:", Math.round(image.length / 1024), "KB (base64)");

    // Extract date from EXIF metadata
    let extractedDate: Date | null = null;
    let workoutStartTime: { date: Date; timeString: string } | null = null;
    try {
      const imageBuffer = Buffer.from(image, 'base64');
      extractedDate = await extractImageDateFromBuffer(imageBuffer);
      if (extractedDate) {
        workoutStartTime = calculateWorkoutStartTime(extractedDate);
        console.log("📅 Extracted workout date/time from image EXIF:", workoutStartTime);
      }
    } catch (error) {
      console.warn("⚠️ Could not extract date from image EXIF:", error);
    }

    // Get Groq client
    const groq = getGroqClient();

    // Call Groq Vision API
    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "system",
          content: WORKOUT_EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: WORKOUT_EXTRACTION_USER_PROMPT,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType || "image/jpeg"};base64,${image}`,
              },
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

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("Empty response from Groq API");
    }

    console.log("✅ Groq API Response:");
    console.log(responseContent);
    console.log("---");

    // Parse the response
    const workoutExercises = parseGroqResponse(responseContent);

    console.log("📋 Parsed Exercises:");
    console.log(JSON.stringify(workoutExercises, null, 2));
    console.log("---");

    // Return the parsed workout data along with extracted date/time
    return NextResponse.json({
      success: true,
      exercises: workoutExercises,
      raw_response: responseContent,
      extractedDate: extractedDate?.toISOString() || null,
      workoutStartDate: workoutStartTime?.date.toISOString() || null,
      workoutStartTime: workoutStartTime?.timeString || null,
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

