import {
  clearModelCache,
  isModelNotFound,
  ModelInfo,
  pickModel,
  resolveModel,
  warmModelResolution,
  withModelRetry,
} from "./resolve";

const m = (id: string, created: number, caps: Partial<ModelInfo> = {}): ModelInfo => ({
  id,
  created,
  vision: true,
  tools: true,
  json: true,
  ...caps,
});

const GROQ = [
  m("qwen/qwen3.8-27b", 200),
  m("openai/gpt-oss-120b", 300, { vision: false }),
  m("newer-no-tools", 400, { tools: false }),
  m("older-vision", 100),
];

const ANTHROPIC = [
  m("claude-haiku-4-5", 100),
  m("claude-haiku-5-5", 200),
  m("claude-sonnet-5-5", 300),
];

beforeEach(() => {
  clearModelCache();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("pickModel", () => {
  it("keeps the pin when listed and capable", () => {
    expect(pickModel(GROQ, { vision: true, tools: true }, "older-vision")).toBe("older-vision");
  });

  it("picks newest capable when the pin is gone, skipping non-vision and no-tools", () => {
    expect(pickModel(GROQ, { vision: true, tools: true }, "meta-llama/llama-4-scout")).toBe(
      "qwen/qwen3.8-27b",
    );
  });

  it("stays inside the family", () => {
    expect(pickModel(ANTHROPIC, { vision: true, family: "haiku" }, "claude-haiku-bogus")).toBe(
      "claude-haiku-5-5",
    );
  });

  it("falls back to newest capable when the family matches nothing", () => {
    expect(pickModel(ANTHROPIC, { vision: true, family: "opus" }, "claude-opus-x")).toBe(
      "claude-sonnet-5-5",
    );
  });

  it("returns the pin when nothing is capable", () => {
    expect(pickModel([], { vision: true }, "pin")).toBe("pin");
  });
});

describe("resolveModel", () => {
  it("caches the manifest lookup", async () => {
    const fetchManifest = jest.fn().mockResolvedValue(GROQ);
    const opts = { provider: "groq" as const, needs: { vision: true as const }, pinned: "gone", fetchManifest };
    expect(await resolveModel(opts)).toBe("newer-no-tools");
    expect(await resolveModel(opts)).toBe("newer-no-tools");
    expect(fetchManifest).toHaveBeenCalledTimes(1);
  });

  it("returns the pin (uncached) when the manifest fetch fails", async () => {
    const fetchManifest = jest.fn().mockRejectedValue(new Error("down"));
    const opts = { provider: "groq" as const, needs: { vision: true as const }, pinned: "pin", fetchManifest };
    expect(await resolveModel(opts)).toBe("pin");
    expect(await resolveModel(opts)).toBe("pin");
    expect(fetchManifest).toHaveBeenCalledTimes(2);
  });
});

describe("withModelRetry", () => {
  const needs = { vision: true as const, tools: true };

  it("re-resolves and retries once on a 404", async () => {
    // First manifest still lists the dead pin (stale); second has dropped it.
    const fetchManifest = jest
      .fn()
      .mockResolvedValueOnce([m("dead", 500), ...GROQ])
      .mockResolvedValueOnce(GROQ);
    const fn = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { status: 404 }))
      .mockResolvedValueOnce("ok");
    const out = await withModelRetry({ provider: "groq", needs, pinned: "dead", fetchManifest }, fn);
    expect(out).toBe("ok");
    expect(fn.mock.calls.map((c) => c[0])).toEqual(["dead", "qwen/qwen3.8-27b"]);
    expect(fetchManifest).toHaveBeenCalledTimes(2);
  });

  it("detects openai-shape's HTTP 404 message", async () => {
    const fetchManifest = jest
      .fn()
      .mockResolvedValueOnce([m("dead", 500), ...GROQ])
      .mockResolvedValueOnce(GROQ);
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("provider_error: HTTP 404 from https://api.groq.com/openai/v1: ..."))
      .mockResolvedValueOnce("ok");
    await expect(
      withModelRetry({ provider: "groq", needs, pinned: "dead", fetchManifest }, fn),
    ).resolves.toBe("ok");
  });

  it("rethrows non-404 errors without retrying", async () => {
    const fetchManifest = jest.fn().mockResolvedValue(GROQ);
    const err = Object.assign(new Error("rate"), { status: 429 });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(
      withModelRetry({ provider: "groq", needs, pinned: "qwen/qwen3.8-27b", fetchManifest }, fn),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rethrows the original 404 when re-resolve lands on the same model", async () => {
    const fetchManifest = jest.fn().mockResolvedValue(GROQ);
    const err = Object.assign(new Error("nf"), { status: 404 });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(
      withModelRetry({ provider: "groq", needs, pinned: "qwen/qwen3.8-27b", fetchManifest }, fn),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("isModelNotFound", () => {
  it("matches status 404 and HTTP 404 text only", () => {
    expect(isModelNotFound({ status: 404 })).toBe(true);
    expect(isModelNotFound(new Error("HTTP 404 from x"))).toBe(true);
    expect(isModelNotFound({ status: 400 })).toBe(false);
    expect(isModelNotFound(new Error("HTTP 4040"))).toBe(false);
    expect(isModelNotFound(null)).toBe(false);
  });
});

describe("warmModelResolution", () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, AGENT_HARNESS_PROVIDER: "off", VISION_PROVIDER: "groq" };
  });
  afterAll(() => {
    process.env = env;
  });

  it("populates the cache for the active provider", async () => {
    process.env.GROQ_API_KEY = "k";
    const fetchManifest = jest.fn().mockResolvedValue(GROQ);
    await warmModelResolution(fetchManifest);
    expect(fetchManifest).toHaveBeenCalledWith("groq");
    // Same opts as callers use -> cache hit, no refetch.
    const { visionModelOpts } = await import("./resolve");
    await resolveModel({ ...visionModelOpts("groq"), fetchManifest });
    expect(fetchManifest).toHaveBeenCalledTimes(1);
  });

  it("skips without an API key and never throws", async () => {
    delete process.env.GROQ_API_KEY;
    const fetchManifest = jest.fn();
    await expect(warmModelResolution(fetchManifest)).resolves.toBeUndefined();
    expect(fetchManifest).not.toHaveBeenCalled();
  });

  it("warms the agent provider when the harness is on", async () => {
    process.env.AGENT_HARNESS_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "k";
    const fetchManifest = jest.fn().mockResolvedValue(ANTHROPIC);
    await warmModelResolution(fetchManifest);
    expect(fetchManifest).toHaveBeenCalledWith("anthropic");
  });
});
