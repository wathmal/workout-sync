import "./_silence";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { dispatchTool } from "../../lib/agents/tools";

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: "missing JSON args (pass as argv[2])" }) +
        "\n",
    );
    process.exit(0);
  }
  let args: unknown;
  try {
    args = JSON.parse(raw);
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: `invalid JSON in argv: ${err instanceof Error ? err.message : String(err)}`,
      }) + "\n",
    );
    process.exit(0);
  }

  const result = await dispatchTool("proposeWorkout", args);
  if (!result.ok || !("workout" in result)) {
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }

  const target =
    process.env.AGENT_RESULT_PATH ||
    join(tmpdir(), `agent-result-${process.env.AGENT_RUN_ID ?? "default"}.json`);

  const payload = JSON.stringify({
    ok: true,
    workout: result.workout,
    saved_at: new Date().toISOString(),
  });
  writeFileSync(target, payload);

  process.stdout.write(
    JSON.stringify({ ok: true, saved: target, count: result.workout.length }) +
      "\n",
  );
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) +
      "\n",
  );
  process.exit(1);
});
