import "server-only";

import { EmbeddingProvider } from "./types";

const DEFAULT_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const BATCH_SIZE = 16;

type FeatureExtractionPipeline = (
  inputs: string | string[],
  opts?: { pooling?: "mean" | "cls"; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] }>;

export class TransformersProvider implements EmbeddingProvider {
  readonly name = "transformers" as const;
  readonly catalogKey = "nomic" as const;
  readonly modelId: string;
  readonly dim: number;
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(opts: { model?: string; dim?: number } = {}) {
    this.modelId = opts.model ?? process.env.TRANSFORMERS_EMBEDDING_MODEL ?? DEFAULT_MODEL;
    this.dim = opts.dim ?? 768;
  }

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const mod = await import("@huggingface/transformers");
        const p = await mod.pipeline("feature-extraction", this.modelId);
        return p as unknown as FeatureExtractionPipeline;
      })();
    }
    return this.pipelinePromise;
  }

  async health(): Promise<boolean> {
    try {
      await this.getPipeline();
      return true;
    } catch {
      return false;
    }
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    const pipe = await this.getPipeline();
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const result = await pipe(batch, { pooling: "mean", normalize: true });
      const flat = result.data instanceof Float32Array
        ? result.data
        : new Float32Array(result.data as number[]);
      const dim = flat.length / batch.length;
      for (let j = 0; j < batch.length; j++) {
        out.push(flat.slice(j * dim, (j + 1) * dim));
      }
    }
    return out;
  }
}
