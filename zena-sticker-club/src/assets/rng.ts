/**
 * Tiny seeded PRNG so pulls are reproducible in tests and via a `?seed=` URL
 * override. Runtime (no seed) falls back to crypto/Math.random.
 */
export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
}

/** mulberry32: fast, decent-quality 32-bit PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** FNV-1a string hash → 32-bit unsigned, for turning a `?seed=` string into a number. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Create an RNG. With no seed, picks a fresh non-deterministic one. */
export function createRng(seed?: string | number): Rng {
  if (seed === undefined || seed === '') {
    const random = Math.floor(Math.random() * 0xffffffff);
    return mulberry32(random >>> 0);
  }
  const s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return mulberry32(s);
}
