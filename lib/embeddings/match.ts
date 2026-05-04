import "server-only";

import { EmbeddingProvider, MatchingMode } from "./types";
import { QueryCache } from "./query-cache";
import { getProvider } from "./provider-factory";
import { loadCatalog } from "./catalog-loader";
import { scoreCatalog } from "./cosine";

const queryCache = new QueryCache();

function readMode(): MatchingMode {
  const raw = (process.env.MATCHING_MODE ?? "both").toLowerCase();
  if (raw === "fuzzy" || raw === "vector" || raw === "both") return raw;
  console.warn(`[embeddings] Invalid MATCHING_MODE="${raw}", falling back to "both"`);
  return "both";
}

export function getMatchingMode(): MatchingMode {
  return readMode();
}

export async function getQueryEmbedding(
  provider: EmbeddingProvider,
  text: string,
): Promise<Float32Array | null> {
  const key = `${provider.catalogKey}:${text}`;
  const hit = queryCache.get(key);
  if (hit) return hit;
  try {
    const [vec] = await provider.embed([text]);
    if (!vec) return null;
    queryCache.set(key, vec);
    return vec;
  } catch (err) {
    console.warn(`[embeddings] embed failed for "${text}":`, err);
    return null;
  }
}

export interface CosineLookup {
  scores: Float32Array;          // indexed by HEVY_EXERCISES position
  exerciseIdToIndex: Map<string, number>;
}

export async function computeCosines(text: string): Promise<CosineLookup | null> {
  const provider = await getProvider();
  if (!provider) return null;
  const catalog = loadCatalog(provider.catalogKey);
  if (!catalog) return null;
  const queryVec = await getQueryEmbedding(provider, text);
  if (!queryVec) return null;
  if (queryVec.length !== catalog.metadata.dim) {
    console.warn(`[embeddings] dim mismatch query=${queryVec.length} catalog=${catalog.metadata.dim}`);
    return null;
  }
  const scores = scoreCatalog(queryVec, catalog.buffer, catalog.metadata.dim);
  return { scores, exerciseIdToIndex: catalog.idIndex };
}

export async function isEmbeddingAvailable(): Promise<boolean> {
  const provider = await getProvider();
  if (!provider) return false;
  return loadCatalog(provider.catalogKey) !== null;
}

export function clearQueryCache(): void {
  queryCache.clear();
}
