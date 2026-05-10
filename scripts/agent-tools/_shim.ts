import "./_silence";
import { dispatchTool } from "../../lib/agents/tools";

export async function runShim(toolName: string): Promise<void> {
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
  const result = await dispatchTool(toolName, args);
  process.stdout.write(JSON.stringify(result) + "\n");
}
