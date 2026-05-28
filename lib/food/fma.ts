import "server-only";
import type {
  FmaAnalyzeResponse,
  FmaSearchResponse,
} from "./types";

function getBaseUrl(): string {
  const url = process.env.FMA_BASE_URL;
  if (!url) throw new Error("FMA_BASE_URL not set");
  return url.replace(/\/$/, "");
}

function getApiKey(): string {
  const key = process.env.FMA_API_KEY;
  if (!key) throw new Error("FMA_API_KEY not set");
  return key;
}

async function fma<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(getBaseUrl() + path);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.error?.message ?? parsed.message ?? text;
    } catch {
      // text already
    }
    const err = new Error(`FMA ${res.status}: ${msg}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export async function fmaSearch(q: string, limit = 8): Promise<FmaSearchResponse> {
  return fma<FmaSearchResponse>("/v1/foods/search", { query: { q, limit } });
}

export async function fmaAnalyzeText(
  text: string,
  opts?: { include?: Array<"trace" | "rationale"> },
): Promise<FmaAnalyzeResponse> {
  return fma<FmaAnalyzeResponse>("/v1/analyze/text", {
    method: "POST",
    body: { text, include: opts?.include ?? ["rationale"] },
  });
}

export async function fmaAnalyzePhoto(
  imageBase64: string,
  opts?: { include?: Array<"trace" | "rationale">; locale?: string; context?: string },
): Promise<FmaAnalyzeResponse> {
  return fma<FmaAnalyzeResponse>("/v1/analyze", {
    method: "POST",
    body: {
      image_base64: imageBase64,
      include: opts?.include ?? ["rationale"],
      locale: opts?.locale,
      context: opts?.context,
    },
  });
}

export async function fmaGetFood(foodIdOrComposite: string | number) {
  const path = `/v1/foods/${encodeURIComponent(String(foodIdOrComposite))}`;
  return fma<unknown>(path);
}
