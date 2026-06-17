import { gsap } from 'gsap';
import type { CountryCode } from '@/domain/types';
import { allNations, getNation } from '@/domain/nations';
import { getImages } from '@/assets/images';
import { RARITY } from '@/domain/rarity';
import type { CollectionState } from '@/collection/collection';
import type { MotionPrefs } from '@/ui/motionPrefs';
import { el } from '@/render/face/CardFace';

interface SlotRefs {
  button: HTMLButtonElement;
  img: HTMLImageElement;
  dupe: HTMLElement;
  loaded: boolean;
  targetTimeout?: number;
}

/**
 * The sticker-album strip. Fixed 48 slots in alphabetical order. Need slots are
 * ghosted; owned slots show a thumb with a tier-coloured ring and a NEW flag /
 * dupe pip. Thumbs only load once owned (need slots never fetch). Roving
 * tabindex keeps it keyboard-navigable without 48 tab stops.
 */
export class BinderView {
  private readonly rail: HTMLElement;
  private readonly slots = new Map<CountryCode, SlotRefs>();
  private readonly order: CountryCode[] = [];
  private readonly titleCount: HTMLElement;
  private readonly collapseBtn: HTMLButtonElement;
  private lastNew: CountryCode | null = null;
  private focusIndex = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly collection: CollectionState,
    private readonly motion: MotionPrefs,
    private readonly onReview: (code: CountryCode) => void,
  ) {
    const sorted = [...allNations()].sort((a, b) => a.country.localeCompare(b.country));

    const bar = el('div', 'binder__bar');
    const title = el('div', 'binder__title');
    const titleMark = el('b');
    titleMark.textContent = 'My Album';
    const titleCount = el('span', 'mono');
    titleCount.textContent = `0 / ${sorted.length}`;
    title.append(titleMark, titleCount);
    this.collapseBtn = el('button', 'binder__collapse');
    this.collapseBtn.type = 'button';
    this.collapseBtn.textContent = 'Hide';
    this.collapseBtn.addEventListener('click', () => this.toggle());
    bar.append(title, this.collapseBtn);

    this.rail = el('div', 'binder__rail');
    this.rail.setAttribute('role', 'list');
    this.rail.addEventListener('keydown', (e) => this.onKey(e));

    for (const def of sorted) {
      this.order.push(def.code);
      const button = el('button', 'slot');
      button.type = 'button';
      button.dataset.code = def.code;
      button.dataset.state = 'need';
      button.dataset.new = 'false';
      button.tabIndex = this.order.length === 1 ? 0 : -1;
      button.setAttribute('role', 'listitem');
      button.style.setProperty('--slot-foil', RARITY[def.rarity].foil);

      const ghost = el('span', 'slot__ghost');
      const flag = el('span', 'flag');
      flag.textContent = def.flagEmoji;
      const code = el('span');
      code.textContent = def.code;
      ghost.append(flag, code);

      const img = el('img', 'slot__img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';

      const newBadge = el('span', 'slot__new');
      newBadge.textContent = 'NEW';
      const dupe = el('span', 'slot__dupe');

      button.append(ghost, img, newBadge, dupe);
      button.addEventListener('click', () => this.activate(def.code));

      this.rail.append(button);
      this.slots.set(def.code, { button, img, dupe, loaded: false });
      this.updateLabel(def.code);
    }

    this.root.dataset.collapsed = 'false';
    this.root.replaceChildren(bar, this.rail);
    this.titleCount = titleCount;
  }

  /** Fill the slot for a freshly pulled card; fly a clone into it, pop, highlight. */
  fileCard(code: CountryCode, isNew: boolean, count: number, fromRect?: DOMRect): void {
    this.clearNew();
    const refs = this.slots.get(code);
    if (!refs) return;

    if (!refs.loaded) {
      refs.img.src = getImages(code).thumb.webp;
      refs.loaded = true;
    }
    refs.button.dataset.state = count > 1 ? 'dupe' : 'got';
    refs.dupe.textContent = count > 1 ? `×${count}` : '';
    this.updateLabel(code);

    if (isNew) {
      refs.button.dataset.new = 'true';
      this.lastNew = code;
    }

    // Instant scroll so the slot rect is final before the clone flies to it.
    refs.button.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
    if (refs.targetTimeout) window.clearTimeout(refs.targetTimeout);
    refs.button.classList.add('is-target');
    refs.targetTimeout = window.setTimeout(() => {
      refs.button.classList.remove('is-target');
      refs.targetTimeout = undefined;
    }, 1600);

    if (fromRect && !this.motion.reduced) {
      this.flyTo(code, fromRect);
    } else {
      this.popSlot(code);
    }
    this.refreshCount();
  }

  private popSlot(code: CountryCode): void {
    if (this.motion.reduced) return;
    const refs = this.slots.get(code);
    if (!refs) return;
    gsap.fromTo(
      refs.button,
      { scale: 1 },
      { scale: 1.12, duration: 0.24, ease: 'back.out(1.9)', yoyo: true, repeat: 1 },
    );
  }

  /** Fly a thumb clone from the revealed-card rect into the album slot (FLIP-style). */
  private flyTo(code: CountryCode, fromRect: DOMRect): void {
    const refs = this.slots.get(code);
    if (!refs) return;
    const slotRect = refs.button.getBoundingClientRect();
    if (slotRect.width === 0) {
      this.popSlot(code);
      return;
    }
    // Lock the rail so a stray scroll/flick can't shift the target mid-flight.
    this.rail.style.pointerEvents = 'none';
    const clone = el('div');
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${slotRect.left}px`,
      top: `${slotRect.top}px`,
      width: `${slotRect.width}px`,
      height: `${slotRect.height}px`,
      borderRadius: '10px',
      backgroundImage: `url("${getImages(code).thumb.webp}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      zIndex: '90',
      pointerEvents: 'none',
      transformOrigin: 'top left',
      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
    });
    document.body.append(clone);
    gsap.fromTo(
      clone,
      {
        x: fromRect.left - slotRect.left,
        y: fromRect.top - slotRect.top,
        scaleX: fromRect.width / slotRect.width,
        scaleY: fromRect.height / slotRect.height,
      },
      {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.62,
        ease: 'power3.inOut',
        onComplete: () => {
          clone.remove();
          this.rail.style.pointerEvents = '';
          this.popSlot(code);
        },
      },
    );
  }

  /** Demote any NEW flag (called when the next pack is opened). */
  clearNew(): void {
    if (this.lastNew) {
      const prev = this.slots.get(this.lastNew);
      if (prev) prev.button.dataset.new = 'false';
      this.lastNew = null;
    }
  }

  private activate(code: CountryCode): void {
    if (this.collection.has(code)) {
      this.onReview(code);
    } else if (!this.motion.reduced) {
      const refs = this.slots.get(code);
      if (refs) gsap.fromTo(refs.button, { x: -3 }, { x: 0, duration: 0.3, ease: 'elastic.out(1, 0.3)' });
    }
  }

  private updateLabel(code: CountryCode): void {
    const refs = this.slots.get(code);
    if (!refs) return;
    const def = getNation(code);
    const count = this.collection.count(code);
    const status =
      count === 0 ? 'not collected yet' : count === 1 ? 'collected' : `collected, ${count} copies`;
    refs.button.setAttribute('aria-label', `${def.country}, ${status}`);
  }

  private refreshCount(): void {
    const p = this.collection.progress();
    this.titleCount.textContent = `${p.owned} / ${p.total}`;
  }

  /** Collapse / expand the album rail (also driven by the header Album button). */
  toggle(): void {
    const collapsed = this.root.dataset.collapsed === 'true';
    this.root.dataset.collapsed = collapsed ? 'false' : 'true';
    this.collapseBtn.textContent = collapsed ? 'Hide' : 'Show';
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const last = this.order.length - 1;
    if (e.key === 'ArrowRight') this.focusIndex = Math.min(last, this.focusIndex + 1);
    else if (e.key === 'ArrowLeft') this.focusIndex = Math.max(0, this.focusIndex - 1);
    else if (e.key === 'Home') this.focusIndex = 0;
    else this.focusIndex = last;

    this.order.forEach((code, i) => {
      const refs = this.slots.get(code);
      if (refs) refs.button.tabIndex = i === this.focusIndex ? 0 : -1;
    });
    const code = this.order[this.focusIndex];
    if (code) this.slots.get(code)?.button.focus();
  }
}
