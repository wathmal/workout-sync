export type ProviderName = "lm-studio" | "transformers";
export type CatalogKey = "qwen3-8b" | "nomic";
export type MatchingMode = "fuzzy" | "vector" | "both";

export interface EmbeddingProvider {
  readonly name: ProviderName;
  readonly modelId: string;
  readonly catalogKey: CatalogKey;
  readonly dim: number;
  embed(texts: string[]): Promise<Float32Array[]>;
  health(): Promise<boolean>;
}

export interface CatalogMetadata {
  source: ProviderName;
  modelId: string;
  catalogKey: CatalogKey;
  dim: number;
  count: number;
  exerciseIds: string[];
  builtAt: string;
  inputTemplate: "title-v1";
}

export interface LoadedCatalog {
  metadata: CatalogMetadata;
  buffer: Float32Array;
  idIndex: Map<string, number>;
}
