export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Before the embedding early-returns: prod sets MATCHING_MODE=fuzzy + EMBEDDING_SOURCE=off.
  try {
    const { warmModelResolution } = await import("./lib/models/resolve");
    await warmModelResolution();
  } catch (err) {
    console.warn("[instrumentation] model resolution warmup failed:", err);
  }

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
