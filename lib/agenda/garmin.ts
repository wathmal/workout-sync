import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import type { GarminActivity } from "./types";

/**
 * Garmin fetch via the Python `garminconnect` lib (cyberjunky) run as a subprocess
 * — see docs/agenda-integration.md for why Python + why a subprocess. The script
 * loads a cached token (no password) and prints clean JSON to stdout. We collect
 * stdout, parse once, and surface any failure with stderr context.
 */

const TIMEOUT_MS = 60_000;

interface RunResult {
  stdout: string;
  stderr: string;
}

function run(bin: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);

    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`failed to spawn ${bin}: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr.trim().slice(0, 500)}`));
    });
  });
}

/** Fetch Garmin activities for the inclusive date range [sinceYmd, untilYmd]. */
export async function fetchGarminWindow(
  sinceYmd: string,
  untilYmd: string,
): Promise<GarminActivity[]> {
  const python = process.env.GARMIN_PYTHON ?? "python3";
  const script = path.join(process.cwd(), "scripts", "garmin", "fetch.py");
  const { stdout } = await run(python, [script, `--since=${sinceYmd}`, `--until=${untilYmd}`]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`garmin fetch: non-JSON stdout: ${stdout.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) throw new Error("garmin fetch: expected an array");
  return (parsed as GarminActivity[]).filter((a) => a.garminId && a.startTime);
}
