import { runShim } from "./_shim";

runShim("getExerciseDetails").catch((err) => {
  process.stdout.write(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) +
      "\n",
  );
  process.exit(1);
});
