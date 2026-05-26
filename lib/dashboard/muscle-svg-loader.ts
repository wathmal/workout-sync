import "server-only";
import fs from "node:fs";
import path from "node:path";

let cached: { front: string; back: string } | null = null;

export function loadMuscleSvgs(): { front: string; back: string } {
  if (cached) return cached;
  const dir = path.join(process.cwd(), "public", "muscle-svg");
  const front = fs.readFileSync(path.join(dir, "body-front.svg"), "utf8");
  const back = fs.readFileSync(path.join(dir, "body-back.svg"), "utf8");
  cached = { front, back };
  return cached;
}
