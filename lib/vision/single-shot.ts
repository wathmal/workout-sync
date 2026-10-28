import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import {
  WORKOUT_EXTRACTION_SYSTEM_PROMPT,
  WORKOUT_EXTRACTION_USER_PROMPT,
  LM_VISION_SYSTEM_PROMPT,
  LM_VISION_USER_PROMPT,
  WORKOUT_EXTRACTION_JSON_SCHEMA,
} from "../groq/prompts";
import { VisionError } from "./errors";
import { visionModelOpts, withModelRetry } from "../models/resolve";

export type SingleShotProvider = "groq" | "lm-studio" | "anthropic";

export function getSingleShotProvider(): SingleShotProvider {
  const raw = (process.env.VISION_PROVIDER || "groq").toLowerCase();
  return raw === "lm-studio" || raw === "anthropic" ? raw : "groq";
}

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const LM_STUDIO_VISION_MODEL =
  process.env.LM_STUDIO_VISION_MODEL || "qwen/qwen2.5-vl-7b";

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
  if (provider === "anthropic") {
    const { content, model } = await callAnthropicVision(imageBase64, mimeType);
    return { rawResponse: content, modelName: `${model} · Anthropic` };
  }
  const { content, model } = await callGroqVision(imageBase64, mimeType);
  return { rawResponse: content, modelName: `${model} · Groq` };
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

async function callGroqVision(
  imageBase64: string,
  mimeType: string,
): Promise<{ content: string; model: string }> {
  const groq = getGroqClient();
  return withModelRetry(visionModelOpts("groq"), async (model) => {
    const completion = await groq.chat.completions.create({
      model,
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
      // ponytail: Groq free tier caps qwen3.8 at 1000 output tokens/min and rejects
      // any request whose max exceeds it. Reasoning off keeps a full board ~950.
      // Big boards will truncate; Groq Dev tier lifts the cap.
      reasoning_effort: "none",
      max_completion_tokens: 1000,
      top_p: 1,
      stream: false,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new VisionError("extraction", "Empty response from Groq API");
    return { content, model };
  });
}

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new VisionError(
      "config",
      "ANTHROPIC_API_KEY environment variable is not set",
    );
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
}

async function callAnthropicVision(
  imageBase64: string,
  mimeType: string,
): Promise<{ content: string; model: string }> {
  const client = getAnthropicClient();
  try {
    return await withModelRetry(visionModelOpts("anthropic"), async (model) => {
      // Claude 5.5: no temperature / prefill; adaptive thinking is on by default,
      // effort "low" is the cost knob. max_tokens includes thinking tokens.
      const res = await client.messages.create({
        model,
        max_tokens: 8192,
        system: WORKOUT_EXTRACTION_SYSTEM_PROMPT,
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: WORKOUT_EXTRACTION_JSON_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as Anthropic.Base64ImageSource["media_type"],
                  data: imageBase64,
                },
              },
              { type: "text", text: WORKOUT_EXTRACTION_USER_PROMPT },
            ],
          },
        ],
      });
      if (res.stop_reason === "refusal") {
        throw new VisionError(
          "extraction",
          `Anthropic refused: ${res.stop_details?.explanation ?? res.stop_details?.category ?? "no reason given"}`,
        );
      }
      if (res.stop_reason === "max_tokens") {
        throw new VisionError("extraction", "Anthropic response truncated (max_tokens)");
      }
      const content = res.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("");
      if (!content) throw new VisionError("extraction", "Empty response from Anthropic API");
      return { content, model };
    });
  } catch (err) {
    if (err instanceof VisionError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new VisionError("config", `Anthropic auth failed: ${err.message}`, err);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new VisionError("rate_limit", `Anthropic rate limited: ${err.message}`, err);
    }
    if (err instanceof Anthropic.APIError) {
      throw new VisionError("extraction", `Anthropic ${err.status}: ${err.message}`, err);
    }
    throw err;
  }
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
