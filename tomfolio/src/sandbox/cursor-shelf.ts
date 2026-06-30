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

// Stamp centered on (x, y). Positioned without margin so GSAP scale
// uses the element's own center (default transform-origin 50% 50%).
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
  return () => {
    targets.forEach((t) => {
      t.removeEventListener("pointerenter", onEnter);
      t.removeEventListener("pointerleave", onLeave);
    });
  };
}

// ================================================================
// 1. DEFAULT — instant hard stamp. The reference.
// ================================================================
function mountDefault(tile: HTMLElement): Cursor {
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
      cleanTargets();
      cur.remove();
    },
  };
}

// ================================================================
// 2. BREATHE — alive at rest; holds breath on hover.
// ================================================================
function mountBreathe(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  gsap.set(cur, { scale: 0.7 });
  let breathe = gsap.to(cur, {
    scale: 1.3, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1,
  });

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };

  // Hover: pause mid-breath, settle to neutral — it holds still.
  const onEnter = () => {
    breathe.pause();
    gsap.killTweensOf(cur, "scale");
    gsap.to(cur, { scale: 1.0, duration: 0.3, ease: "sine.out" });
  };
  const onLeave = () => breathe.play();
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    breathe.pause();
    gsap.killTweensOf(cur, "scale");
    const stamp = makeStamp(e.clientX, e.clientY, 26);
    // Exhale (expand) then slow settle, then breathing restarts.
    gsap.to(cur, {
      scale: 2.2, duration: 0.18, ease: "sine.out",
      onComplete: () => {
        gsap.to(cur, {
          scale: 0.7, duration: 0.65, ease: "sine.inOut",
          onComplete: () => {
            breathe.kill();
            breathe = gsap.to(cur, {
              scale: 1.3, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1,
            });
          },
        });
      },
    });
    // Stamp cuts after a slow beat — not instant.
    window.setTimeout(() => stamp.remove(), 320);
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      breathe.kill();
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets();
      cur.remove();
    },
  };
}

// ================================================================
// 3. ECHO — 4 concentric stamps build in; all cut together.
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

    // 4 concentric stamps appear at 90ms intervals, all cut simultaneously.
    const SIZES = [26, 40, 54, 70];
    const CUT_AT = 700;
    const stamps: HTMLDivElement[] = [];
    SIZES.forEach((size, i) => {
      window.setTimeout(() => stamps.push(makeStamp(e.clientX, e.clientY, size)), i * 90);
    });
    window.setTimeout(() => { stamps.forEach((s) => s.remove()); }, CUT_AT);
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets();
      cur.remove();
    },
  };
}

// ================================================================
// 4. WEIGHT — heavy lag; slow windup before stamp fires.
// ================================================================
function mountWeight(tile: HTMLElement): Cursor {
  const cur = makeBlock();

  let curX = 0, curY = 0, tgtX = 0, tgtY = 0;
  let initialized = false;

  // Frame-delta-aware lerp; k ≈ 0.07 per frame at 60fps.
  const tickFn = (_time: number, delta: number) => {
    if (!initialized) return;
    const t = 1 - Math.pow(0.93, delta / 16.67);
    curX += (tgtX - curX) * t;
    curY += (tgtY - curY) * t;
    gsap.set(cur, { x: Math.round(curX), y: Math.round(curY) });
  };
  gsap.ticker.add(tickFn);

  const onMove = (e: PointerEvent) => {
    if (!initialized) {
      curX = tgtX = e.clientX;
      curY = tgtY = e.clientY;
      gsap.set(cur, { x: curX, y: curY });
      initialized = true;
    }
    tgtX = e.clientX;
    tgtY = e.clientY;
  };

  const onEnter = () => gsap.to(cur, { scale: 1.5, duration: 0.5, ease: "sine.out" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.35, ease: "sine.out" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = () => {
    // Slow windup: compress for 350ms then hard snap-stamp at the lag position.
    gsap.killTweensOf(cur, "scale");
    gsap.to(cur, {
      scale: 0.45, duration: 0.35, ease: "power2.in",
      onComplete: () => {
        gsap.set(cur, { scale: 2.4 });
        gsap.to(cur, { scale: 1, duration: 0.1, ease: "power3.out" });
        const stamp = makeStamp(Math.round(curX), Math.round(curY), 26);
        window.setTimeout(() => stamp.remove(), 90);
      },
    });
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      gsap.ticker.remove(tickFn);
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets();
      cur.remove();
    },
  };
}

// ================================================================
// 5. SPRING — physical reverb; one large stamp slowly shrinks away.
// ================================================================
function mountSpring(tile: HTMLElement): Cursor {
  const cur = makeBlock();
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };
  const onEnter = () => gsap.to(cur, { scale: 1.4, duration: 0.12, ease: "power2.out" });
  const onLeave = () => gsap.to(cur, { scale: 1, duration: 0.12, ease: "power2.out" });
  const cleanTargets = addHoverTargets(tile, onEnter, onLeave);

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    // Compress → big overshoot → two damped rebounds → settle.
    const tl = gsap.timeline();
    tl.to(cur, { scale: 0.32, duration: 0.22, ease: "power2.in" });
    tl.to(cur, { scale: 2.0,  duration: 0.18, ease: "power2.out" });
    tl.to(cur, { scale: 0.72, duration: 0.15, ease: "power2.in" });
    tl.to(cur, { scale: 1.22, duration: 0.13, ease: "power2.out" });
    tl.to(cur, { scale: 1.0,  duration: 0.22, ease: "power1.inOut" });

    // Large stamp shrinks slowly away — gravity, not a cut.
    const stamp = makeStamp(e.clientX, e.clientY, 62);
    gsap.to(stamp, {
      scale: 0, duration: 0.72, ease: "power2.out",
      onComplete: () => stamp.remove(),
    });
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cleanTargets();
      cur.remove();
    },
  };
}

// ---- Wire tiles ----

const MOUNTS: Record<string, (tile: HTMLElement) => Cursor> = {
  default: mountDefault,
  breathe: mountBreathe,
  echo: mountEcho,
  weight: mountWeight,
  spring: mountSpring,
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
