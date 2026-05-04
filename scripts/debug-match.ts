#!/usr/bin/env tsx
/**
 * Debug what scores get computed for a given input.
 *
 * Usage:
 *   tsx scripts/debug-match.ts "DB Curl"
 *   EMBEDDING_SOURCE=lm-studio tsx scripts/debug-match.ts "DB Curl"
 *   EMBEDDING_SOURCE=transformers tsx scripts/debug-match.ts "DB Curl"
 */
import { HEVY_EXERCISES, calculateFuzzyBase, calculateBonuses } from "../lib/hevy/exercises";
import { getProvider } from "../lib/embeddings/provider-factory";
import { loadCatalog } from "../lib/embeddings/catalog-loader";
import { scoreCatalog } from "../lib/embeddings/cosine";

const TOP_N = 15;
const FUZZY_WEIGHT = parseFloat(process.env.FUZZY_WEIGHT ?? "0.6");
const EMBEDDING_WEIGHT = parseFloat(process.env.EMBEDDING_WEIGHT ?? "0.4");
const COS_THRESHOLD = parseFloat(process.env.EMBEDDING_COS_THRESHOLD ?? "0.55");

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("usage: tsx scripts/debug-match.ts \"<exercise name>\"");
    process.exit(1);
  }

  console.log(`\n=== input: "${input}" ===\n`);

  const provider = await getProvider();
  if (!provider) {
    console.error("no embedding provider available");
    process.exit(1);
  }
  console.log(`provider: ${provider.name} (${provider.modelId})`);

  const catalog = loadCatalog(provider.catalogKey);
  if (!catalog) {
    console.error("no catalog loaded");
    process.exit(1);
  }

  const [queryVec] = await provider.embed([input]);
  console.log(`query vec dims=${queryVec.length}, sample[0..5]=${Array.from(queryVec.slice(0, 5)).map(v => v.toFixed(4)).join(", ")}`);

  const cosines = scoreCatalog(queryVec, catalog.buffer, catalog.metadata.dim);

  // Build side-by-side scores
  const rows = HEVY_EXERCISES.map((ex, i) => {
    const idx = catalog.idIndex.get(ex.id);
    const cos = idx !== undefined ? cosines[idx] : 0;
    const fuzzy = calculateFuzzyBase(input, ex);
    const bonus = calculateBonuses(input, ex);
    let blended: number;
    if (cos < COS_THRESHOLD) blended = Math.min(150, fuzzy + bonus);
    else blended = Math.min(150, FUZZY_WEIGHT * fuzzy + EMBEDDING_WEIGHT * (cos * 100) + bonus);
    return { ex, cos, fuzzy, bonus, blended };
  });

  console.log("\n--- TOP BY COSINE ---");
  print(rows.slice().sort((a, b) => b.cos - a.cos).slice(0, TOP_N));

  console.log("\n--- TOP BY FUZZY (Levenshtein + word overlap) ---");
  print(rows.slice().sort((a, b) => (b.fuzzy + b.bonus) - (a.fuzzy + a.bonus)).slice(0, TOP_N));

  console.log("\n--- TOP BY BLENDED (final winner used by matcher) ---");
  print(rows.slice().sort((a, b) => b.blended - a.blended).slice(0, TOP_N));

  console.log(`\nweights: fuzzy=${FUZZY_WEIGHT} embed=${EMBEDDING_WEIGHT} cos_threshold=${COS_THRESHOLD}`);
}

function print(items: Array<{ ex: { title: string; equipment: string; is_custom: boolean }; cos: number; fuzzy: number; bonus: number; blended: number }>) {
  console.log(
    "rank | cos    | fuzzy | bonus | blended | title".padEnd(80, " "),
  );
  console.log("-".repeat(95));
  items.forEach((r, i) => {
    const tag = r.ex.is_custom ? "[c]" : "   ";
    console.log(
      `${(i + 1).toString().padStart(4)} | ${r.cos.toFixed(4)} | ${r.fuzzy.toString().padStart(5)} | ${r.bonus.toString().padStart(5)} | ${r.blended.toFixed(2).padStart(7)} | ${tag} ${r.ex.title} (${r.ex.equipment})`,
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
