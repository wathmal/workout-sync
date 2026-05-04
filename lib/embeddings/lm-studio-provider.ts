import "server-only";

import { EmbeddingProvider } from "./types";
import { l2Normalize } from "./cosine";

const DEFAULT_BASE_URL = "http://localhost:1234/v1";
const DEFAULT_MODEL = "text-embedding-qwen3-embedding-8b";
const HEALTH_TIMEOUT_MS = 500;
const BATCH_SIZE = 32;

export class LMStudioProvider implements EmbeddingProvider {
  readonly name = "lm-studio" as const;
  readonly catalogKey = "qwen3-8b" as const;
  readonly modelId: string;
  readonly dim: number;
  private baseUrl: string;

  constructor(opts: { baseUrl?: string; model?: string; dim?: number } = {}) {
    this.baseUrl = opts.baseUrl ?? process.env.LM_STUDIO_BASE_URL ?? DEFAULT_BASE_URL;
    this.modelId = opts.model ?? process.env.LM_STUDIO_EMBEDDING_MODEL ?? DEFAULT_MODEL;
    this.dim = opts.dim ?? 4096;
  }

  async health(): Promise<boolean> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}/models`, { signal: ctrl.signal });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.modelId, input: batch }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`LM Studio embeddings failed (${res.status}): ${body.slice(0, 200)}`);
      }
      const json = await res.json() as {
        data: Array<{ embedding: number[] | string }>;
      };
      for (const item of json.data) {
        const vec = Array.isArray(item.embedding)
          ? new Float32Array(item.embedding)
          : decodeBase64Float32(item.embedding);
        out.push(l2Normalize(vec));
      }
    }
    return out;
  }
}

function decodeBase64Float32(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64");
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
