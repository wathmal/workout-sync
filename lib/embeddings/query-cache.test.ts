import { QueryCache } from "./query-cache";

describe("QueryCache", () => {
  it("returns undefined on miss", () => {
    const c = new QueryCache(3);
    expect(c.get("x")).toBeUndefined();
  });

  it("returns cached value on hit", () => {
    const c = new QueryCache(3);
    const v = new Float32Array([1, 2, 3]);
    c.set("x", v);
    expect(c.get("x")).toBe(v);
  });

  it("evicts oldest when over capacity", () => {
    const c = new QueryCache(2);
    c.set("a", new Float32Array([1]));
    c.set("b", new Float32Array([2]));
    c.set("c", new Float32Array([3]));
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBeDefined();
    expect(c.get("c")).toBeDefined();
  });

  it("get moves entry to most-recently-used", () => {
    const c = new QueryCache(2);
    c.set("a", new Float32Array([1]));
    c.set("b", new Float32Array([2]));
    c.get("a"); // refresh a
    c.set("c", new Float32Array([3]));
    // b should be evicted, not a
    expect(c.get("a")).toBeDefined();
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBeDefined();
  });

  it("clear empties cache", () => {
    const c = new QueryCache(3);
    c.set("a", new Float32Array([1]));
    c.clear();
    expect(c.size()).toBe(0);
    expect(c.get("a")).toBeUndefined();
  });
});
