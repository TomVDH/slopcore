import { describe, it, expect } from 'vitest';
import { mulberry32, hashSeed, createRng } from '@/assets/rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a.next(), a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    expect(mulberry32(1).next()).not.toEqual(mulberry32(2).next());
  });
});

describe('hashSeed / createRng', () => {
  it('hashes strings to a 32-bit unsigned int', () => {
    const h = hashSeed('argentina');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('same string seed reproduces a sequence', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });
});
