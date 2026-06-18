import { gsap } from 'gsap';
import type { Card } from '@/domain/types';
import { STAT_LINE } from '@/domain/types';
import { el } from '@/render/face/CardFace';

export interface PanelInfo {
  count: number;
  oddsLabel: string;
  owned: number;
  total: number;
  /** Faux squad number = first-acquisition index (1-based). */
  squadNo: number;
}

/**
 * The reveal sidebar. Its job is to ADD lore the card image cannot: the decoded
 * pun name + etymology, Marcus's comedic stint, the visible props, a reframed
 * stat line, and collection progress. Built once, repopulated per reveal.
 */
export class PanelView {
  private readonly tierLabel: HTMLElement;
  private readonly odds: HTMLElement;
  private readonly eyebrow: HTMLElement;
  private readonly nation: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly sayEl: HTMLElement;
  private readonly bioEl: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly statEl: HTMLElement;
  private readonly progressEl: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.dataset.state = 'closed';
    const inner = el('div', 'panel__inner');

    const ribbon = el('div', 'tier-ribbon');
    this.tierLabel = el('span', 'tier-ribbon__label');
    this.odds = el('span', 'tier-ribbon__odds mono');
    ribbon.append(this.tierLabel, this.odds);

    const head = el('header', 'panel__head');
    this.eyebrow = el('p', 'eyebrow');
    this.nation = el('h1', 'panel__nation');
    head.append(this.eyebrow, this.nation);

    const decoded = el('section', 'decoded');
    this.nameEl = el('p', 'decoded__name');
    this.sayEl = el('p', 'decoded__say');
    decoded.append(this.label('The Name'), this.nameEl, this.sayEl);

    const stint = el('section', 'stint');
    this.bioEl = el('p', 'stint__body');
    stint.append(this.label("Marcus's Stint"), this.bioEl);

    const dossier = el('section', 'dossier');
    this.chips = el('div', 'chips');
    dossier.append(this.label('Kit & Clues'), this.chips);

    const stats = el('section', 'statplate');
    this.statEl = el('p', 'statplate__line mono');
    const decode = el('p', 'statplate__note');
    decode.textContent =
      'Born 8-1-1845, the era of football’s first written rules. Height and weight are, like the caps, self-reported.';
    stats.append(this.label('Scouting Data'), this.statEl, decode);

    const progress = el('section', 'panel__progress');
    this.progressEl = el('p', 'panel__progress-text');
    progress.append(this.progressEl);

    inner.append(ribbon, head, decoded, stint, dossier, stats, progress);
    root.replaceChildren(inner);
  }

  private label(text: string): HTMLElement {
    const h = el('h2', 'eyebrow');
    h.textContent = text;
    return h;
  }

  render(card: Card, info: PanelInfo): void {
    const { def, rarity } = card;
    this.root.style.setProperty('--foil', rarity.foil);
    this.root.style.setProperty('--glow', rarity.glow);

    this.tierLabel.textContent = rarity.label;
    this.odds.textContent = info.oddsLabel;
    this.eyebrow.textContent = `Stint No.${info.squadNo} · ${def.confederation}`;
    this.nation.textContent = def.country;
    this.nameEl.textContent = def.localizedName;
    this.sayEl.textContent = def.etymology;
    this.bioEl.textContent = def.bio;
    this.statEl.textContent = STAT_LINE;

    this.chips.replaceChildren(
      ...def.props.map((p) => {
        const chip = el('span', 'chip');
        chip.textContent = p;
        return chip;
      }),
    );

    const copies =
      info.count > 1 ? ` You now hold ${info.count} copies of this sticker.` : '';
    this.progressEl.textContent = `Sticker ${info.owned} of ${info.total} collected.${copies}`;

    this.root.scrollTop = 0;
  }

  open(): void {
    this.root.dataset.state = 'open';
  }

  close(): void {
    this.root.dataset.state = 'closed';
    // Stop any in-flight stagger so killed tweens don't leak or pop on reopen.
    gsap.killTweensOf(this.root.querySelectorAll('.panel__inner > *'));
  }

  /** Stagger the lore blocks in as the panel slides open. */
  playIn(reduced: boolean): void {
    const blocks = this.root.querySelectorAll<HTMLElement>('.panel__inner > *');
    if (reduced) {
      gsap.set(blocks, { clearProps: 'all' });
      return;
    }
    gsap.fromTo(
      blocks,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.05,
        delay: 0.14,
        overwrite: true,
      },
    );
  }
}
