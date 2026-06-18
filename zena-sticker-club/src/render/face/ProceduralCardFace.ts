import type { Card } from '@/domain/types';
import { CLUB, STAT_LINE } from '@/domain/types';
import type { CardFace } from './CardFace';
import { altFor, applyRarityVars, buildOverlays, el } from './CardFace';
import { HOLO_DEFAULTS, applyHoloVars } from '@/render/holoConfig';

/**
 * Future seam (NOT wired in V1). Renders a Panini-style frame from the SAME
 * `Card` data with zero image dependency, under the same holographic foil stack
 * as the image face. Styles are inline so it needs no extra CSS.
 */
export class ProceduralCardFace implements CardFace {
  readonly el: HTMLDivElement;
  private readonly rotator: HTMLDivElement;
  private readonly nameplate: HTMLDivElement;
  private readonly country: HTMLDivElement;
  private readonly flag: HTMLDivElement;
  private readonly stat: HTMLDivElement;

  constructor() {
    this.el = el('div', 'card');
    this.el.setAttribute('role', 'img');
    this.el.tabIndex = -1;
    this.el.dataset.new = 'false';

    this.rotator = el('div', 'card__rotator');
    const frame = el('div');
    Object.assign(frame.style, {
      position: 'absolute',
      inset: '0',
      borderRadius: 'inherit',
      background: 'linear-gradient(180deg, #e2231a, #c81d15)',
      display: 'grid',
      gridTemplateRows: '1fr auto',
      overflow: 'hidden',
    });

    const year = el('div');
    Object.assign(year.style, {
      position: 'absolute',
      inset: '8% 6% auto 6%',
      fontFamily: 'var(--font-display)',
      fontSize: '7rem',
      lineHeight: '0.8',
      color: 'rgba(255,255,255,0.16)',
      pointerEvents: 'none',
    });
    year.textContent = '26';

    this.flag = el('div');
    Object.assign(this.flag.style, {
      position: 'relative',
      placeSelf: 'center',
      fontSize: '4.4rem',
      filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.4))',
    });

    this.country = el('div');
    Object.assign(this.country.style, {
      position: 'absolute',
      right: '4%',
      top: '20%',
      writingMode: 'vertical-rl',
      fontFamily: 'var(--font-display)',
      fontSize: '1.5rem',
      letterSpacing: '0.04em',
      color: '#fff',
      textTransform: 'uppercase',
    });

    const plate = el('div');
    Object.assign(plate.style, {
      background: 'var(--plate-violet)',
      color: '#fff',
      textAlign: 'center',
      padding: '10px 12px 8px',
    });
    this.nameplate = el('div');
    Object.assign(this.nameplate.style, {
      fontFamily: 'var(--font-display)',
      fontSize: '1.1rem',
      letterSpacing: '0.02em',
    });
    this.stat = el('div');
    Object.assign(this.stat.style, {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.62rem',
      opacity: '0.85',
      marginTop: '2px',
    });
    const club = el('div');
    Object.assign(club.style, {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      letterSpacing: '0.2em',
      color: 'rgba(255,255,255,0.7)',
      marginTop: '4px',
    });
    club.textContent = CLUB;
    plate.append(this.nameplate, this.stat, club);

    frame.append(year, this.flag, this.country, plate);

    const o = buildOverlays();
    this.rotator.append(frame, o.holo, o.holoWash, o.glare, o.glint, o.noise, o.vignette, o.sweep, o.badge);
    this.el.append(this.rotator);
  }

  async mount(card: Card, host: HTMLElement): Promise<void> {
    const { def } = card;
    this.flag.textContent = def.flagEmoji;
    this.country.textContent = def.country;
    this.nameplate.textContent = def.localizedName;
    this.stat.textContent = STAT_LINE;
    applyRarityVars(this.el, card.rarity);
    applyHoloVars(this.el, HOLO_DEFAULTS);
    this.el.setAttribute('aria-label', altFor(card));
    host.append(this.el);
    return Promise.resolve();
  }

  destroy(): void {
    this.el.remove();
  }
}
