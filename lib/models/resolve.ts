import Anthropic from "@anthropic-ai/sdk";

/**
 * Self-healing model resolution. Env pins (GROQ_VISION_MODEL, GROQ_AGENT_MODEL,
 * ANTHROPIC_MODEL) are preferences: used when the provider's /models manifest
 * still lists them with the needed capabilities, otherwise the newest capable
 * model wins (Anthropic: within ANTHROPIC_MODEL_FAMILY). A 404 at call time
 * invalidates the cache and retries once on the re-resolved model.
 */

export type ModelProvider = "groq" | "anthropic";

export interface ModelNeeds {
  vision: true;
  tools?: boolean;
  json?: boolean;
  /** Regex source matched case-insensitively against the model id. */
  family?: string;
}

export interface ModelInfo {
  id: string;
  /** Unix seconds. */
  created: number;
  vision: boolean;
  tools: boolean;
  json: boolean;
}

export type ManifestFetcher = (provider: ModelProvider) => Promise<ModelInfo[]>;

export interface ResolveOpts {
  provider: ModelProvider;
  needs: ModelNeeds;
  pinned: string;
  fetchManifest?: ManifestFetcher;
}

const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";
const TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

// ponytail: per-process cache; fine for one Next instance. Shared store if we ever scale out.
// On globalThis because Next bundles instrumentation.ts and route chunks as separate
// module instances; a module-level Map would make the boot warm-up useless.
const g = globalThis as { __modelResolveCache?: Map<string, { id: string; at: number }> };
const cache = (g.__modelResolveCache ??= new Map());

const keyOf = (o: ResolveOpts) => JSON.stringify([o.provider, o.needs, o.pinned]);

export function clearModelCache(): void {
  cache.clear();
}

function anthropicFamily(): string {
  return process.env.ANTHROPIC_MODEL_FAMILY || "haiku";
}

export function visionModelOpts(provider: ModelProvider): ResolveOpts {
  return provider === "groq"
    ? {
        provider,
        needs: { vision: true, json: true },
        pinned: process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_MODEL,
      }
    : {
        provider,
        needs: { vision: true, json: true, family: anthropicFamily() },
        pinned: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      };
}

export function agentModelOpts(provider: ModelProvider): ResolveOpts {
  return provider === "groq"
    ? {
        provider,
        needs: { vision: true, tools: true },
        pinned: process.env.GROQ_AGENT_MODEL || DEFAULT_GROQ_MODEL,
      }
    : {
        provider,
        needs: { vision: true, tools: true, family: anthropicFamily() },
        pinned: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      };
}

interface GroqManifestModel {
  id: string;
  active?: boolean;
  created?: number;
  input_modalities?: string[];
  supported_features?: string[];
}

async function fetchGroqManifest(): Promise<ModelInfo[]> {
  // Raw fetch: groq-sdk's Model type lacks active / input_modalities / supported_features.
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`groq /models returned ${res.status}`);
  const body = (await res.json()) as { data?: GroqManifestModel[] };
  return (body.data ?? [])
    .filter((m) => m.active !== false)
    .map((m) => ({
      id: m.id,
      created: m.created ?? 0,
      vision: m.input_modalities?.includes("image") ?? false,
      tools: m.supported_features?.includes("tools") ?? false,
      json: m.supported_features?.includes("json_mode") ?? false,
    }));
}

async function fetchAnthropicManifest(): Promise<ModelInfo[]> {
  const client = new Anthropic({ timeout: FETCH_TIMEOUT_MS, maxRetries: 1 });
  const out: ModelInfo[] = [];
  for await (const m of client.models.list()) {
    out.push({
      id: m.id,
      created: Date.parse(m.created_at) / 1000,
      vision: m.capabilities?.image_input.supported ?? true,
      tools: true,
      json: m.capabilities?.structured_outputs.supported ?? true,
    });
  }
  return out;
}

const defaultFetch: ManifestFetcher = (p) =>
  p === "groq" ? fetchGroqManifest() : fetchAnthropicManifest();

/** Pure pick: pinned if listed + capable, else newest in family, else newest capable, else pinned. */
export function pickModel(manifest: ModelInfo[], needs: ModelNeeds, pinned: string): string {
  const capable = manifest.filter(
    (m) => m.vision && (!needs.tools || m.tools) && (!needs.json || m.json),
  );
  if (capable.some((m) => m.id === pinned)) return pinned;
  const family = needs.family ? new RegExp(needs.family, "i") : null;
  const inFamily = family ? capable.filter((m) => family.test(m.id)) : [];
  const pool = inFamily.length > 0 ? inFamily : capable;
  return [...pool].sort((a, b) => b.created - a.created)[0]?.id ?? pinned;
}

export async function resolveModel(o: ResolveOpts): Promise<string> {
  const key = keyOf(o);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id;

  let manifest: ModelInfo[];
  try {
    manifest = await (o.fetchManifest ?? defaultFetch)(o.provider);
  } catch (err) {
    // Discovery outage must never break extraction: fall back to the pin, uncached.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[models] ${o.provider}: manifest fetch failed, using pinned ${o.pinned}: ${msg}`);
    return o.pinned;
  }

  const id = pickModel(manifest, o.needs, o.pinned);
  cache.set(key, { id, at: Date.now() });
  console.log(
    `[models] ${o.provider}: resolved ${id} (pinned ${o.pinned}${id === o.pinned ? "" : " not listed"})`,
  );
  return id;
}

/**
 * Duck-typed: covers Groq/Anthropic SDK NotFoundError (.status 404) and
 * openai-shape's AgentLoopError message ("HTTP 404 from ...").
 */
export function isModelNotFound(err: unknown): boolean {
  if ((err as { status?: unknown } | null)?.status === 404) return true;
  return err instanceof Error && /\bHTTP 404\b/.test(err.message);
}

// ponytail: retries the wrapped call once; a model retired mid-agent-run fails that run.
export async function withModelRetry<T>(
  o: ResolveOpts,
  fn: (model: string) => Promise<T>,
): Promise<T> {
  const model = await resolveModel(o);
  try {
    return await fn(model);
  } catch (err) {
    if (!isModelNotFound(err)) throw err;
    cache.delete(keyOf(o));
    const next = await resolveModel(o);
    if (next === model) throw err;
    console.warn(`[models] ${o.provider}: ${model} returned 404, retrying with ${next}`);
    return fn(next);
  }
}

/**
 * Boot-time resolve for whichever path is active (agent harness wins over
 * single-shot, mirroring lib/vision/index.ts). Never throws.
 */
export async function warmModelResolution(fetchManifest?: ManifestFetcher): Promise<void> {
  const agent = (process.env.AGENT_HARNESS_PROVIDER || "off").toLowerCase();
  const vision = (process.env.VISION_PROVIDER || "groq").toLowerCase();

  let opts: ResolveOpts | null = null;
  if (agent !== "off") {
    if (agent === "groq" || agent === "anthropic") opts = agentModelOpts(agent);
  } else if (vision !== "lm-studio") {
    opts = visionModelOpts(vision === "anthropic" ? "anthropic" : "groq");
  }
  if (!opts) return;

  const keyVar = opts.provider === "groq" ? "GROQ_API_KEY" : "ANTHROPIC_API_KEY";
  if (!process.env[keyVar]) {
    console.log(`[models] ${opts.provider}: ${keyVar} not set, skipping warm-up`);
    return;
  }
  try {
    await resolveModel({ ...opts, fetchManifest });
  } catch (err) {
    console.warn(`[models] ${opts.provider}: warm-up failed:`, err);
  }
}
