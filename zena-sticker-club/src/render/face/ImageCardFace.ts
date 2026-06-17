import type { Card } from '@/domain/types';
import type { CardFace, RarityIntensity } from './CardFace';
import { altFor, applyRarityVars, buildOverlays, el } from './CardFace';

/**
 * V1 face: the player's printed PNG (AVIF/WebP via <picture>) under the shared
 * holo overlay stack. Full-bleed, crisp DOM; the red frame is part of the art.
 */
export class ImageCardFace implements CardFace {
  readonly el: HTMLDivElement;
  private readonly rotator: HTMLDivElement;
  private readonly lqip: HTMLDivElement;
  private readonly source: HTMLSourceElement;
  private readonly img: HTMLImageElement;
  private intensity: RarityIntensity = { holoMax: 0.5, sparkleMax: 0.4 };

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

    const { glare, shine, glitter, sweep, badge } = buildOverlays();
    this.rotator.append(this.lqip, picture, glare, shine, glitter, sweep, badge);
    this.el.append(this.rotator);
  }

  async mount(card: Card, host: HTMLElement): Promise<void> {
    const { images } = card;
    this.source.srcset = images.hero.avif;
    this.img.src = images.hero.webp;
    if (images.lqip) this.lqip.style.backgroundImage = `url("${images.lqip}")`;

    this.intensity = applyRarityVars(this.el, card.rarity);
    this.el.setAttribute('aria-label', altFor(card));

    host.append(this.el);

    try {
      await this.img.decode();
    } catch {
      // Decode can reject if not yet connected or unsupported; the LQIP covers it.
    }
  }

  igniteHolo(): void {
    this.el.style.setProperty('--holo-opacity', this.intensity.holoMax.toFixed(3));
    this.el.style.setProperty('--sparkle-opacity', this.intensity.sparkleMax.toFixed(3));
  }

  destroy(): void {
    this.el.remove();
  }
}
