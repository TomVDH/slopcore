/**
 * Press cursor — ONE engine, nine variants as data.
 *
 * The block cursor + click-stamp choreography explored on /sandbox/
 * cursor-shelf.html, canonicalized: every variant from the shelf survives
 * here as a config (SNAP/SCAR/WEIGHT/ECHO/BURST/PULSE/SCATTER/REVERB/DELAY),
 * and the artefact ships PULSE (the measured 24fps build — see the vault
 * decision records). The shelf pages consume this registry, so no variant is
 * dead code and no implementation is duplicated.
 *
 * Colour comes from CSS only (`background: var(--art-cursor)` on the cursor/
 * stamp classes) — the module never touches colour. Fine-pointer + motion
 * gated; returns null otherwise. All timings in ms; the 24fps frame helper
 * `f(n)` is exported for BLEND-family configs.
 */

import { gsap } from "gsap";

/** 24fps frame → ms. All BLEND-family timings are multiples of this. */
export const f = (n: number): number => Math.round((n * 1000) / 24);

export interface StampSpec {
  size: number; // px, centered on the click
  appearMs: number; // from click (or from the pre-compress snap, for WEIGHT)
  cutMs: number; // from click: when this stamp is removed
}

export interface CursorVariant {
  /** Shelf-style grow over hover targets; omit for no hover response. */
  hover?: { scale: number; dur: number };
  recoil: {
    from: number;
    dur: number; // seconds (GSAP)
    ease: string;
    /** WEIGHT's wind-up: compress first, then snap + stamps. */
    pre?: { scale: number; dur: number; ease: string };
  };
  stamps: StampSpec[];
}

export const CURSOR_VARIANTS = {
  // DEFAULT family
  snap: {
    hover: { scale: 1.6, dur: 0.05 },
    recoil: { from: 2.4, dur: 0.08, ease: "power2.out" },
    stamps: [{ size: 26, appearMs: 0, cutMs: 90 }],
  },
  scar: {
    hover: { scale: 1.6, dur: 0.05 },
    recoil: { from: 2.4, dur: 0.08, ease: "power2.out" },
    stamps: [{ size: 26, appearMs: 0, cutMs: 500 }],
  },
  weight: {
    hover: { scale: 1.6, dur: 0.05 },
    recoil: { from: 2.4, dur: 0.1, ease: "power3.out", pre: { scale: 0.45, dur: 0.35, ease: "power2.in" } },
    stamps: [{ size: 26, appearMs: 0, cutMs: 90 }], // relative to the post-compress snap
  },
  // ECHO
  echo: {
    hover: { scale: 1.3, dur: 0.08 },
    recoil: { from: 1.5, dur: 0.14, ease: "power2.out" },
    stamps: [26, 40, 54, 70].map((size, i) => ({ size, appearMs: i * 90, cutMs: 700 })),
  },
  // BLEND family — 24fps frame units
  burst: {
    hover: { scale: 1.6, dur: 0.05 },
    recoil: { from: 2.4, dur: f(2) / 1000, ease: "power2.out" },
    stamps: [20, 36, 54].map((size) => ({ size, appearMs: 0, cutMs: f(4) })),
  },
  pulse: {
    hover: { scale: 1.4, dur: 0.07 },
    recoil: { from: 1.8, dur: f(2) / 1000, ease: "power2.out" },
    stamps: [26, 42, 60].map((size, i) => ({ size, appearMs: f(i * 2), cutMs: f(12) })),
  },
  scatter: {
    hover: { scale: 1.6, dur: 0.04 },
    recoil: { from: 3.0, dur: f(1) / 1000, ease: "power3.out" },
    stamps: [26, 40, 54, 70].map((size, i) => ({ size, appearMs: f(i), cutMs: f(i) + f(3) })),
  },
  reverb: {
    hover: { scale: 1.3, dur: 0.08 },
    recoil: { from: 2.4, dur: f(2) / 1000, ease: "power2.out" },
    // Build outward f0/2/4/6; peel back inward f16/14/12/10.
    stamps: [26, 40, 54, 70].map((size, i) => ({ size, appearMs: f(i * 2), cutMs: f(16 - i * 2) })),
  },
  delay: {
    hover: { scale: 1.4, dur: 0.06 },
    recoil: { from: 2.4, dur: f(2) / 1000, ease: "power2.out" },
    // The hit (26 cuts at f2), 2-frame silence, then the echo (f4/6/8, cut f16).
    stamps: [
      { size: 26, appearMs: 0, cutMs: f(2) },
      ...[36, 52, 70].map((size, i) => ({ size, appearMs: f(4 + i * 2), cutMs: f(16) })),
    ],
  },
} satisfies Record<string, CursorVariant>;

export type CursorVariantName = keyof typeof CURSOR_VARIANTS;

export interface PressCursorOptions {
  variant?: CursorVariantName; // default "pulse" — the shipped composition
  /** Listener scope. Default window (page-wide); pass a tile for shelf mounts. */
  root?: HTMLElement;
  cursorClass?: string; // default "press-cursor"
  stampClass?: string; // default "press-stamp"
  /** Clicks inside this selector recoil but never stamp (e.g. ".art-dev"). */
  suppressStamps?: string;
  /** Selector inside root whose hover grows the cursor (shelf tiles). */
  hoverTargets?: string;
  /** Triple-click hook (the artefact wires scene.cursorBurst). */
  onTripleClick?: (e: MouseEvent) => void;
}

export function initPressCursor(o: PressCursorOptions = {}): { destroy(): void } | null {
  if (!window.matchMedia("(pointer: fine)").matches) return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  const v: CursorVariant = CURSOR_VARIANTS[o.variant ?? "pulse"];
  const scope: HTMLElement | Window = o.root ?? window;
  const pageWide = !o.root;
  const ab = new AbortController();
  const { signal } = ab;

  const cur = document.createElement("div");
  cur.className = o.cursorClass ?? "press-cursor";
  cur.setAttribute("aria-hidden", "true");
  document.body.appendChild(cur);

  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");
  if (pageWide) {
    setX(window.innerWidth / 2);
    setY(window.innerHeight / 2);
  }

  scope.addEventListener("pointermove", ((e: PointerEvent) => {
    setX(e.clientX);
    setY(e.clientY);
  }) as EventListener, { signal });

  if (pageWide) {
    // Hide when the pointer leaves the page (matches the artefact behaviour).
    document.addEventListener("pointerleave", () => { cur.style.opacity = "0"; }, { signal });
    document.addEventListener("pointerenter", () => { cur.style.opacity = ""; }, { signal });
  }

  if (o.hoverTargets && o.root && v.hover) {
    const h = v.hover;
    for (const t of o.root.querySelectorAll(o.hoverTargets)) {
      t.addEventListener("pointerenter", () => gsap.to(cur, { scale: h.scale, duration: h.dur, ease: "none" }), { signal });
      t.addEventListener("pointerleave", () => gsap.to(cur, { scale: 1, duration: h.dur, ease: "none" }), { signal });
    }
  }

  const suppressed = (e: Event): boolean => {
    if (!o.suppressStamps) return false;
    const t = e.target as HTMLElement | null;
    return !!t && !!t.closest(o.suppressStamps);
  };

  const spawnStamps = (x: number, y: number): void => {
    const stamps: HTMLDivElement[] = [];
    for (const spec of v.stamps) {
      window.setTimeout(() => {
        const s = document.createElement("div");
        s.className = o.stampClass ?? "press-stamp";
        s.style.left = `${x - spec.size / 2}px`;
        s.style.top = `${y - spec.size / 2}px`;
        s.style.width = `${spec.size}px`;
        s.style.height = `${spec.size}px`;
        document.body.appendChild(s);
        stamps.push(s);
        window.setTimeout(() => s.remove(), Math.max(spec.cutMs - spec.appearMs, 0));
      }, spec.appearMs);
    }
    // Belt-and-braces sweep in case destroy() raced a pending cut.
    window.setTimeout(() => stamps.forEach((s) => s.remove()), Math.max(...v.stamps.map((s) => s.cutMs)) + 50);
  };

  scope.addEventListener("pointerdown", ((e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    const r = v.recoil;
    const fire = (): void => {
      gsap.fromTo(cur, { scale: r.from }, { scale: 1, duration: r.dur, ease: r.ease });
      if (!suppressed(e)) spawnStamps(e.clientX, e.clientY);
    };
    if (r.pre) {
      gsap.to(cur, { scale: r.pre.scale, duration: r.pre.dur, ease: r.pre.ease, onComplete: fire });
    } else {
      fire();
    }
  }) as EventListener, { signal });

  if (o.onTripleClick) {
    scope.addEventListener("click", ((e: MouseEvent) => {
      if (e.detail < 3 || suppressed(e)) return;
      o.onTripleClick!(e);
    }) as EventListener, { signal });
  }

  return {
    destroy() {
      ab.abort();
      gsap.killTweensOf(cur);
      cur.remove();
    },
  };
}
