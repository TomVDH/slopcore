/**
 * Brut direction canvas: a poster-weight deco sunburst.
 *
 * A half-risen sun low in the viewport throws 28 solid tapered wedges
 * that fan open on arrival, breathe, lean toward the pointer, and spin
 * with scroll velocity. Three stepped dashed arcs and a drift of
 * champagne dust (with the odd cinnabar ember) fill the field. A click
 * (or tap) anywhere kicks the sun: rays flare, dust ignites.
 *
 * Energy is coupled to native scroll, read inside the single rAF loop
 * (no scroll listeners): full at the hero, dimmed through the midband,
 * re-ignited at the footer. Rendering pauses while fully covered.
 * Static mode (reduced motion or ?still) draws exactly one open frame.
 */

interface Mote {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  tw: number;
  ember: boolean;
}

export interface RaysHandle {
  kick: () => void;
}

const TAU = Math.PI * 2;
const RAY_COUNT = 28;
const MOTE_COUNT = 90;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

export function initRays(
  canvas: HTMLCanvasElement,
  staticMode: boolean,
  onTick?: (dt: number, scrollVel: number) => void,
): RaysHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { kick: () => undefined };

  let w = 0;
  let h = 0;
  let dpr = 1;
  let energy = 1;
  let pointerBias = 0; // -1 left .. 1 right, eased
  let pointerTarget = 0;
  let raf = 0;
  let born = -1; // first tick timestamp, drives the fan-open
  let lastT = -1;
  let lastY = -1;
  let spin = 0;
  let kick = 0;

  const raySeed = Array.from({ length: RAY_COUNT }, (_, i) => {
    const g = Math.sin(i * 127.1) * 43758.5453;
    return g - Math.floor(g);
  });

  const motes: Mote[] = Array.from({ length: MOTE_COUNT }, (_, i) => {
    const g = (k: number) => {
      const v = Math.sin(i * 311.7 + k * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };
    return {
      x: g(1),
      y: g(2),
      r: 0.5 + g(3) * 1.3,
      vy: 6 + g(4) * 14,
      vx: (g(5) - 0.5) * 5,
      tw: g(6) * TAU,
      ember: g(7) > 0.94,
    };
  });

  function resize(): void {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function scrollEnergy(): number {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    const heroE = clamp01(1 - y / (vh * 0.9));
    const footE = clamp01(1 - (docH - vh - y) / (vh * 0.9));
    return Math.max(0.14, heroE, footE);
  }

  function draw(t: number, open: number): void {
    const c = ctx!;
    c.clearRect(0, 0, w, h);

    const E = energy;
    if (E < 0.05) return;

    const fx = w * 0.5;
    const fy = h * 0.94;
    const discR = Math.min(w, h) * 0.13;
    const flare = 1 + kick * 0.9;

    // Fan of solid tapered wedges, sweeping open from vertical.
    const sway = Math.sin(t * 0.00021) * 0.03 + spin;
    for (let i = 0; i < RAY_COUNT; i++) {
      const f = i / (RAY_COUNT - 1);
      const spread = (f - 0.5) * Math.PI * open;
      const angle = Math.PI * 1.5 + spread + sway;
      const long = i % 2 === 0;
      const len = (long ? h * 0.95 : h * 0.5) * (0.82 + raySeed[i] * 0.3) * (0.35 + 0.65 * open);

      const shimmer = 0.5 + 0.5 * Math.sin(t * 0.00045 + raySeed[i] * 9.0 + i * 0.7);
      const lean = Math.cos(angle);
      const pointerBoost = Math.max(0, 1 - Math.abs(lean - pointerBias) * 1.5);
      const alpha = E * flare * (0.07 + shimmer * 0.1 + pointerBoost * 0.12);

      const halfW = ((long ? 0.026 : 0.015) + raySeed[i] * 0.008) * (0.4 + 0.6 * open);
      const a0 = angle - halfW;
      const a1 = angle + halfW;
      const bx = fx + Math.cos(angle) * discR * 0.92;
      const by = fy + Math.sin(angle) * discR * 0.92;
      const tx = fx + Math.cos(angle) * len;
      const ty = fy + Math.sin(angle) * len;

      const grad = c.createLinearGradient(bx, by, tx, ty);
      grad.addColorStop(0, `rgba(215, 180, 112, ${alpha})`);
      grad.addColorStop(0.75, `rgba(215, 180, 112, ${alpha * 0.55})`);
      grad.addColorStop(1, "rgba(215, 180, 112, 0)");

      c.beginPath();
      c.moveTo(fx + Math.cos(a0) * discR * 0.92, fy + Math.sin(a0) * discR * 0.92);
      c.lineTo(tx, ty);
      c.lineTo(fx + Math.cos(a1) * discR * 0.92, fy + Math.sin(a1) * discR * 0.92);
      c.closePath();
      c.fillStyle = grad;
      c.fill();
    }

    // Sun disc with a soft halo.
    const halo = c.createRadialGradient(fx, fy, discR * 0.2, fx, fy, discR * 3.2);
    halo.addColorStop(0, `rgba(215, 180, 112, ${0.36 * E * flare})`);
    halo.addColorStop(1, "rgba(215, 180, 112, 0)");
    c.fillStyle = halo;
    c.fillRect(fx - discR * 3.2, fy - discR * 3.2, discR * 6.4, discR * 3.4);

    c.beginPath();
    c.arc(fx, fy, discR, Math.PI, TAU);
    c.closePath();
    c.fillStyle = `rgba(236, 217, 168, ${Math.min(1, 0.9 * E * flare)})`;
    c.fill();

    // Stepped arcs (the deco fan), dashed like elevator-door inlay.
    c.lineWidth = 1;
    const dashSets: Array<[number, number[]]> = [
      [1.55, [26, 14]],
      [1.95, [3, 10]],
      [2.35, [42, 22]],
    ];
    for (const [mult, dash] of dashSets) {
      c.beginPath();
      c.setLineDash(dash);
      c.lineDashOffset = t * 0.004 * (mult % 2 === 0 ? 1 : -1);
      c.arc(fx, fy, discR * mult, Math.PI * 1.06, TAU - Math.PI * 0.06);
      c.strokeStyle = `rgba(215, 180, 112, ${0.42 * E * open})`;
      c.stroke();
    }
    c.setLineDash([]);

    // Champagne dust.
    const dustLift = 1 + kick * 2.4;
    for (const m of motes) {
      const my = ((m.y * h - (t * 0.001 * m.vy * dustLift) % h) + h * 2) % h;
      const mx = m.x * w + Math.sin(t * 0.0004 + m.tw) * 14 + m.vx;
      const tw = 0.25 + 0.55 * Math.sin(t * 0.0013 + m.tw) ** 2;
      const a = Math.min(1, E * tw * (m.ember ? 0.85 : 0.5) * flare);
      c.beginPath();
      c.arc(mx, my, m.r, 0, TAU);
      c.fillStyle = m.ember
        ? `rgba(232, 84, 46, ${a})`
        : `rgba(241, 233, 215, ${a})`;
      c.fill();
    }
  }

  function tick(t: number): void {
    raf = requestAnimationFrame(tick);
    if (born < 0) born = t;
    const dt = lastT < 0 ? 16 : Math.min(64, t - lastT);
    lastT = t;

    const y = window.scrollY;
    const vel = lastY < 0 ? 0 : (y - lastY) / Math.max(1, dt);
    lastY = y;

    spin = (spin + vel * 0.0028) * 0.93;
    kick *= 0.95;
    energy = lerp(energy, scrollEnergy(), 0.06);
    pointerBias = lerp(pointerBias, pointerTarget, 0.05);

    const open = easeOut(clamp01((t - born) / 1500));
    draw(t, open);
    onTick?.(dt, vel);
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
    if (staticMode) draw(4200, 1);
  });

  if (staticMode) {
    energy = 1;
    draw(4200, 1);
    return { kick: () => undefined };
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      pointerTarget = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    lastT = -1;
    if (!document.hidden) raf = requestAnimationFrame(tick);
  });

  raf = requestAnimationFrame(tick);

  return {
    kick: () => {
      kick = 1;
    },
  };
}
