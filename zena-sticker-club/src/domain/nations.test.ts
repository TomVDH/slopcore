import { describe, it, expect } from 'vitest';
import { invariants, allNations, getNation } from '@/domain/nations';
import { ALL_CODES, TOTAL_NATIONS } from '@/domain/types';
import { RARITY_ORDER } from '@/domain/rarity';

describe('nations data', () => {
  it('passes structural invariants', () => {
    expect(() => invariants()).not.toThrow();
  });

  it('has exactly 48 unique nations matching ALL_CODES', () => {
    expect(allNations()).toHaveLength(TOTAL_NATIONS);
    expect(TOTAL_NATIONS).toBe(48);
    expect(new Set(allNations().map((n) => n.code)).size).toBe(48);
  });

  it('resolves every declared code', () => {
    for (const code of ALL_CODES) {
      expect(getNation(code).code).toBe(code);
    }
  });

  it('assigns every nation a known rarity tier', () => {
    for (const n of allNations()) {
      expect(RARITY_ORDER).toContain(n.rarity);
    }
  });

  it('contains no em-dash or en-dash anywhere in the copy', () => {
    for (const n of allNations()) {
      const text = `${n.country} ${n.localizedName} ${n.bio} ${n.etymology} ${n.props.join(' ')}`;
      expect(text, `${n.code} copy must avoid em/en dashes`).not.toMatch(/[–—]/);
    }
  });

  it('has at least one nation in every tier (two-stage pull needs this)', () => {
    const present = new Set(allNations().map((n) => n.rarity));
    for (const tier of RARITY_ORDER) {
      expect(present.has(tier)).toBe(true);
    }
  });
});
