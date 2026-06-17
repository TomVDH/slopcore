import { gsap } from 'gsap';
import { el } from '@/render/face/CardFace';
import type { MotionPrefs } from '@/ui/motionPrefs';

export interface PackCallbacks {
  /** Fired once when the rip begins (pointerdown / click / Enter) — start the pull. */
  onArm: () => void;
  /** Tear progress 0..1 while dragging or auto-ripping (drives WebGL + foil). */
  onProgress: (p: number) => void;
  /** Fired when the rip completes — trigger burst + reveal. */
  onComplete: () => void;
  /** Hover energy 0..1 for the foil shimmer. */
  onHover?: (energy: number) => void;
}

/**
 * The sealed foil pack and its rip gesture. Three ways to open, all converging
 * on the same payoff: drag past a threshold (or flick), a plain click, or
 * Enter/Space for keyboard users. Emits arm → progress* → complete.
 */
export class PackView {
  readonly el: HTMLDivElement;
  private enabled = false;
  private armed = false;
  private committed = false;
  private dragging = false;
  private moved = false;
  private startX = 0;
  private startY = 0;
  private p = 0;
  private autoTween: gsap.core.Tween | null = null;
  private floatTl: gsap.core.Timeline | null = null;

  constructor(
    private readonly cb: PackCallbacks,
    private readonly motion: MotionPrefs,
  ) {
    this.el = el('div', 'pack');
    this.el.setAttribute('role', 'button');
    this.el.tabIndex = 0;
    this.el.setAttribute('aria-label', 'Rip open the foil pack');

    const sheen = el('div', 'pack__sheen');
    const grain = el('div', 'pack__grain');
    const year = el('div', 'pack__year');
    year.textContent = '26';
    const tab = el('div', 'pack__tab');
    const tabLabel = el('div', 'pack__tab-label');
    tabLabel.textContent = 'TEAR HERE';
    const crest = el('div', 'pack__crest');
    const mark = el('div', 'crest__mark');
    mark.textContent = 'ZENA FC';
    const sub = el('div', 'crest__sub');
    sub.textContent = "Sticker Pack '26";
    crest.append(mark, sub);

    this.el.append(sheen, grain, year, tab, tabLabel, crest);

    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    this.el.addEventListener('keydown', this.onKey);
    this.el.addEventListener('pointerenter', this.onEnter);
    this.el.addEventListener('pointerleave', this.onHoverLeave);
  }

  enable(): void {
    this.enabled = true;
    this.committed = false;
    this.armed = false;
    this.dragging = false;
    this.moved = false;
    this.p = 0;
    this.cb.onProgress(0);
    this.setVisual(0);
    this.el.setAttribute('aria-disabled', 'false');
    this.startFloat();
  }

  disable(): void {
    this.enabled = false;
    this.el.setAttribute('aria-disabled', 'true');
    this.el.classList.remove('is-hover');
    this.cb.onHover?.(0);
    this.killAuto();
    this.killFloat();
  }

  /** Programmatic rip (the "Rip Open Pack" CTA). Same payoff as a click. */
  rip(): void {
    if (!this.enabled || this.committed) return;
    this.arm();
    this.autoRip();
  }

  private tearLength(): number {
    return Math.max(80, this.el.getBoundingClientRect().height * 0.55);
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || this.committed) return;
    this.arm();
    this.dragging = true;
    this.moved = false;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.el.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dist = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
    if (dist > 4) this.moved = true;
    this.p = Math.min(1, dist / this.tearLength());
    this.cb.onProgress(this.p);
    this.setVisual(this.p);
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be released
    }
    if (!this.moved) {
      this.autoRip();
    } else if (this.p >= 0.5) {
      this.commit();
    } else {
      this.snapBack();
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    if (!this.enabled || this.committed) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.arm();
      this.autoRip();
    }
  };

  private arm(): void {
    if (this.armed) return;
    this.armed = true;
    this.killFloat();
    gsap.to(this.el, { '--pack-float': 0, duration: 0.2, ease: 'power2.out', overwrite: true });
    this.el.classList.remove('is-hover');
    this.cb.onArm();
  }

  private onEnter = (): void => {
    if (!this.enabled || this.committed) return;
    this.el.classList.add('is-hover');
    this.cb.onHover?.(1);
  };

  private onHoverLeave = (): void => {
    this.el.classList.remove('is-hover');
    this.cb.onHover?.(0);
  };

  private startFloat(): void {
    this.killFloat();
    gsap.set(this.el, { '--pack-float': 0, '--pack-rot': 0 });
    if (this.motion.reduced) return;
    this.floatTl = gsap.timeline({ repeat: -1, yoyo: true });
    this.floatTl
      .to(this.el, { '--pack-float': -7, duration: 2.8, ease: 'sine.inOut' }, 0)
      .to(this.el, { '--pack-rot': 1.4, duration: 3.6, ease: 'sine.inOut' }, 0);
  }

  private killFloat(): void {
    if (this.floatTl) {
      this.floatTl.kill();
      this.floatTl = null;
    }
  }

  private autoRip(): void {
    this.killAuto();
    this.committed = true;
    const proxy = { v: this.p };
    this.autoTween = gsap.to(proxy, {
      v: 1,
      duration: 0.34,
      ease: 'power2.in',
      onUpdate: () => {
        this.cb.onProgress(proxy.v);
        this.setVisual(proxy.v);
      },
      onComplete: () => this.cb.onComplete(),
    });
  }

  private commit(): void {
    this.killAuto();
    this.committed = true;
    const proxy = { v: this.p };
    this.autoTween = gsap.to(proxy, {
      v: 1,
      duration: 0.16,
      ease: 'power2.out',
      onUpdate: () => {
        this.cb.onProgress(proxy.v);
        this.setVisual(proxy.v);
      },
      onComplete: () => this.cb.onComplete(),
    });
  }

  private snapBack(): void {
    this.armed = false;
    const proxy = { v: this.p };
    gsap.to(proxy, {
      v: 0,
      duration: 0.24,
      ease: 'power3.out',
      onUpdate: () => {
        this.cb.onProgress(proxy.v);
        this.setVisual(proxy.v);
      },
    });
  }

  private setVisual(p: number): void {
    this.el.style.setProperty('--pack-rot', (p * 3).toFixed(2));
    this.el.style.setProperty('--pack-ty', (p * -8).toFixed(2));
    this.el.style.setProperty('--pack-s', (1 - p * 0.04).toFixed(3));
  }

  private killAuto(): void {
    if (this.autoTween) {
      this.autoTween.kill();
      this.autoTween = null;
    }
  }
}
