import { gsap } from 'gsap';
import type { CardFace } from '@/render/face/CardFace';
import type { MotionPrefs } from '@/ui/motionPrefs';

export interface RevealOpts {
  /** 0..1 rarity drama; scales glow + sweep emphasis. */
  drama: number;
  isNew: boolean;
  /** The white bloom flash element on the stage. */
  flash: HTMLElement;
  /** Guard so a stale timeline that finishes after a reset stays inert. */
  isActive: () => boolean;
}

/**
 * The card reveal: a confident rise + settle with a holographic light-sweep,
 * fronted by a bloom flash that masks the pack→card swap. (We use a rise/settle
 * rather than a literal 180° flip to avoid backface artifacts; it reads as an
 * earned reveal and is rock-solid across browsers.) Resolves when settled.
 */
export class RevealController {
  private tl: gsap.core.Timeline | null = null;
  private flash: HTMLElement | null = null;
  private activeResolve: (() => void) | null = null;

  constructor(private readonly motion: MotionPrefs) {}

  play(face: CardFace, opts: RevealOpts): Promise<void> {
    this.kill();
    const el = face.el;
    const sweep = el.querySelector<HTMLElement>('.card__sweep');
    el.dataset.new = String(opts.isNew);
    this.flash = opts.flash;

    return new Promise<void>((resolve) => {
      this.activeResolve = resolve;
      const done = (): void => {
        this.tl = null;
        this.flash = null;
        this.activeResolve = null;
        resolve();
      };
      // --- Reduced motion: a calm cross-fade, no travel, no sweep. ---
      if (this.motion.reduced) {
        gsap.set(el, { opacity: 0, '--cs': 0.98, '--ty': 0, '--rx': 0 });
        if (opts.isNew) gsap.set(el, { '--new-scale': 0 });
        const tl = gsap.timeline({ onComplete: done });
        tl.to(el, { opacity: 1, '--cs': 1, duration: 0.25, ease: 'power1.out' });
        if (opts.isNew) tl.to(el, { '--new-scale': 1, duration: 0.2, ease: 'power2.out' }, '>-0.05');
        this.tl = tl;
        return;
      }

      // --- Full motion. ---
      gsap.set(el, { opacity: 0, '--ty': 72, '--rx': 15, '--ry': 0, '--rz': -4, '--cs': 0.8, '--reveal-glow': 0 });
      if (sweep) gsap.set(sweep, { '--sweep-x': 200, opacity: 0 });
      if (opts.isNew) gsap.set(el, { '--new-scale': 0 });

      const glow = 8 + opts.drama * 22;
      const tl = gsap.timeline({ onComplete: done });

      // Bloom flash (covers the swap moment).
      tl.to(opts.flash, { opacity: 0.92, duration: 0.1, ease: 'power2.out' }, 0)
        .to(opts.flash, { opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.1);

      // Rise with one earned overshoot, then a clean expo settle (no jelly).
      tl.to(el, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 0.05)
        .to(el, { '--ty': 0, '--rx': 0, '--cs': 1, duration: 0.72, ease: 'back.out(1.4)' }, 0.08)
        .to(el, { '--rz': 0, duration: 0.85, ease: 'expo.out' }, 0.2);

      // Rim glow flares to the tier hue, then settles back.
      tl.to(el, { '--reveal-glow': glow, duration: 0.45, ease: 'power3.out' }, 0.16)
        .to(el, { '--reveal-glow': glow * 0.12, duration: 0.6, ease: 'power2.inOut' }, 0.62);

      // Holographic light-sweep glint across the fresh foil.
      if (sweep) {
        tl.to(sweep, { opacity: 1, duration: 0.1 }, 0.34)
          .to(sweep, { '--sweep-x': -120, duration: 0.6, ease: 'power2.inOut' }, 0.34)
          .to(sweep, { opacity: 0, duration: 0.2 }, 0.8);
      }

      // NEW! badge pop (a single, restrained overshoot).
      if (opts.isNew) {
        tl.to(el, { '--new-scale': 1.08, duration: 0.34, ease: 'back.out(2.2)' }, 0.62)
          .to(el, { '--new-scale': 1, duration: 0.2, ease: 'power2.out' }, 0.96);
      }

      this.tl = tl;
    });
  }

  /** Jump to the settled end state instantly (skip). */
  finish(): void {
    if (this.tl) this.tl.progress(1);
  }

  kill(): void {
    if (this.tl) {
      this.tl.kill();
      this.tl = null;
    }
    // Never leave the bloom flash stuck opaque over the UI after an interrupt.
    if (this.flash) {
      gsap.set(this.flash, { clearProps: 'opacity' });
      this.flash = null;
    }
    // Resolve the dangling reveal promise so its awaiting frame can unwind
    // (it hits the token guard and returns). Prevents leaked suspended stacks.
    if (this.activeResolve) {
      const resolve = this.activeResolve;
      this.activeResolve = null;
      resolve();
    }
  }
}
