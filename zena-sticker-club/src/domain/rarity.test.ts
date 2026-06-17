import { describe, it, expect } from 'vitest';
import { RARITY, RARITY_ORDER } from '@/domain/rarity';

describe('RARITY ladder', () => {
  it('defines all four tiers with valid fields', () => {
    for (const tier of RARITY_ORDER) {
      const r = RARITY[tier];
      expect(r.tier).toBe(tier);
      expect(r.weight).toBeGreaterThan(0);
      expect(r.drama).toBeGreaterThanOrEqual(0);
      expect(r.drama).toBeLessThanOrEqual(1);
      expect(r.holoHues).toHaveLength(3);
      expect(r.foil).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('drama increases with prestige', () => {
    expect(RARITY.group.drama).toBeLessThan(RARITY.r16.drama);
    expect(RARITY.r16.drama).toBeLessThan(RARITY.quarter.drama);
    expect(RARITY.quarter.drama).toBeLessThan(RARITY.final.drama);
  });

  it('rarer tiers carry less weight', () => {
    expect(RARITY.group.weight).toBeGreaterThan(RARITY.r16.weight);
    expect(RARITY.r16.weight).toBeGreaterThan(RARITY.quarter.weight);
    expect(RARITY.quarter.weight).toBeGreaterThan(RARITY.final.weight);
  });
});
