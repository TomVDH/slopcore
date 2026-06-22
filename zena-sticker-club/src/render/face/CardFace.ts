import type { Card, RarityDef } from '@/domain/types';

/**
 * The pluggable card-face seam. The holographic foil + tilt machinery lives
 * OUTSIDE the face (in holo.ts / holo.css), operating on `el`, so it works
 * identically for the image face (V1) and the procedural face (future). The
 * foil is hover-driven (no per-face "ignite" step).
 */
export interface CardFace {
  /** The `.card` root element (perspective wrapper). */
  readonly el: HTMLElement;
  /** Build + populate DOM into `host`, awaiting the hero decode. */
  mount(card: Card, host: HTMLElement): Promise<void>;
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
  /** Iridescent rainbow stripes, masked to the cursor spotlight. */
  holo: HTMLDivElement;
  /** Broad subtle full-card wash. */
  holoWash: HTMLDivElement;
  /** Mouse-tracked white specular glow. */
  glare: HTMLDivElement;
  /** Tight hot glint. */
  glint: HTMLDivElement;
  /** Tone-independent film grain. */
  noise: HTMLDivElement;
  /** Edge darkening. */
  vignette: HTMLDivElement;
  /** Reveal light-sweep glint. */
  sweep: HTMLDivElement;
  badge: HTMLDivElement;
}

/** The reference foil layer stack shared by every face (back → front). */
export function buildOverlays(): Overlays {
  const holo = el('div', 'card__holo');
  const holoWash = el('div', 'card__holo-wash');
  const glare = el('div', 'card__glare');
  const glint = el('div', 'card__glint');
  const noise = el('div', 'card__noise');
  const vignette = el('div', 'card__vignette');
  const sweep = el('div', 'card__sweep');
  const badge = el('div', 'card__new');
  badge.textContent = 'NEW';
  for (const layer of [holo, holoWash, glare, glint, noise, vignette, sweep]) {
    layer.setAttribute('aria-hidden', 'true');
  }
  return { holo, holoWash, glare, glint, noise, vignette, sweep, badge };
}

/**
 * The card's true back — a ZENA FC crest panel on dark stock. Lives on the
 * rotator rotated 180°; with `backface-visibility: hidden` on the front layers
 * (holo.css) it only shows when the card flips/spins past 90°, instead of the
 * mirrored front.
 */
export function buildBack(): HTMLDivElement {
  const back = el('div', 'card__back');
  back.setAttribute('aria-hidden', 'true');
  const year = el('div', 'card__back-year');
  year.textContent = '26';
  const crest = el('div', 'card__back-crest');
  const mark = el('div', 'card__back-mark');
  mark.textContent = 'ZENA FC';
  const sub = el('div', 'card__back-sub');
  sub.textContent = "Sticker Club '26";
  crest.append(mark, sub);
  back.append(year, crest);
  return back;
}

/**
 * Write the rarity-driven CSS vars (foil/sheen/glow) used by the reveal rim
 * flare, the particle burst tint, and the binder ring. The holographic foil
 * itself is uniform across rarities (see holoConfig.ts).
 */
export function applyRarityVars(target: HTMLElement, rarity: RarityDef): void {
  target.style.setProperty('--foil', rarity.foil);
  target.style.setProperty('--sheen', rarity.sheen);
  target.style.setProperty('--glow', rarity.glow);
}

/** Rich alt text describing the sticker for screen readers. */
export function altFor(card: Card): string {
  const { def, rarity } = card;
  return `Sticker: ${def.country}. Marcus Masterton as ${def.localizedName}, with ${def.props.join(', ')}. ${rarity.label} rarity.`;
}
