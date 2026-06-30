import "./cursor-shelf.css";
import { gsap } from "gsap";

type Cursor = { unmount: () => void };

// ---- Shared builders ----

function makeBlock(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "cshelf-cur cshelf-cur-block";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

// Stamp centered on (x, y). No margin — transform-origin 50% 50% is the click center.
function makeStamp(x: number, y: number, size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "cshelf-stamp";
  el.style.left = `${x - size / 2}px`;
  el.style.top = `${y - size / 2}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  document.body.appendChild(el);
  return el;
}

function addHoverTargets(
  tile: HTMLElement,
  onEnter: () => void,
  onLeave: () => void,
): () => void {
  const targets = tile.querySelectorAll("button, a");
  targets.forEach((t) => {
    t.addEventListener("pointerenter", onEnter);
    t.addEventListener("pointerleave", onLeave);
  });
  return () => targets.forEach((t) => {
    t.removeEventListener("pointerenter", onEnter);
    t.removeEventListener("pointerleave", onLeave);
  });
}

// 24fps frame unit. All BLEND timings are multiples of this.
const F = 1000 / 24; // ≈ 41.67ms per frame
const f = (n: number) => Math.round(n * F);

// ================================================================
// DEFAULT FAMILY
// ================================================================

// SNAP — 2.4× recoil, 26px stamp, 90ms cut.
function mountSnap(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.6, duration: 0.05, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.05, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 2.4 }, { scale: 1, duration: 0.08, ease: "power2.out" });
    const stamp = makeStamp(e.clientX, e.clientY, 26);
    window.setTimeout(() => stamp.remove(), 90);
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// SCAR — same recoil as SNAP, mark lingers 500ms.
function mountScar(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.6, duration: 0.05, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.05, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 2.4 }, { scale: 1, duration: 0.08, ease: "power2.out" });
    const stamp = makeStamp(e.clientX, e.clientY, 26);
    window.setTimeout(() => stamp.remove(), 500);
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// WEIGHT — tracks normally; click compresses 350ms then hard-snaps.
function mountWeight(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.6, duration: 0.05, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.05, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.to(cur, {
      scale: 0.45, duration: 0.35, ease: "power2.in",
      onComplete: () => {
        gsap.set(cur, { scale: 2.4 });
        gsap.to(cur, { scale: 1, duration: 0.1, ease: "power3.out" });
        const stamp = makeStamp(e.clientX, e.clientY, 26);
        window.setTimeout(() => stamp.remove(), 90);
      },
    });
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// ================================================================
// ECHO
// ================================================================

function mountEcho(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.3, duration: 0.08, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.08, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 1.5 }, { scale: 1, duration: 0.14, ease: "power2.out" });
    const SIZES = [26, 40, 54, 70];
    const stamps: HTMLDivElement[] = [];
    SIZES.forEach((size, i) => {
      window.setTimeout(() => stamps.push(makeStamp(e.clientX, e.clientY, size)), i * 90);
    });
    window.setTimeout(() => { stamps.forEach((s) => s.remove()); }, 700);
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// ================================================================
// BLEND FAMILY — all timings at 24fps (multiples of F ≈ 41.67ms)
//
// Frame table:
//   f(1) =  42ms   f(2) =  83ms   f(3) = 125ms   f(4) = 167ms
//   f(6) = 250ms   f(8) = 333ms   f(10)= 417ms   f(12)= 500ms
//   f(14)= 583ms   f(16)= 667ms
// ================================================================

// BURST — 2.4× recoil + 3 concentric stamps appear at t=0, all cut at f4 (167ms).
// SNAP violence × ECHO geometry, everything simultaneous and fast.
function mountBurst(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.6, duration: 0.05, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.05, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 2.4 }, { scale: 1, duration: f(2) / 1000, ease: "power2.out" });
    const stamps = [20, 36, 54].map((size) => makeStamp(e.clientX, e.clientY, size));
    window.setTimeout(() => { stamps.forEach((s) => s.remove()); }, f(4));
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// PULSE — 1.8× recoil + 3 stamps staggered every f2 (83ms), all cut at f12 (500ms).
// Measured build — slower recoil, rhythmic geometry.
function mountPulse(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.4, duration: 0.07, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.07, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 1.8 }, { scale: 1, duration: f(2) / 1000, ease: "power2.out" });
    const SIZES = [26, 42, 60];
    const stamps: HTMLDivElement[] = [];
    SIZES.forEach((size, i) => {
      window.setTimeout(() => stamps.push(makeStamp(e.clientX, e.clientY, size)), f(i * 2));
    });
    window.setTimeout(() => { stamps.forEach((s) => s.remove()); }, f(12));
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// SCATTER — 3× recoil + 4 stamps staggered every f1 (42ms), each lives exactly f3 (125ms).
// Rapid-fire rings, each its own short lifetime — a hard echo at film speed.
function mountScatter(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.6, duration: 0.04, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.04, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 3.0 }, { scale: 1, duration: f(1) / 1000, ease: "power3.out" });
    const SIZES = [26, 40, 54, 70];
    SIZES.forEach((size, i) => {
      window.setTimeout(() => {
        const s = makeStamp(e.clientX, e.clientY, size);
        window.setTimeout(() => s.remove(), f(3));
      }, f(i));
    });
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// REVERB — 2.4× recoil + 4 stamps build outward every f2, peel back inward every f2.
// Appear:  26px@f0, 40px@f2, 54px@f4, 70px@f6.
// Vanish:  70px@f10, 54px@f12, 40px@f14, 26px@f16.
// Outer ring lives 4 frames; inner ring lives 16 frames. Architecture dismantles itself.
function mountReverb(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.3, duration: 0.08, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.08, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 2.4 }, { scale: 1, duration: f(2) / 1000, ease: "power2.out" });

    const SIZES       = [26, 40, 54, 70];
    const APPEAR_F    = [ 0,  2,  4,  6]; // frames from click: when each appears
    const VANISH_F    = [16, 14, 12, 10]; // frames from click: when each vanishes

    SIZES.forEach((size, i) => {
      const appearAt = f(APPEAR_F[i]);
      const lifetime = f(VANISH_F[i]) - appearAt;
      window.setTimeout(() => {
        const s = makeStamp(e.clientX, e.clientY, size);
        window.setTimeout(() => s.remove(), lifetime);
      }, appearAt);
    });
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// DELAY — SNAP fires instantly (26px cuts at f2), then 2-frame silence,
// then ECHO stamps arrive at f4/f6/f8, all cut at f16.
// Two separated events: the hit, then the echo.
function mountDelay(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.4, duration: 0.06, ease: "none" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.06, ease: "none" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");

    // Phase 1: SNAP — immediate recoil + single stamp, cut at f2.
    gsap.fromTo(cur, { scale: 2.4 }, { scale: 1, duration: f(2) / 1000, ease: "power2.out" });
    const snapStamp = makeStamp(e.clientX, e.clientY, 26);
    window.setTimeout(() => snapStamp.remove(), f(2)); // cuts at 83ms

    // f2 silence (83ms → 167ms): nothing visible.

    // Phase 2: ECHO — arrives at f4, staggered every f2, all cut at f16.
    const ECHO_SIZES = [36, 52, 70];
    const echoStamps: HTMLDivElement[] = [];
    ECHO_SIZES.forEach((size, i) => {
      window.setTimeout(
        () => echoStamps.push(makeStamp(e.clientX, e.clientY, size)),
        f(4 + i * 2), // f4 = 167ms, f6 = 250ms, f8 = 333ms
      );
    });
    window.setTimeout(() => { echoStamps.forEach((s) => s.remove()); }, f(16)); // 667ms
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets(); cur.remove();
    },
  };
}

// ---- Wire tiles ----

const MOUNTS: Record<string, (tile: HTMLElement) => Cursor> = {
  snap: mountSnap,
  scar: mountScar,
  weight: mountWeight,
  echo: mountEcho,
  burst: mountBurst,
  pulse: mountPulse,
  scatter: mountScatter,
  reverb: mountReverb,
  delay: mountDelay,
};

if (
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  document.querySelectorAll<HTMLElement>(".cshelf-tile").forEach((tile) => {
    const mount = MOUNTS[tile.dataset.cursor ?? ""];
    if (!mount) return;
    let active: Cursor | null = null;
    tile.addEventListener("pointerenter", () => {
      tile.classList.add("is-active");
      active = mount(tile);
    });
    tile.addEventListener("pointerleave", () => {
      tile.classList.remove("is-active");
      active?.unmount();
      active = null;
    });
  });
}
