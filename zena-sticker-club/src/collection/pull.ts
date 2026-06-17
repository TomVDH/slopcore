import type { CountryCode, NationDef, RarityTier } from '@/domain/types';
import { RARITY, RARITY_ORDER } from '@/domain/rarity';
import type { Rng } from '@/assets/rng';

export type PullStatus = 'need' | 'got';

/**
 * Pre-computed draw table. The pull is two-stage:
 *   1. pick a TIER weighted by `RARITY[tier].weight`
 *   2. pick a nation UNIFORMLY within that tier
 * This keeps tier odds stable regardless of how many nations sit in each tier,
 * and makes "1 in N packs" a clean per-tier statement.
 */
export interface PullTable {
  byTier: ReadonlyMap<RarityTier, readonly CountryCode[]>;
  tiers: readonly RarityTier[];
  tierWeights: readonly number[];
  totalWeight: number;
}

export function buildPullTable(nations: readonly NationDef[]): PullTable {
  const byTier = new Map<RarityTier, CountryCode[]>();
  for (const n of nations) {
    const arr = byTier.get(n.rarity);
    if (arr) arr.push(n.code);
    else byTier.set(n.rarity, [n.code]);
  }
  const tiers = RARITY_ORDER.filter((t) => (byTier.get(t)?.length ?? 0) > 0);
  const tierWeights = tiers.map((t) => RARITY[t].weight);
  const totalWeight = tierWeights.reduce((a, b) => a + b, 0);
  return { byTier, tiers, tierWeights, totalWeight };
}

/** Draw a single code from the table using the injected RNG. Deterministic. */
export function drawCode(table: PullTable, rng: Rng): CountryCode {
  // Stage 1: weighted tier selection.
  let r = rng.next() * table.totalWeight;
  let ti = 0;
  for (; ti < table.tiers.length - 1; ti++) {
    r -= table.tierWeights[ti]!;
    if (r < 0) break;
  }
  const tier = table.tiers[ti]!;

  // Stage 2: uniform pick within the tier.
  const pool = table.byTier.get(tier)!;
  const idx = Math.min(pool.length - 1, Math.floor(rng.next() * pool.length));
  return pool[idx]!;
}

/** Probability that any given pull lands in `tier`. */
export function tierProbability(table: PullTable, tier: RarityTier): number {
  const i = table.tiers.indexOf(tier);
  if (i < 0) return 0;
  return table.tierWeights[i]! / table.totalWeight;
}

/** Human-friendly "1 in N packs" for a tier. */
export function tierOddsLabel(table: PullTable, tier: RarityTier): string {
  const p = tierProbability(table, tier);
  if (p <= 0) return '';
  return `1 in ${Math.max(2, Math.round(1 / p))} packs`;
}

/** Classify a pull against the prior owned count (call BEFORE recording). */
export function classify(priorCount: number): PullStatus {
  return priorCount === 0 ? 'need' : 'got';
}
