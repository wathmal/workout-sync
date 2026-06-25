import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import type { FitnessSnapshot, RhrPoint, ActivityLoad } from "./types";

/**
 * Fitness-metric fetch via the same Python `garminconnect` subprocess as the agenda
 * (scripts/garmin/fetch.py, modes --metrics / --backfill-rhr). Token-only auth, clean
 * JSON on stdout. See docs/fitness-trends.md and lib/agenda/garmin.ts (the sibling).
 */

const TIMEOUT_MS = 90_000; // backfill loops get_stats per day → allow more headroom than activities

function run(bin: string, args: string[]): Promise<string> {
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
      if (code === 0) resolve(stdout);
      else reject(new Error(`${bin} exited ${code}: ${stderr.trim().slice(0, 500)}`));
    });
  });
}

function scriptPath(): string {
  return path.join(process.cwd(), "scripts", "garmin", "fetch.py");
}

/** One fitness snapshot for the given local day (YYYY-MM-DD). */
export async function fetchFitnessSnapshot(dateYmd: string): Promise<FitnessSnapshot> {
  const python = process.env.GARMIN_PYTHON ?? "python3";
  const stdout = await run(python, [scriptPath(), "--metrics", `--date=${dateYmd}`]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`fitness metrics: non-JSON stdout: ${stdout.slice(0, 200)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("fitness metrics: expected an object");
  }
  return parsed as FitnessSnapshot;
}

/** Resting-HR series for the last `days` days ending at `endYmd` (seeds the chart). */
export async function fetchRhrBackfill(days: number, endYmd: string): Promise<RhrPoint[]> {
  const python = process.env.GARMIN_PYTHON ?? "python3";
  const stdout = await run(python, [scriptPath(), `--backfill-rhr=${days}`, `--date=${endYmd}`]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`rhr backfill: non-JSON stdout: ${stdout.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) throw new Error("rhr backfill: expected an array");
  return (parsed as RhrPoint[]).filter((p) => p.date);
}

/** Activities in [sinceYmd, untilYmd] with avgHr — for TRIMP/hrTSS training load. */
export async function fetchActivityLoad(sinceYmd: string, untilYmd: string): Promise<ActivityLoad[]> {
  const python = process.env.GARMIN_PYTHON ?? "python3";
  const stdout = await run(python, [scriptPath(), `--since=${sinceYmd}`, `--until=${untilYmd}`]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`activity load: non-JSON stdout: ${stdout.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) throw new Error("activity load: expected an array");
  return (parsed as ActivityLoad[])
    .filter((a) => a.startTime)
    .map((a) => ({ startTime: a.startTime, durationS: a.durationS ?? null, avgHr: a.avgHr ?? null }));
}
