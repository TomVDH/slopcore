import type { RarityDef, RarityTier } from '@/domain/types';

/**
 * The World-Cup-progression rarity ladder. THE single place to retune the
 * economy and the feel. `weight` is the tier's selection probability (the pull
 * is two-stage: choose a tier by weight, then a nation uniformly within it, so
 * tier odds stay stable no matter how many nations sit in each tier). `drama`
 * (0..1) scales reveal duration, bloom, sparkle, and particle count. `foil` /
 * `sheen` / `glow` only ever appear post-reveal, never on the card's red frame.
 */
export const RARITY: Record<RarityTier, RarityDef> = {
  group: {
    tier: 'group',
    label: 'Group Stage',
    weight: 50,
    foil: '#8A93A1',
    sheen: '#C9D2DE',
    glow: 'rgba(160, 175, 195, 0.45)',
    drama: 0.2,
    holoHues: [210, 190, 230],
    holoRot: 0,
  },
  r16: {
    tier: 'r16',
    label: 'Round of 16',
    weight: 30,
    foil: '#2E6BFF',
    sheen: '#8FB6FF',
    glow: 'rgba(70, 130, 255, 0.55)',
    drama: 0.45,
    holoHues: [205, 225, 185],
    holoRot: 40,
  },
  quarter: {
    tier: 'quarter',
    label: 'Quarter-Final',
    weight: 14,
    foil: '#7A3FF2',
    sheen: '#C6A4FF',
    glow: 'rgba(150, 90, 255, 0.6)',
    drama: 0.72,
    holoHues: [285, 315, 260],
    holoRot: 135,
  },
  final: {
    tier: 'final',
    label: 'Final',
    weight: 6,
    foil: '#E8B23A',
    sheen: '#FFF1C2',
    glow: 'rgba(255, 200, 80, 0.7)',
    drama: 1.0,
    holoHues: [46, 38, 60],
    holoRot: 210,
  },
};

/** Fixed ascending-prestige order, used for the binder "by tier" grouping. */
export const RARITY_ORDER: readonly RarityTier[] = ['group', 'r16', 'quarter', 'final'];
