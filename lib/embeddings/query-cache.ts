const MAX_ENTRIES = 500;

export class QueryCache {
  private store = new Map<string, Float32Array>();
  private max: number;

  constructor(max = MAX_ENTRIES) {
    this.max = max;
  }

  get(key: string): Float32Array | undefined {
    const v = this.store.get(key);
    if (!v) return undefined;
    this.store.delete(key);
    this.store.set(key, v);
    return v;
  }

  set(key: string, value: Float32Array): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, value);
    if (this.store.size > this.max) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
