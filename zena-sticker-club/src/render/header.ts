import { el } from '@/render/face/CardFace';
import { TOTAL_NATIONS } from '@/domain/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Top bar: wordmark + collection meter (count + progress ring) + album toggle. */
export class HeaderView {
  private readonly countNum: Text;
  private readonly ringFill: SVGCircleElement;
  private readonly circumference: number;

  constructor(root: HTMLElement, onToggleBinder: () => void) {
    const mark = el('div', 'wordmark');
    const brand = el('span', 'wordmark__brand');
    brand.textContent = 'ZENA FC';
    const sub = el('span', 'wordmark__sub');
    sub.textContent = "Sticker Club '26";
    mark.append(brand, sub);

    const meter = el('div', 'header__meter');

    const count = el('span', 'meter__count');
    this.countNum = document.createTextNode('0');
    const small = document.createElement('small');
    small.textContent = ` / ${TOTAL_NATIONS}`;
    count.append(this.countNum, small);

    const r = 11;
    this.circumference = 2 * Math.PI * r;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'meter__ring');
    svg.setAttribute('viewBox', '0 0 26 26');
    svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('class', 'track');
    track.setAttribute('cx', '13');
    track.setAttribute('cy', '13');
    track.setAttribute('r', String(r));
    this.ringFill = document.createElementNS(SVG_NS, 'circle');
    this.ringFill.setAttribute('class', 'fill');
    this.ringFill.setAttribute('cx', '13');
    this.ringFill.setAttribute('cy', '13');
    this.ringFill.setAttribute('r', String(r));
    this.ringFill.style.strokeDasharray = String(this.circumference);
    this.ringFill.style.strokeDashoffset = String(this.circumference);
    svg.append(track, this.ringFill);

    const toggle = el('button', 'binder-toggle');
    toggle.type = 'button';
    toggle.textContent = 'Album';
    toggle.setAttribute('aria-label', 'Toggle album');
    toggle.addEventListener('click', onToggleBinder);

    meter.append(count, svg, toggle);
    root.replaceChildren(mark, meter);
  }

  setProgress(owned: number, total: number): void {
    this.countNum.nodeValue = String(owned);
    const pct = total > 0 ? owned / total : 0;
    this.ringFill.style.strokeDashoffset = String(this.circumference * (1 - pct));
  }
}
