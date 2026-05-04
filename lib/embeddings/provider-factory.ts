import "server-only";

import { EmbeddingProvider } from "./types";
import { LMStudioProvider } from "./lm-studio-provider";
import { TransformersProvider } from "./transformers-provider";

export type EmbeddingSource = "auto" | "lm-studio" | "transformers" | "off";

let cached: Promise<EmbeddingProvider | null> | null = null;
let lastWarn = false;

function readSource(): EmbeddingSource {
  const raw = (process.env.EMBEDDING_SOURCE ?? "auto").toLowerCase();
  if (raw === "auto" || raw === "lm-studio" || raw === "transformers" || raw === "off") {
    return raw;
  }
  console.warn(`[embeddings] Invalid EMBEDDING_SOURCE="${raw}", falling back to "auto"`);
  return "auto";
}

async function tryLMStudio(): Promise<EmbeddingProvider | null> {
  const p = new LMStudioProvider();
  if (await p.health()) {
    console.log(`[embeddings] using lm-studio (${p.modelId})`);
    return p;
  }
  return null;
}

async function tryTransformers(): Promise<EmbeddingProvider | null> {
  try {
    const p = new TransformersProvider();
    console.log(`[embeddings] using transformers (${p.modelId})`);
    return p;
  } catch (err) {
    console.warn("[embeddings] failed to init transformers:", err);
    return null;
  }
}

export function getProvider(): Promise<EmbeddingProvider | null> {
  if (cached) return cached;
  const source = readSource();

  cached = (async () => {
    if (source === "off") {
      console.log("[embeddings] disabled (EMBEDDING_SOURCE=off)");
      return null;
    }
    if (source === "lm-studio") {
      const p = await tryLMStudio();
      if (!p) console.warn("[embeddings] lm-studio not reachable, no fallback");
      return p;
    }
    if (source === "transformers") {
      return tryTransformers();
    }
    // auto
    const lm = await tryLMStudio();
    if (lm) return lm;
    return tryTransformers();
  })();

  cached.then((p) => {
    if (!p && !lastWarn) {
      lastWarn = true;
      console.warn("[embeddings] no provider available, embedding signal disabled");
    }
  });

  return cached;
}

export function resetProviderCache(): void {
  cached = null;
  lastWarn = false;
}
