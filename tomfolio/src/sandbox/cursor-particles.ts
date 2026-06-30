import "./cursor-particles.css";
import { gsap } from "gsap";

type Cursor = { unmount: () => void };

// ---- Builders ----

function blockCursor(size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "cpt-cur";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

// A hard square dither pixel, centered on (x, y).
function pixel(x: number, y: number, size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "cpt-px";
  el.style.left = `${x - size / 2}px`;
  el.style.top = `${y - size / 2}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  document.body.appendChild(el);
  return el;
}

const rnd = () => Math.random();

// Ordered 4×4 Bayer threshold in [0,1), for integer grid coords. Matches the
// shader's bayer4 so the DOM stipple shares the plate's dither order.
function bayer2(x: number, y: number): number {
  return x * 2 + y * 3 - x * y * 4;
}
function bayer4(x: number, y: number): number {
  const m = (v: number) => ((v % 2) + 2) % 2;
  const p1x = m(x), p1y = m(y);
  const p2x = m(Math.floor(x / 2)), p2y = m(Math.floor(y / 2));
  return (bayer2(p1x, p1y) * 4 + bayer2(p2x, p2y)) / 16;
}

// ================================================================
// BAYER DROP — click stamps a 4×4 cell that dissolves in a RANDOM order,
// freshly shuffled every click so no two dissolves repeat.
// ================================================================
function shuffledIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function mountBayer(tile: HTMLElement): Cursor {
  const cur = blockCursor(4);
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");
  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };

  const onDown = (e: PointerEvent) => {
    gsap.fromTo(cur, { scale: 1.8 }, { scale: 1, duration: 0.1, ease: "power2.out" });
    const CELL = 7;     // spacing between pixels
    const SIZE = 6;     // pixel size
    const DUR = 460;    // full dissolve duration

    const cells: HTMLDivElement[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cells.push(pixel(e.clientX + (c - 1.5) * CELL, e.clientY + (r - 1.5) * CELL, SIZE));
      }
    }
    shuffledIndices(16).forEach((cellIdx, step) => {
      window.setTimeout(() => cells[cellIdx].remove(), (step / 16) * DUR + 40);
    });
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cur.remove();
    },
  };
}

// ================================================================
// DITHERED TRAIL — a grid-snapped ribbon following the pointer. Each cell's
// lifetime is set by its Bayer value, so the band is solid at the head and
// dithers out to sparse stipple toward the tail. Click = a dithered splash.
// ================================================================
const TRAIL_G = 6;      // grid cell (px)
const TRAIL_SIZE = 5;   // pixel size (1px gap -> reads as a dither grid)
const LIFE_MIN = 150;   // ms — even the highest-Bayer cell survives this long
const LIFE_SPAN = 600;  // ms — extra life for low-Bayer cells (solid head)

// Stamp one grid cell; it dies after a Bayer-weighted lifetime (no fade — a
// crisp 1-bit drop-out). Low Bayer -> lives long, high Bayer -> dies first.
function shedCell(gx: number, gy: number): void {
  const p = pixel(gx * TRAIL_G, gy * TRAIL_G, TRAIL_SIZE);
  const life = LIFE_MIN + (1 - bayer4(gx, gy)) * LIFE_SPAN;
  window.setTimeout(() => p.remove(), life);
}

function mountTrail(tile: HTMLElement): Cursor {
  const cur = blockCursor(5);
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  let lastGx = NaN, lastGy = NaN, lastShed = 0;

  const onMove = (e: PointerEvent) => {
    setX(e.clientX); setY(e.clientY);
    const now = performance.now();
    if (now - lastShed < 16) return;
    lastShed = now;
    const gx = Math.round(e.clientX / TRAIL_G);
    const gy = Math.round(e.clientY / TRAIL_G);
    if (gx === lastGx && gy === lastGy) return; // no re-stamp while parked -> it dithers away
    lastGx = gx; lastGy = gy;
    // 2-cell-wide brush -> a dithered ribbon (each cell keeps its own Bayer life).
    shedCell(gx, gy);
    shedCell(gx + 1, gy);
    shedCell(gx, gy + 1);
    shedCell(gx + 1, gy + 1);
  };

  const onDown = (e: PointerEvent) => {
    gsap.fromTo(cur, { scale: 1.8 }, { scale: 1, duration: 0.1, ease: "power2.out" });
    // Dithered splash: a filled disc of grid cells that dithers away by Bayer life.
    const cgx = Math.round(e.clientX / TRAIL_G);
    const cgy = Math.round(e.clientY / TRAIL_G);
    const R = 4;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        shedCell(cgx + dx, cgy + dy);
      }
    }
  };

  tile.addEventListener("pointermove", onMove);
  tile.addEventListener("pointerdown", onDown);
  return {
    unmount() {
      tile.removeEventListener("pointermove", onMove);
      tile.removeEventListener("pointerdown", onDown);
      cur.remove();
    },
  };
}

// ---- Wire tiles ----

const MOUNTS: Record<string, (tile: HTMLElement) => Cursor> = {
  bayer: mountBayer,
  trail: mountTrail,
};

if (
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  document.querySelectorAll<HTMLElement>(".cpt-tile").forEach((tile) => {
    const mount = MOUNTS[tile.dataset.variant ?? ""];
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
