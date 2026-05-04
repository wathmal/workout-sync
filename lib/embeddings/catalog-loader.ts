import "server-only";

import fs from "fs";
import path from "path";
import { CatalogKey, CatalogMetadata, LoadedCatalog } from "./types";

const EMBEDDINGS_DIR = path.join(process.cwd(), "lib", "data", "exercise-embeddings");

const cache = new Map<CatalogKey, LoadedCatalog | null>();

export function getCatalogPath(key: CatalogKey): { bin: string; meta: string } {
  return {
    bin: path.join(EMBEDDINGS_DIR, `${key}.bin`),
    meta: path.join(EMBEDDINGS_DIR, `${key}.meta.json`),
  };
}

export function loadCatalog(key: CatalogKey): LoadedCatalog | null {
  if (cache.has(key)) return cache.get(key) ?? null;

  const { bin, meta } = getCatalogPath(key);
  if (!fs.existsSync(bin) || !fs.existsSync(meta)) {
    console.warn(`[embeddings] catalog "${key}" missing (${bin}). Embedding signal disabled for this source.`);
    cache.set(key, null);
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(meta, "utf-8")) as CatalogMetadata;
    const raw = fs.readFileSync(bin);
    const buffer = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    const expected = metadata.count * metadata.dim;
    if (buffer.length !== expected) {
      console.warn(`[embeddings] catalog "${key}" size mismatch (got ${buffer.length}, expected ${expected})`);
      cache.set(key, null);
      return null;
    }
    const idIndex = new Map<string, number>();
    metadata.exerciseIds.forEach((id, i) => idIndex.set(id, i));
    const loaded: LoadedCatalog = { metadata, buffer, idIndex };
    cache.set(key, loaded);
    console.log(`[embeddings] loaded catalog "${key}" (${metadata.count} vecs × ${metadata.dim} dims, model=${metadata.modelId})`);
    return loaded;
  } catch (err) {
    console.warn(`[embeddings] failed to load catalog "${key}":`, err);
    cache.set(key, null);
    return null;
  }
}

export function getCatalogVectorView(catalog: LoadedCatalog, index: number): Float32Array {
  const dim = catalog.metadata.dim;
  return catalog.buffer.subarray(index * dim, (index + 1) * dim);
}

export function resetCatalogCache(): void {
  cache.clear();
}
