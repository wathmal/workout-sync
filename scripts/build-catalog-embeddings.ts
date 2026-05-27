#!/usr/bin/env tsx
/**
 * Build pre-computed embedding catalogs for the Hevy exercise database.
 *
 * Usage:
 *   tsx scripts/build-catalog-embeddings.ts                  # auto: try lm-studio, fall back to transformers
 *   tsx scripts/build-catalog-embeddings.ts --source=both    # build both catalogs
 *   tsx scripts/build-catalog-embeddings.ts --source=lm-studio
 *   tsx scripts/build-catalog-embeddings.ts --source=transformers
 *   tsx scripts/build-catalog-embeddings.ts --check          # exit 0 if both up-to-date
 */

import fs from "fs";
import path from "path";
import { HEVY_EXERCISES } from "../lib/hevy/catalog";
import { LMStudioProvider } from "../lib/embeddings/lm-studio-provider";
import { TransformersProvider } from "../lib/embeddings/transformers-provider";
import { getCatalogPath } from "../lib/embeddings/catalog-loader";
import type { EmbeddingProvider, CatalogMetadata } from "../lib/embeddings/types";

const INPUT_TEMPLATE = "title-v1" as const;
const EMBEDDINGS_DIR = path.join(process.cwd(), "lib", "data", "exercise-embeddings");

interface Args {
  source: "auto" | "both" | "lm-studio" | "transformers";
  check: boolean;
  checkOrRebuild: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let source: Args["source"] = "auto";
  let check = false;
  let checkOrRebuild = false;
  for (const a of args) {
    if (a === "--check") check = true;
    else if (a === "--check-or-rebuild") checkOrRebuild = true;
    else if (a.startsWith("--source=")) {
      const v = a.split("=")[1];
      if (v === "auto" || v === "both" || v === "lm-studio" || v === "transformers") {
        source = v;
      } else {
        console.error(`Invalid --source value: ${v}`);
        process.exit(2);
      }
    }
  }
  return { source, check, checkOrRebuild };
}

function buildInputText(ex: { title: string }): string {
  // input template "title-v1" — title only, lowercased for stability
  return ex.title.trim();
}

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function buildCatalog(provider: EmbeddingProvider): Promise<void> {
  console.log(`\n[build] generating catalog "${provider.catalogKey}" via ${provider.name} (${provider.modelId})`);
  const exercises = HEVY_EXERCISES;
  const inputs = exercises.map(buildInputText);
  const start = Date.now();
  const vecs = await provider.embed(inputs);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[build] embedded ${vecs.length} exercises in ${elapsed}s`);

  if (vecs.length !== exercises.length) {
    throw new Error(`vec count mismatch: ${vecs.length} vs ${exercises.length}`);
  }
  const dim = vecs[0].length;
  for (const v of vecs) {
    if (v.length !== dim) throw new Error(`inconsistent dim: ${v.length} vs ${dim}`);
  }

  const flat = new Float32Array(exercises.length * dim);
  for (let i = 0; i < vecs.length; i++) {
    flat.set(vecs[i], i * dim);
  }

  ensureDir(EMBEDDINGS_DIR);
  const { bin, meta } = getCatalogPath(provider.catalogKey);

  const metadata: CatalogMetadata = {
    source: provider.name,
    modelId: provider.modelId,
    catalogKey: provider.catalogKey,
    dim,
    count: exercises.length,
    exerciseIds: exercises.map((e) => e.id),
    builtAt: new Date().toISOString(),
    inputTemplate: INPUT_TEMPLATE,
  };

  fs.writeFileSync(bin, Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength));
  fs.writeFileSync(meta, JSON.stringify(metadata, null, 2));
  const sizeKb = (flat.byteLength / 1024).toFixed(1);
  console.log(`[build] wrote ${bin} (${sizeKb} KB)`);
  console.log(`[build] wrote ${meta}`);
}

function checkUpToDate(key: "qwen3-8b" | "nomic"): boolean {
  const { bin, meta } = getCatalogPath(key);
  if (!fs.existsSync(bin) || !fs.existsSync(meta)) return false;
  try {
    const m = JSON.parse(fs.readFileSync(meta, "utf-8")) as CatalogMetadata;
    if (m.count !== HEVY_EXERCISES.length) return false;
    if (m.inputTemplate !== INPUT_TEMPLATE) return false;
    // Compare exerciseId sets (order-independent) — catches refresh-runs
    // where the count happens to stay the same but Hevy swapped or
    // renamed templates.
    if (Array.isArray(m.exerciseIds)) {
      const fresh = new Set(HEVY_EXERCISES.map((e) => e.id));
      if (m.exerciseIds.length !== fresh.size) return false;
      for (const id of m.exerciseIds) {
        if (!fresh.has(id)) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { source, check, checkOrRebuild } = parseArgs();

  // The build-side `wantLM` is broader than the check-side because in
  // `auto` mode the main path tries LM first and falls back; the check
  // path only considers LM "required" when the user explicitly asked
  // for it.
  const wantLM = source === "auto" || source === "both" || source === "lm-studio";
  const wantTr = source === "auto" || source === "both" || source === "transformers";
  const requiresLM = source === "lm-studio" || source === "both";

  if (check) {
    const okQwen = checkUpToDate("qwen3-8b");
    const okNomic = checkUpToDate("nomic");
    if (okQwen || okNomic) {
      console.log(`[build:check] catalogs up-to-date (qwen3-8b=${okQwen}, nomic=${okNomic})`);
      process.exit(0);
    }
    console.log("[build:check] no catalogs found, must regenerate");
    process.exit(1);
  }

  if (checkOrRebuild) {
    // Skip the (slow) embedding regeneration when the catalog hasn't
    // changed — the prebuild step calls this after refresh-hevy.
    const okLM = requiresLM ? checkUpToDate("qwen3-8b") : true;
    const okTr = wantTr ? checkUpToDate("nomic") : true;
    if (okLM && okTr) {
      console.log("[build] embeddings up-to-date — skipping rebuild");
      process.exit(0);
    }
    console.log("[build] catalog changed — rebuilding embeddings…");
  }

  let didBuild = false;

  if (wantLM) {
    const lm = new LMStudioProvider();
    if (await lm.health()) {
      try {
        await buildCatalog(lm);
        didBuild = true;
      } catch (err) {
        console.error("[build] lm-studio build failed:", err);
        if (source === "lm-studio") process.exit(1);
      }
    } else {
      console.warn(`[build] lm-studio not reachable at ${process.env.LM_STUDIO_BASE_URL ?? "http://localhost:1234/v1"}`);
      if (source === "lm-studio") process.exit(1);
    }
  }

  // For "auto", only build transformers if LM Studio failed to produce anything
  const shouldRunTr = wantTr && (source !== "auto" || !didBuild);

  if (shouldRunTr) {
    try {
      const tr = new TransformersProvider();
      await buildCatalog(tr);
      didBuild = true;
    } catch (err) {
      console.error("[build] transformers build failed:", err);
      if (source === "transformers" || !didBuild) process.exit(1);
    }
  }

  if (!didBuild) {
    console.error("[build] no catalogs were built");
    process.exit(1);
  }
  console.log("[build] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
