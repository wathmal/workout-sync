import "server-only";

export { getProvider, resetProviderCache } from "./provider-factory";
export { loadCatalog, resetCatalogCache } from "./catalog-loader";
export {
  getMatchingMode,
  getQueryEmbedding,
  computeCosines,
  isEmbeddingAvailable,
  clearQueryCache,
} from "./match";
export { cosineSimilarity, scoreCatalog, l2Normalize, dot } from "./cosine";
export type {
  EmbeddingProvider,
  CatalogMetadata,
  LoadedCatalog,
  CatalogKey,
  MatchingMode,
  ProviderName,
} from "./types";
