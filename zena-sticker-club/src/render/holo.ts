import type { MotionPrefs } from '@/ui/motionPrefs';
import { HOLO_DEFAULTS, applyHoloVars } from '@/render/holoConfig';
import type { HoloParams } from '@/render/holoConfig';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Holographic-foil controller — a faithful port of the reference rAF motion
 * engine. Pointer is card-local (listens on the untransformed wrap so the tilt
 * never makes the hit-area flicker); each frame eases current→target with
 * framerate-independent exponential smoothing and writes the per-frame CSS vars.
 * At rest the foil fades to ~`iri * 0.4`; on hover it brightens and the card
 * tilts. Under reduced motion it holds a faint static sheen with no loop.
 */
export class HoloController {
  private target: HTMLElement | null = null;
  private wrap: HTMLElement | null = null;
  private raf = 0;
  private last = 0;
  private params: HoloParams;

  // pointer targets and eased current values, all in [-0.5, 0.5] (active 0..1)
  private tx = 0;
  private ty = 0;
  private tActive = 0;
  private cx = 0;
  private cy = 0;
  private cActive = 0;

  constructor(
    private readonly motion: MotionPrefs,
    params?: Partial<HoloParams>,
  ) {
    this.params = { ...HOLO_DEFAULTS, ...params };
  }

  attach(el: HTMLElement): void {
    this.detach();
    this.target = el;
    this.wrap = el.parentElement ?? el;
    el.classList.add('is-interactive');
    el.tabIndex = 0;
    applyHoloVars(el, this.params);

    if (this.motion.reduced) {
      // Faint static foil, no tilt, no loop.
      const s = el.style;
      s.setProperty('--rx', '0');
      s.setProperty('--ry', '0');
      s.setProperty('--cs', '1');
      s.setProperty('--mx', '58');
      s.setProperty('--my', '40');
      s.setProperty('--hue', '180');
      s.setProperty('--active', '0.45');
      return;
    }

    this.cx = this.cy = this.cActive = 0;
    this.tx = this.ty = this.tActive = 0;
    this.write(0, 0, 0);
    this.wrap.addEventListener('pointermove', this.onMove, { passive: true });
    this.wrap.addEventListener('pointerleave', this.onLeave);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  detach(): void {
    if (this.wrap) {
      this.wrap.removeEventListener('pointermove', this.onMove);
      this.wrap.removeEventListener('pointerleave', this.onLeave);
    }
    if (this.target) this.target.classList.remove('is-interactive');
    this.target = null;
    this.wrap = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Live-update foil params (used by the lab); re-applies the static CSS vars. */
  setParams(patch: Partial<HoloParams>): void {
    this.params = { ...this.params, ...patch };
    if (this.target) applyHoloVars(this.target, this.params);
  }

  getParams(): HoloParams {
    return { ...this.params };
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    if (r.width === 0) return;
    this.tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
    this.ty = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
    this.tActive = 1;
  };

  private onLeave = (): void => {
    this.tx = 0;
    this.ty = 0;
    this.tActive = 0;
  };

  private loop = (now: number): void => {
    if (!this.target) return;
    const dt = Math.min(50, now - this.last) || 16;
    this.last = now;
    const base = clamp(this.params.smoothing, 0.02, 0.5);
    const k = 1 - Math.pow(1 - base, dt / 16.67);
    this.cx += (this.tx - this.cx) * k;
    this.cy += (this.ty - this.cy) * k;
    this.cActive += (this.tActive - this.cActive) * k * 0.7; // glow eases a touch slower
    this.write(this.cx, this.cy, this.cActive);
    this.raf = requestAnimationFrame(this.loop);
  };

  private write(px: number, py: number, active: number): void {
    const el = this.target;
    if (!el) return;
    const tilt = this.params.tilt;
    const s = el.style;
    s.setProperty('--ry', (px * tilt).toFixed(3));
    s.setProperty('--rx', (-py * tilt).toFixed(3));
    s.setProperty('--mx', (px * 100 + 50).toFixed(2));
    s.setProperty('--my', (py * 100 + 50).toFixed(2));
    s.setProperty('--hue', (180 + px * 140).toFixed(1));
    s.setProperty('--active', active.toFixed(4));
    s.setProperty('--cs', (1 + (this.params.scaleHover - 1) * active).toFixed(4));
  }
}
