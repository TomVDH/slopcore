import type { MotionPrefs } from '@/ui/motionPrefs';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Pointer-tracking holographic tilt + iridescence. A single rAF loop damps
 * toward the latest pointer (no per-event DOM writes, no scroll listener) and
 * writes the unitless CSS vars the card reads, including the amplified
 * `--posx/--posy` that parallax the rainbow. When the pointer is idle it falls
 * into a slow auto-orbit so the foil keeps shimmering without a mouse / on
 * touch. Under reduced motion it stays flat with a faint static sheen.
 */
export class HoloController {
  private target: HTMLElement | null = null;
  private raf = 0;
  // Damped current values.
  private mx = 50;
  private my = 50;
  private rx = 0;
  private ry = 0;
  private pfc = 0;
  private posx = 50;
  private posy = 50;
  // Latest pointer targets.
  private tMx = 50;
  private tMy = 50;
  private tRx = 0;
  private tRy = 0;
  private tPfc = 0.4;
  private tPosx = 50;
  private tPosy = 50;
  private readonly maxTilt = 14;
  private lastMove = 0;
  private idlePhase = 0;
  private hasPointer = false;

  constructor(private readonly motion: MotionPrefs) {}

  attach(el: HTMLElement): void {
    this.detach();
    this.target = el;
    el.classList.add('is-interactive');
    el.tabIndex = 0;
    el.style.setProperty('--cs', '1');

    if (this.motion.reduced) {
      // Static, slightly off-centre iridescence so it still reads as "alive".
      el.style.setProperty('--mx', '54');
      el.style.setProperty('--my', '40');
      el.style.setProperty('--posx', '60');
      el.style.setProperty('--posy', '42');
      el.style.setProperty('--pfc', '0.3');
      return;
    }

    this.hasPointer = false;
    this.lastMove = performance.now();
    window.addEventListener('pointermove', this.onMove, { passive: true });
    el.addEventListener('pointerleave', this.onLeave);
    this.raf = requestAnimationFrame(this.loop);
  }

  detach(): void {
    if (this.target) {
      this.target.classList.remove('is-interactive');
      this.target.removeEventListener('pointerleave', this.onLeave);
      this.target = null;
    }
    window.removeEventListener('pointermove', this.onMove);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.target) return;
    const r = this.target.getBoundingClientRect();
    if (r.width === 0) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const cx = clamp(px - 0.5, -0.5, 0.5);
    const cy = clamp(py - 0.5, -0.5, 0.5);
    this.hasPointer = true;
    this.lastMove = performance.now();
    this.tMx = clamp(px, 0, 1) * 100;
    this.tMy = clamp(py, 0, 1) * 100;
    this.tRy = cx * 2 * this.maxTilt;
    this.tRx = -cy * 2 * this.maxTilt;
    this.tPfc = Math.min(1, Math.hypot(cx, cy) * 2);
    this.tPosx = 50 + cx * 130;
    this.tPosy = 50 + cy * 130;
  };

  private onLeave = (): void => {
    this.hasPointer = false;
  };

  private loop = (): void => {
    if (!this.target) return;
    const idle = !this.hasPointer || performance.now() - this.lastMove > 1600;
    if (idle) {
      // Gentle auto-orbit keeps the foil alive without a mouse / on touch.
      this.idlePhase += 0.012;
      const ox = Math.cos(this.idlePhase);
      const oy = Math.sin(this.idlePhase * 1.3);
      this.tMx = 50 + ox * 20;
      this.tMy = 42 + oy * 16;
      this.tRy = ox * 5;
      this.tRx = -oy * 4;
      this.tPfc = 0.4;
      this.tPosx = 50 + ox * 40;
      this.tPosy = 50 + oy * 34;
    }

    const k = idle ? 0.05 : 0.14;
    this.rx += (this.tRx - this.rx) * k;
    this.ry += (this.tRy - this.ry) * k;
    this.pfc += (this.tPfc - this.pfc) * k;
    this.mx += (this.tMx - this.mx) * k;
    this.my += (this.tMy - this.my) * k;
    this.posx += (this.tPosx - this.posx) * k;
    this.posy += (this.tPosy - this.posy) * k;

    const s = this.target.style;
    s.setProperty('--rx', this.rx.toFixed(2));
    s.setProperty('--ry', this.ry.toFixed(2));
    s.setProperty('--mx', this.mx.toFixed(1));
    s.setProperty('--my', this.my.toFixed(1));
    s.setProperty('--posx', this.posx.toFixed(1));
    s.setProperty('--posy', this.posy.toFixed(1));
    s.setProperty('--pfc', this.pfc.toFixed(3));

    this.raf = requestAnimationFrame(this.loop);
  };
}
