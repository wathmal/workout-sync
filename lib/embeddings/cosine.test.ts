import { cosineSimilarity, dot, l2Normalize, scoreCatalog } from "./cosine";

describe("cosine math", () => {
  it("identical vectors → 1", () => {
    const a = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 6);
  });

  it("orthogonal vectors → 0", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 6);
  });

  it("opposite vectors → -1", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 6);
  });

  it("zero vector → 0 (no NaN)", () => {
    const a = new Float32Array([0, 0]);
    const b = new Float32Array([1, 1]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("l2Normalize produces unit length", () => {
    const a = new Float32Array([3, 4]);
    const n = l2Normalize(a);
    const mag = Math.sqrt(n[0] * n[0] + n[1] * n[1]);
    expect(mag).toBeCloseTo(1, 6);
  });

  it("dot of normalized vecs equals cosine", () => {
    const a = l2Normalize(new Float32Array([2, 3, 1]));
    const b = l2Normalize(new Float32Array([1, 2, 3]));
    expect(dot(a, b)).toBeCloseTo(cosineSimilarity(a, b), 6);
  });

  it("scoreCatalog computes per-row dot products", () => {
    const dim = 2;
    const catalog = new Float32Array([1, 0, 0, 1, 0.7071, 0.7071]);
    const query = new Float32Array([1, 0]);
    const scores = scoreCatalog(query, catalog, dim);
    expect(scores.length).toBe(3);
    expect(scores[0]).toBeCloseTo(1, 4);
    expect(scores[1]).toBeCloseTo(0, 4);
    expect(scores[2]).toBeCloseTo(0.7071, 4);
  });
});
