import { gsap } from 'gsap';
import type { CardFace } from '@/render/face/CardFace';
import type { MotionPrefs } from '@/ui/motionPrefs';

/**
 * Reveal entrance style (dialled in via the Foil Lab; production defaults to
 * 'rise'):
 *  - rise — the shipped rise + settle from below
 *  - spin — multi-turn turntable (Y by default) decelerating to face forward
 *  - flip — forward tumble on the X axis
 *  - drop — falls in from above and slams to rest with a damped bounce
 *  - zoom — punches in oversized and decelerates to rest
 *  - deal — slides/arcs in from the side like a dealt card, leveling as it lands
 */
export type RevealStyle = 'rise' | 'spin' | 'flip' | 'drop' | 'zoom' | 'deal';

/**
 * Tunable entrance parameters. The defaults reproduce the shipped reveal
 * exactly, so omitting `params` (as production does) is a no-op. The dev-only
 * Foil Lab overrides these live to dial in variations.
 */
export interface RevealParams {
  style: RevealStyle;
  /** Full 360° turns before facing forward (spin style only). */
  spins: number;
  spinAxis: 'y' | 'x';
  /** Seconds for the spin to decelerate to forward-facing. */
  spinDuration: number;
  /** Start offset below the resting spot (px), rises to 0. */
  riseDistance: number;
  /** Overshoot factor of the rise (back.out amount; 1 = no overshoot). */
  riseOvershoot: number;
  /** Duration of the rise+settle (s). */
  riseDuration: number;
  /** Scale the card grows from. */
  startScale: number;
  /** Rim-glow flare peak = glowBase + drama * glowDramaScale. */
  glowBase: number;
  glowDramaScale: number;
  /** Light-sweep glint traverse (s). */
  sweepDuration: number;
  /** Peak opacity of the bloom flash masking the pack→card swap. */
  flashPeak: number;
}

export const REVEAL_DEFAULTS: RevealParams = {
  style: 'spin',
  spins: 5,
  spinAxis: 'y',
  spinDuration: 1.4,
  riseDistance: 72,
  riseOvershoot: 1.9,
  riseDuration: 1.5,
  startScale: 0.8,
  glowBase: 30,
  glowDramaScale: 22,
  sweepDuration: 1.5,
  flashPeak: 0.08,
};

export interface RevealOpts {
  /** 0..1 rarity drama; scales glow + sweep emphasis. */
  drama: number;
  isNew: boolean;
  /** The white bloom flash element on the stage. */
  flash: HTMLElement;
  /** Guard so a stale timeline that finishes after a reset stays inert. */
  isActive: () => boolean;
  /** Optional entrance tuning (Foil Lab). Merged over REVEAL_DEFAULTS. */
  params?: Partial<RevealParams>;
}

/**
 * The card reveal: a confident rise + settle with a holographic light-sweep,
 * fronted by a bloom flash that masks the pack→card swap. The default ('rise')
 * uses a rise/settle rather than a literal 180° flip to avoid backface
 * artifacts; the optional 'spin' style adds a fast, decelerating multi-turn
 * rotation (the brief back-faces pass behind the extended bloom). Resolves when
 * settled.
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
    const p: RevealParams = { ...REVEAL_DEFAULTS, ...opts.params };

    return new Promise<void>((resolve) => {
      this.activeResolve = resolve;
      const done = (): void => {
        this.tl = null;
        this.flash = null;
        this.activeResolve = null;
        resolve();
      };
      // --- Reduced motion: a calm cross-fade, no travel, no sweep, no spin. ---
      if (this.motion.reduced) {
        gsap.set(el, { opacity: 0, x: 0, y: 0, '--cs': 0.98, '--ty': 0, '--rx': 0, '--ry': 0 });
        if (opts.isNew) gsap.set(el, { '--new-scale': 0 });
        const tl = gsap.timeline({ onComplete: done });
        tl.to(el, { opacity: 1, '--cs': 1, duration: 0.25, ease: 'power1.out' });
        if (opts.isNew) tl.to(el, { '--new-scale': 1, duration: 0.2, ease: 'power2.out' }, '>-0.05');
        this.tl = tl;
        return;
      }

      // --- Full motion. Each style defines its own start pose + entrance
      // tween(s); the shared beats (flash, rim glow, light-sweep, NEW badge)
      // layer on top and the settled end state is always identical. ---
      const turns = Math.max(0, Math.round(p.spins));
      const settle = `back.out(${p.riseOvershoot})`;

      // Base pose = the settled end state; each style overrides its start.
      const start: gsap.TweenVars = {
        opacity: 0,
        x: 0,
        y: 0,
        '--ty': 0,
        '--rx': 0,
        '--ry': 0,
        '--rz': 0,
        '--cs': 1,
        '--reveal-glow': 0,
      };
      let entrance: (tl: gsap.core.Timeline) => void;
      let flashFade = 0.34;

      switch (p.style) {
        case 'spin':
        case 'flip': {
          // spin = turntable (Y by default); flip = forward tumble (locked X).
          const axisVar = p.style === 'flip' || p.spinAxis === 'x' ? '--rx' : '--ry';
          start['--ty'] = p.riseDistance;
          start['--cs'] = p.startScale;
          start[axisVar] = 360 * turns;
          if (axisVar === '--ry') start['--rx'] = 15; // keep the lean for Y-spin
          flashFade = Math.max(0.34, p.spinDuration * 0.7);
          entrance = (tl) => {
            const rise: gsap.TweenVars = { '--ty': 0, '--cs': 1, duration: p.riseDuration, ease: settle };
            if (axisVar === '--ry') rise['--rx'] = 0;
            tl.to(el, rise, 0.08);
            tl.to(el, { [axisVar]: 0, duration: p.spinDuration, ease: 'power3.out' }, 0.06);
          };
          break;
        }
        case 'drop': {
          // Falls in from above and slams to rest with a damped bounce.
          start['--ty'] = -(p.riseDistance * 2.2);
          start['--cs'] = 1.06;
          flashFade = 0.28;
          entrance = (tl) => {
            tl.to(
              el,
              {
                '--ty': 0,
                '--cs': 1,
                duration: Math.max(0.4, p.riseDuration),
                ease: `back.out(${Math.max(1.8, p.riseOvershoot + 0.6)})`,
              },
              0.06,
            );
          };
          break;
        }
        case 'zoom': {
          // Punches in oversized and decelerates to rest.
          start['--cs'] = 1.55;
          entrance = (tl) => {
            tl.to(el, { '--cs': 1, duration: p.riseDuration, ease: settle }, 0.06);
          };
          break;
        }
        case 'deal': {
          // Slides/arcs in from the side like a dealt card, leveling as it lands.
          start.x = -240;
          start['--ty'] = 28;
          start['--rz'] = -8;
          start['--cs'] = 0.96;
          entrance = (tl) => {
            tl.to(
              el,
              { x: 0, '--ty': 0, '--rz': 0, '--cs': 1, duration: Math.max(0.5, p.riseDuration), ease: 'power3.out' },
              0.06,
            );
          };
          break;
        }
        case 'rise':
        default: {
          start['--ty'] = p.riseDistance;
          start['--rx'] = 15;
          start['--rz'] = -4;
          start['--cs'] = p.startScale;
          entrance = (tl) => {
            tl.to(el, { '--ty': 0, '--rx': 0, '--cs': 1, duration: p.riseDuration, ease: settle }, 0.08);
            tl.to(el, { '--rz': 0, duration: 0.85, ease: 'expo.out' }, 0.2);
          };
          break;
        }
      }

      gsap.set(el, start);
      if (sweep) gsap.set(sweep, { '--sweep-x': 200, opacity: 0 });
      if (opts.isNew) gsap.set(el, { '--new-scale': 0 });

      const glow = p.glowBase + opts.drama * p.glowDramaScale;
      const tl = gsap.timeline({ onComplete: done });

      // Bloom flash (covers the swap moment; held longer for spin/flip so the
      // brief mirrored back-faces pass behind the bloom).
      tl.to(opts.flash, { opacity: p.flashPeak, duration: 0.1, ease: 'power2.out' }, 0)
        .to(opts.flash, { opacity: 0, duration: flashFade, ease: 'power2.in' }, 0.1);

      // Fade in, then run the chosen style's entrance.
      tl.to(el, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 0.05);
      entrance(tl);

      // Rim glow flares to the tier hue, then settles back.
      tl.to(el, { '--reveal-glow': glow, duration: 0.45, ease: 'power3.out' }, 0.16)
        .to(el, { '--reveal-glow': glow * 0.12, duration: 0.6, ease: 'power2.inOut' }, 0.62);

      // Holographic light-sweep glint across the fresh foil.
      if (sweep) {
        tl.to(sweep, { opacity: 1, duration: 0.1 }, 0.34)
          .to(sweep, { '--sweep-x': -120, duration: p.sweepDuration, ease: 'power2.inOut' }, 0.34)
          .to(sweep, { opacity: 0, duration: 0.2 }, 0.34 + p.sweepDuration * 0.75);
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
