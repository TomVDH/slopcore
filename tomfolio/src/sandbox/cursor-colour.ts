import "./cursor-colour.css";
import { gsap } from "gsap";

// Three colour treatments for the PULSE block cursor. Each tile mounts the SAME
// PULSE animation (1.8× recoil + 3 stamps at 24fps cadence) — only the colour
// class differs, so the comparison is colour-only.

const F = 1000 / 24;
const f = (n: number) => Math.round(n * F);

type Cursor = { unmount: () => void };

function mount(tile: HTMLElement, variant: string): Cursor {
  const cur = document.createElement("div");
  cur.className = `ccol-cur v-${variant}`;
  cur.setAttribute("aria-hidden", "true");
  document.body.appendChild(cur);

  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");

  const onMove = (e: PointerEvent) => { setX(e.clientX); setY(e.clientY); };

  const onDown = (e: PointerEvent) => {
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 1.8 }, { scale: 1, duration: f(2) / 1000, ease: "power2.out" });

    const SIZES = [26, 42, 60];
    const stamps: HTMLDivElement[] = [];
    SIZES.forEach((size, i) => {
      window.setTimeout(() => {
        const s = document.createElement("div");
        s.className = `ccol-stamp v-${variant}`;
        s.style.left = `${e.clientX - size / 2}px`;
        s.style.top = `${e.clientY - size / 2}px`;
        s.style.width = `${size}px`;
        s.style.height = `${size}px`;
        document.body.appendChild(s);
        stamps.push(s);
      }, f(i * 2));
    });
    window.setTimeout(() => { stamps.forEach((s) => s.remove()); }, f(12));
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

if (
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  document.querySelectorAll<HTMLElement>(".ccol-tile").forEach((tile) => {
    const variant = tile.dataset.variant ?? "";
    if (!variant) return;
    let active: Cursor | null = null;
    tile.addEventListener("pointerenter", () => {
      tile.classList.add("is-active");
      active = mount(tile, variant);
    });
    tile.addEventListener("pointerleave", () => {
      tile.classList.remove("is-active");
      active?.unmount();
      active = null;
    });
  });
}
