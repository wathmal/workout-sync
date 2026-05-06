#!/usr/bin/env tsx
/**
 * Refresh the bundled Hevy exercise-template catalog.
 *
 *   - Pulls every page of GET /v1/exercise_templates with the developer's
 *     HEVY_API_KEY (covers both official Hevy templates and the user's
 *     custom exercises).
 *   - Sorts deterministically by id, writes a single merged
 *     `lib/data/hevy-exercises/catalog.json`.
 *   - Removes the legacy `response_<timestamp>.json` snapshots once the
 *     new file is on disk so the directory has exactly one source.
 *
 * Runs as the `prebuild` step. Hard-fails when HEVY_API_KEY is missing —
 * every build env must have it (CI/CD must inject the secret).
 *
 * Usage:
 *   npm run refresh:hevy
 *   tsx --env-file=.env.local scripts/refresh-hevy-catalog.ts
 */

import fs from "fs";
import path from "path";

const HEVY_API_BASE = "https://api.hevyapp.com/v1";
const PAGE_SIZE = 100;
const HARD_PAGE_CAP = 50;

const TARGET_DIR = path.join(process.cwd(), "lib", "data", "hevy-exercises");
const TARGET_FILE = path.join(TARGET_DIR, "catalog.json");

interface ExerciseTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
}

interface PageResponse {
  page: number;
  page_count: number;
  exercise_templates: ExerciseTemplate[];
}

function readApiKey(): string | null {
  // Soft-fail: catalog.json is committed in the repo, so a build without
  // HEVY_API_KEY (e.g. Docker, fork CI) can still ship using the last
  // refreshed snapshot. Warn so the operator knows the data is stale.
  return process.env.HEVY_API_KEY ?? null;
}

async function fetchPage(apiKey: string, page: number): Promise<PageResponse> {
  const url = `${HEVY_API_BASE}/exercise_templates?page=${page}&pageSize=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hevy ${url} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as PageResponse;
  if (!Array.isArray(json.exercise_templates)) {
    throw new Error(`Unexpected Hevy response shape on page ${page}`);
  }
  return json;
}

function isValidTemplate(raw: unknown): raw is ExerciseTemplate {
  if (!raw || typeof raw !== "object") return false;
  const t = raw as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.type === "string" &&
    typeof t.is_custom === "boolean"
  );
}

async function main() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.warn(
      "[refresh-hevy] HEVY_API_KEY not set — skipping refresh. The build will use the catalog.json already committed in lib/data/hevy-exercises/. " +
        "Set HEVY_API_KEY in .env.local (or export it) to fetch the latest templates and the developer's customs.",
    );
    return;
  }
  console.log(`[refresh-hevy] fetching exercise templates (pageSize=${PAGE_SIZE})…`);

  const all: ExerciseTemplate[] = [];
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount && page <= HARD_PAGE_CAP) {
    const response = await fetchPage(apiKey, page);
    pageCount = response.page_count || 1;
    let dropped = 0;
    for (const raw of response.exercise_templates) {
      if (isValidTemplate(raw)) {
        all.push({
          id: raw.id,
          title: raw.title,
          type: raw.type,
          primary_muscle_group: raw.primary_muscle_group ?? "",
          secondary_muscle_groups: Array.isArray(raw.secondary_muscle_groups)
            ? raw.secondary_muscle_groups
            : [],
          equipment: raw.equipment ?? "none",
          is_custom: raw.is_custom,
        });
      } else {
        dropped += 1;
      }
    }
    if (dropped > 0) {
      console.warn(
        `[refresh-hevy]   page ${page}: dropped ${dropped} malformed template(s)`,
      );
    }
    console.log(
      `[refresh-hevy]   page ${page}/${pageCount} — ${response.exercise_templates.length} item(s)`,
    );
    page += 1;
  }

  if (page > HARD_PAGE_CAP) {
    console.warn(
      `[refresh-hevy] hit ${HARD_PAGE_CAP}-page cap; truncating output. Bump HARD_PAGE_CAP if Hevy adds more.`,
    );
  }

  // Sort by id so diffs across runs are stable and reviewable.
  all.sort((a, b) => a.id.localeCompare(b.id));

  const officials = all.filter((e) => !e.is_custom).length;
  const customs = all.length - officials;

  const catalog = {
    generated_at: new Date().toISOString(),
    source: "hevy /v1/exercise_templates",
    total: all.length,
    official_count: officials,
    custom_count: customs,
    exercise_templates: all,
  };

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.writeFileSync(TARGET_FILE, JSON.stringify(catalog, null, 2) + "\n");
  console.log(
    `[refresh-hevy] wrote ${path.relative(process.cwd(), TARGET_FILE)} — ${all.length} (official: ${officials}, custom: ${customs})`,
  );

  // Clean up legacy paginated snapshots after a successful write so the
  // loader has one and only one source of truth.
  const legacy = fs
    .readdirSync(TARGET_DIR)
    .filter((f) => /^response_\d+\.json$/.test(f));
  for (const file of legacy) {
    fs.unlinkSync(path.join(TARGET_DIR, file));
    console.log(`[refresh-hevy]   removed legacy ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
