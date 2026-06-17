import type { Card, RarityDef } from '@/domain/types';

/**
 * The pluggable card-face seam. The holo/tilt machinery lives OUTSIDE the face
 * (in holo.ts + reveal.ts), operating on `el`, so it works identically for the
 * image face (V1) and the procedural face (future) without changes.
 */
export interface CardFace {
  /** The `.card` root element (perspective wrapper). */
  readonly el: HTMLElement;
  /** Build + populate DOM into `host`, awaiting the hero decode. */
  mount(card: Card, host: HTMLElement): Promise<void>;
  /** Fade holo + sparkle to their per-rarity resting intensity (post-reveal). */
  igniteHolo(): void;
  destroy(): void;
}

/** Small element helper. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export interface Overlays {
  glare: HTMLDivElement;
  /** Holographic rainbow foil (the main iridescence). */
  shine: HTMLDivElement;
  /** Fine glitter / spangle sparkle. */
  glitter: HTMLDivElement;
  /** Reveal light-sweep glint. */
  sweep: HTMLDivElement;
  badge: HTMLDivElement;
}

/** The shared glare/shine/glitter/sweep/NEW overlay stack used by every face. */
export function buildOverlays(): Overlays {
  const glare = el('div', 'card__glare');
  const shine = el('div', 'card__shine');
  const glitter = el('div', 'card__glitter');
  const sweep = el('div', 'card__sweep');
  const badge = el('div', 'card__new');
  badge.textContent = 'NEW';
  for (const layer of [glare, shine, glitter, sweep]) layer.setAttribute('aria-hidden', 'true');
  return { glare, shine, glitter, sweep, badge };
}

export interface RarityIntensity {
  holoMax: number;
  sparkleMax: number;
}

/** Write the rarity-driven CSS vars and return the resting holo/glitter levels. */
export function applyRarityVars(target: HTMLElement, rarity: RarityDef): RarityIntensity {
  target.style.setProperty('--holo-h1', String(rarity.holoHues[0]));
  target.style.setProperty('--holo-h2', String(rarity.holoHues[1]));
  target.style.setProperty('--holo-h3', String(rarity.holoHues[2]));
  target.style.setProperty('--holo-rot', `${rarity.holoRot}deg`);
  target.style.setProperty('--foil', rarity.foil);
  target.style.setProperty('--sheen', rarity.sheen);
  target.style.setProperty('--glow', rarity.glow);
  return {
    holoMax: 0.55 + rarity.drama * 0.4,
    sparkleMax: 0.35 + rarity.drama * 0.55,
  };
}

/** Rich alt text describing the sticker for screen readers. */
export function altFor(card: Card): string {
  const { def, rarity } = card;
  return `Sticker: ${def.country}. Marcus Masterton as ${def.localizedName}, with ${def.props.join(', ')}. ${rarity.label} rarity.`;
}
