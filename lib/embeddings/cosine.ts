export function l2Normalize(vec: Float32Array): Float32Array {
  let mag = 0;
  for (let i = 0; i < vec.length; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / mag;
  return out;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let d = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return d / denom;
}

export function scoreCatalog(
  query: Float32Array,
  catalogBuffer: Float32Array,
  dim: number,
): Float32Array {
  const count = catalogBuffer.length / dim;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let s = 0;
    const base = i * dim;
    for (let j = 0; j < dim; j++) s += query[j] * catalogBuffer[base + j];
    out[i] = s;
  }
  return out;
}
