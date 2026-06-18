import type { Card } from '@/domain/types';
import type { CardFace } from './CardFace';
import { altFor, applyRarityVars, buildOverlays, el } from './CardFace';
import { HOLO_DEFAULTS, applyHoloVars } from '@/render/holoConfig';

/**
 * V1 face: the player's printed PNG (AVIF/WebP via <picture>) under the
 * reference holographic foil stack. Full-bleed, crisp DOM; the red frame is
 * part of the art and is never recolored.
 */
export class ImageCardFace implements CardFace {
  readonly el: HTMLDivElement;
  private readonly rotator: HTMLDivElement;
  private readonly lqip: HTMLDivElement;
  private readonly source: HTMLSourceElement;
  private readonly img: HTMLImageElement;

  constructor() {
    this.el = el('div', 'card');
    this.el.setAttribute('role', 'img');
    this.el.tabIndex = -1;
    this.el.dataset.new = 'false';

    this.rotator = el('div', 'card__rotator');
    this.lqip = el('div', 'card__lqip');

    const picture = document.createElement('picture');
    this.source = document.createElement('source');
    this.source.type = 'image/avif';
    this.img = el('img', 'card__img');
    this.img.decoding = 'async';
    this.img.alt = '';
    picture.append(this.source, this.img);

    const o = buildOverlays();
    this.rotator.append(
      this.lqip,
      picture,
      o.holo,
      o.holoWash,
      o.glare,
      o.glint,
      o.noise,
      o.vignette,
      o.sweep,
      o.badge,
    );
    this.el.append(this.rotator);
  }

  async mount(card: Card, host: HTMLElement): Promise<void> {
    const { images } = card;
    this.source.srcset = images.hero.avif;
    this.img.src = images.hero.webp;
    if (images.lqip) this.lqip.style.backgroundImage = `url("${images.lqip}")`;
    // Same hero used as a luminance mask for the lab's "luminance" foil scope.
    this.el.style.setProperty('--card-img', `url("${images.hero.webp}")`);

    applyRarityVars(this.el, card.rarity);
    applyHoloVars(this.el, HOLO_DEFAULTS);
    this.el.setAttribute('aria-label', altFor(card));

    host.append(this.el);

    try {
      await this.img.decode();
    } catch {
      // Decode can reject if not yet connected or unsupported; the LQIP covers it.
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
