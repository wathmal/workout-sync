import { readFileSync } from "fs";
import { runAgent, getAgentHarnessProvider } from "../lib/agents";
import { isHeic, convertHeicToJpeg } from "../lib/image-utils";

function parseArgs(): { fixture: string; provider?: string } {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error(
      "usage: tsx scripts/agent-extract.ts <fixture-path> [provider]\n" +
        "  provider: groq | lm-studio | claude-cli (overrides AGENT_HARNESS_PROVIDER)",
    );
    process.exit(2);
  }
  return { fixture: args[0], provider: args[1] };
}

async function main() {
  const { fixture, provider } = parseArgs();
  if (provider) {
    process.env.AGENT_HARNESS_PROVIDER = provider;
  }
  const which = getAgentHarnessProvider();
  if (which === "off") {
    console.error(
      'AGENT_HARNESS_PROVIDER is "off". Set it via env or pass a provider arg: groq | lm-studio | claude-cli',
    );
    process.exit(2);
  }
  console.log(`▶ provider: ${which}`);
  console.log(`▶ fixture:  ${fixture}`);

  let buffer: Buffer = Buffer.from(readFileSync(fixture));
  let mimeType =
    fixture.toLowerCase().endsWith(".heic") || fixture.toLowerCase().endsWith(".heif")
      ? "image/heic"
      : fixture.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";

  if (isHeic(mimeType, fixture, buffer)) {
    console.log("▶ converting HEIC → JPEG…");
    buffer = await convertHeicToJpeg(buffer);
    mimeType = "image/jpeg";
  }
  const base64 = buffer.toString("base64");

  const start = Date.now();
  try {
    const result = await runAgent(base64, mimeType);
    const ms = Date.now() - start;
    console.log("\n=== TELEMETRY ===");
    console.log(result.telemetrySummary);
    console.log("\n=== WORKOUT ===");
    console.log(`exercises: ${result.workout.length}`);
    for (const ex of result.workout) {
      console.log(
        `  • ${ex.exercise.title} [${ex.exercise.type}] sets=${ex.sets.length} raw="${ex.rawDetection}"${
          ex.notes ? ` notes="${ex.notes}"` : ""
        }`,
      );
    }
    console.log("\n=== JSON ===");
    console.log(JSON.stringify(result.workout, null, 2));
    console.log(`\n✓ done in ${ms}ms · model: ${result.modelLabel}`);
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`\n✗ failed after ${ms}ms`);
    console.error(err);
    process.exit(1);
  }
}

main();
