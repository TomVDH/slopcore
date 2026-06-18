import { describe, it, expect } from 'vitest';
import { buildPullTable, drawCode, tierProbability, tierOddsLabel, classify } from '@/collection/pull';
import { mulberry32 } from '@/assets/rng';
import { NATION_DEFS } from '@/domain/nations.data';
import type { CountryCode, RarityTier } from '@/domain/types';

const table = buildPullTable(NATION_DEFS);

describe('buildPullTable', () => {
  it('includes only present tiers and sums weights correctly', () => {
    expect(table.tiers.length).toBeGreaterThan(0);
    expect(table.totalWeight).toBe(table.tierWeights.reduce((a, b) => a + b, 0));
  });
});

describe('drawCode', () => {
  it('always returns a valid code', () => {
    const rng = mulberry32(99);
    const valid = new Set<CountryCode>(NATION_DEFS.map((n) => n.code));
    for (let i = 0; i < 1000; i++) {
      expect(valid.has(drawCode(table, rng))).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    const seqA = Array.from({ length: 30 }, () => drawCode(table, a));
    const seqB = Array.from({ length: 30 }, () => drawCode(table, b));
    expect(seqA).toEqual(seqB);
  });

  it('roughly respects tier probabilities over many draws', () => {
    const rng = mulberry32(2026);
    const tierOf = new Map<CountryCode, RarityTier>(NATION_DEFS.map((n) => [n.code, n.rarity]));
    const counts = new Map<RarityTier, number>();
    const N = 30000;
    for (let i = 0; i < N; i++) {
      const tier = tierOf.get(drawCode(table, rng))!;
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
    const groupP = (counts.get('group') ?? 0) / N;
    const finalP = (counts.get('final') ?? 0) / N;
    // group ~0.50, final ~0.06 (generous tolerances for sampling noise)
    expect(groupP).toBeGreaterThan(0.42);
    expect(groupP).toBeLessThan(0.58);
    expect(finalP).toBeGreaterThan(0.03);
    expect(finalP).toBeLessThan(0.09);
  });
});

describe('odds helpers', () => {
  it('tierProbability sums to ~1 across present tiers', () => {
    const sum = table.tiers.reduce((acc, t) => acc + tierProbability(table, t), 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('tierOddsLabel reads "1 in N packs"', () => {
    expect(tierOddsLabel(table, 'final')).toMatch(/^1 in \d+ packs$/);
  });
});

describe('classify', () => {
  it('is need when unowned, got otherwise', () => {
    expect(classify(0)).toBe('need');
    expect(classify(1)).toBe('got');
    expect(classify(7)).toBe('got');
  });
});
