export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((process.env.MATCHING_MODE ?? "both").toLowerCase() === "fuzzy") return;
  if ((process.env.EMBEDDING_SOURCE ?? "auto").toLowerCase() === "off") return;

  try {
    const { getProvider } = await import("./lib/embeddings/provider-factory");
    const provider = await getProvider();
    if (provider) {
      // warm pipeline / verify connection
      await provider.embed(["warmup"]);
      console.log(`[instrumentation] embedding provider ready: ${provider.name} (${provider.modelId})`);
    }
  } catch (err) {
    console.warn("[instrumentation] embedding warmup failed:", err);
  }
}
