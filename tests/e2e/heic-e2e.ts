#!/usr/bin/env tsx
/**
 * HEIC pipeline e2e:
 *   1. Load tests/fixtures/workout-revl-2.heic
 *   2. Detect via isHeic (mime+ext+magic-byte path)
 *   3. Convert to JPEG via convertHeicToJpeg
 *   4. Run EXIF extraction on the original HEIC buffer
 *   5. POST converted JPEG to Groq vision, confirm response parses
 *
 * Usage:
 *   npx tsx --env-file=.env.local tests/e2e/heic-e2e.ts
 *
 * Requires:
 *   - GROQ_API_KEY in .env.local
 */

import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import {
  WORKOUT_EXTRACTION_SYSTEM_PROMPT,
  WORKOUT_EXTRACTION_USER_PROMPT,
} from "../../lib/groq/prompts";
import {
  isHeic,
  convertHeicToJpeg,
  extractImageDateFromBuffer,
} from "../../lib/image-utils";

const IMAGE_PATH = path.join(process.cwd(), "tests", "fixtures", "workout-revl-2.heic");

async function callGroqVision(jpegBase64: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set (use --env-file=.env.local)");
  const groq = new Groq({ apiKey });

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
            image_url: { url: `data:image/jpeg;base64,${jpegBase64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_completion_tokens: 2048,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty Groq response");
  return text;
}

async function main() {
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error(`fixture not found: ${IMAGE_PATH}`);
    process.exit(1);
  }

  const heicBuf = fs.readFileSync(IMAGE_PATH);
  console.log(`fixture: ${path.basename(IMAGE_PATH)} (${(heicBuf.length / 1024).toFixed(1)} KB)`);

  console.log("\n[1] detection");
  const detectedByMime = isHeic("image/heic");
  const detectedByExt = isHeic("", path.basename(IMAGE_PATH));
  const detectedByBytes = isHeic("", "", heicBuf);
  console.log(`    mime=${detectedByMime}  ext=${detectedByExt}  magic=${detectedByBytes}`);
  if (!detectedByBytes) {
    console.error("magic-byte detection failed on real HEIC fixture");
    process.exit(1);
  }

  console.log("\n[2] EXIF on original HEIC buffer");
  const exifDate = await extractImageDateFromBuffer(heicBuf);
  console.log(`    DateTimeOriginal=${exifDate?.toISOString() ?? "null"}`);

  console.log("\n[3] HEIC → JPEG");
  const tConv = Date.now();
  const jpegBuf = await convertHeicToJpeg(heicBuf);
  console.log(`    ${Date.now() - tConv}ms  ${(heicBuf.length / 1024).toFixed(1)}KB → ${(jpegBuf.length / 1024).toFixed(1)}KB`);
  if (jpegBuf.slice(0, 3).toString("hex") !== "ffd8ff") {
    console.error("converted buffer is not a JPEG (missing SOI marker)");
    process.exit(1);
  }

  console.log("\n[4] Groq vision call on converted JPEG");
  const jpegBase64 = jpegBuf.toString("base64");
  const tGroq = Date.now();
  const responseText = await callGroqVision(jpegBase64);
  console.log(`    ${Date.now() - tGroq}ms`);

  let parsed: { exercises?: unknown[] };
  try {
    parsed = JSON.parse(responseText);
  } catch {
    console.error("Groq response is not valid JSON:");
    console.error(responseText.slice(0, 500));
    process.exit(1);
  }
  const count = Array.isArray(parsed.exercises) ? parsed.exercises.length : 0;
  console.log(`    detected ${count} exercise(s)`);

  console.log("\nHEIC pipeline OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
