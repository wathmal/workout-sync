import "server-only";

import Groq from "groq-sdk";
import {
  WORKOUT_EXTRACTION_SYSTEM_PROMPT,
  WORKOUT_EXTRACTION_USER_PROMPT,
  LM_VISION_SYSTEM_PROMPT,
  LM_VISION_USER_PROMPT,
  WORKOUT_EXTRACTION_JSON_SCHEMA,
} from "../groq/prompts";
import { VisionError } from "./errors";

export type SingleShotProvider = "groq" | "lm-studio";

export function getSingleShotProvider(): SingleShotProvider {
  const raw = (process.env.VISION_PROVIDER || "groq").toLowerCase();
  return raw === "lm-studio" ? "lm-studio" : "groq";
}

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const LM_STUDIO_VISION_MODEL =
  process.env.LM_STUDIO_VISION_MODEL || "qwen/qwen2.5-vl-7b";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export interface SingleShotResult {
  rawResponse: string;
  modelName: string;
}

export async function callSingleShot(
  provider: SingleShotProvider,
  imageBase64: string,
  mimeType: string,
): Promise<SingleShotResult> {
  if (provider === "lm-studio") {
    const rawResponse = await callLMStudioVision(imageBase64, mimeType);
    return { rawResponse, modelName: `${LM_STUDIO_VISION_MODEL} · LM Studio` };
  }
  const rawResponse = await callGroqVision(imageBase64, mimeType);
  return { rawResponse, modelName: "Llama 4 Scout · Groq" };
}

function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new VisionError(
      "config",
      "GROQ_API_KEY environment variable is not set",
    );
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function callGroqVision(imageBase64: string, mimeType: string): Promise<string> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_VISION_MODEL,
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
  if (!content) throw new VisionError("extraction", "Empty response from Groq API");
  return content;
}

async function callLMStudioVision(imageBase64: string, mimeType: string): Promise<string> {
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
    throw new VisionError(
      "extraction",
      `LM Studio HTTP ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = json.choices[0]?.message?.content;
  if (!content) throw new VisionError("extraction", "Empty response from LM Studio");
  return content;
}
