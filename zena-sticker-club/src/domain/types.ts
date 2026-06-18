/**
 * Shared domain types for ZENA FC — Sticker Club '26.
 *
 * The conceit: one man ("Marcus Masterton", club "ZENA FC") reskinned as a
 * national-stereotype caricature for all 48 nations. Every card shares the same
 * stat line and club; only the nation, kit, props, and localized pun name change.
 */

/**
 * The 48 source card codes. This array is the single source of truth — the
 * `CountryCode` union is derived from it, so the data file and the image glob
 * are exhaustively checked against the exact same list.
 */
export const ALL_CODES = [
  'ALGR', 'ARG', 'AUS', 'AUSTR', 'BEL', 'BHGZ', 'BR', 'CAN',
  'CBPV', 'CH', 'COL', 'CRC', 'CRT', 'CZ', 'DRC', 'ECU',
  'EGY', 'ESP', 'FRA', 'GER', 'GHN', 'HAIT', 'IRA', 'IRQ',
  'IVRC', 'JP', 'JRDN', 'MEX', 'MOR', 'NL', 'NRW', 'NZ',
  'PGY', 'PNM', 'PRTG', 'QAT', 'SARB', 'SCOT', 'SGL', 'SK',
  'SWE', 'TNS', 'TUR', 'UGY', 'UK', 'USA', 'UZB', 'ZA',
] as const;

export type CountryCode = (typeof ALL_CODES)[number];

export const TOTAL_NATIONS = ALL_CODES.length; // 48

/** Real football confederations, used as collectible texture in the sidebar. */
export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

/**
 * World-Cup-progression rarity ladder. Deliberately NOT a ranking of real
 * footballing ability — tiers are assigned editorially per nation and only
 * drive foil hue, reveal drama, and pull odds.
 */
export type RarityTier = 'group' | 'r16' | 'quarter' | 'final';

/** Reduced-motion is first-class: the whole experience has a calm equivalent. */
export type MotionLevel = 'full' | 'reduced';

/** Resolved rarity configuration (from `rarity.ts`). */
export interface RarityDef {
  tier: RarityTier;
  /** Human label, e.g. "Quarter-Final". */
  label: string;
  /** Relative pull weight (higher = more common). */
  weight: number;
  /** Foil accent hex, used post-reveal only (never on the card's red frame). */
  foil: string;
  /** Brighter sheen/highlight hex. */
  sheen: string;
  /** Glow rgba() for rim flare and binder ring. */
  glow: string;
  /** 0..1 intensity that scales reveal duration, bloom, sparkle and particle count. */
  drama: number;
  /** Three HSL hues that tint the holographic gradient bands. */
  holoHues: readonly [number, number, number];
  /** Per-tier hue-rotation (deg) applied to the holographic rainbow. */
  holoRot: number;
}

/** A single transcoded size, in both modern formats (AVIF preferred, WebP fallback). */
export interface CardImage {
  avif: string;
  webp: string;
}

/** All image variants for one card, plus a tiny inline placeholder. */
export interface ImageSet {
  /** ~220px wide, used in the binder. */
  thumb: CardImage;
  /** ~1000px wide, used for the reveal hero. */
  hero: CardImage;
  /** Blurred low-quality placeholder (data-URI or tiny URL); prevents a blank face. */
  lqip: string;
  /** Source intrinsic dimensions, for a CLS-free aspect-ratio box. */
  w: number;
  h: number;
}

/**
 * Hand-authored, content-only definition. This is the shape editors touch in
 * `nations.data.ts` — no logic, no resolved assets.
 */
export interface NationDef {
  code: CountryCode;
  /** English display name as printed on the card, e.g. "Argentina". */
  country: string;
  /** The exact printed nameplate pun, e.g. "Marcos Mastertoño". */
  localizedName: string;
  /** Real confederation of this nation. */
  confederation: Confederation;
  /** Flag emoji for the binder/panel (the card art already carries a roundel). */
  flagEmoji: string;
  /** 2-3 stereotype props actually visible in the card art. */
  props: readonly string[];
  /** Comedic 2-3 sentence "stint" bio. The joke is always on Marcus. */
  bio: string;
  /** Short pronunciation + pun decode of the localized name. */
  etymology: string;
  /** Editorial rarity tier (easy to retune in the data file). */
  rarity: RarityTier;
}

/** Runtime card: a `NationDef` hydrated with resolved rarity + images. */
export interface Card {
  code: CountryCode;
  def: NationDef;
  rarity: RarityDef;
  images: ImageSet;
}

/** Shared canon printed on every card. */
export const STAT_LINE = '8-1-1845 | 1,80 m | 80 kg';
export const CLUB = 'ZENA FC';
export const PLAYER = 'Marcus Masterton';
