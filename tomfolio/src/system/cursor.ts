/**
 * Custom cursor: a printer's registration crosshair that follows the
 * mouse and snaps to the accent colour over interactive targets.
 *
 * Guards (so it stays accessible and cheap):
 *  - only engages on a fine pointer with motion enabled; otherwise the
 *    native cursor stays and this is a no-op.
 *  - ignores pen/touch pointer events.
 *  - one rAF loop, transform-only, passive listeners.
 *  - hides when the pointer leaves the window or the tab blurs.
 *
 * Styles live in src/system/base.css (.cursor / .cursor-cross /
 * .cursor-ring and the body.has-cursor native-cursor hide).
 */

const TARGETS = 'a, button, [role="button"], input, select, textarea, summary, label, [data-cursor]';

export function initCursor(): void {
  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced || document.querySelector(".cursor")) return;

  const el = document.createElement("div");
  el.className = "cursor";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<span class="cursor-cross"></span><span class="cursor-ring"></span>';
  document.body.appendChild(el);
  document.body.classList.add("has-cursor");

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let tx = x;
  let ty = y;
  let shown = false;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!shown) {
        shown = true;
        el.classList.add("is-shown");
      }
      const t = e.target as Element | null;
      el.classList.toggle("is-target", !!(t && t.closest(TARGETS)));
    },
    { passive: true },
  );

  window.addEventListener("pointerdown", () => el.classList.add("is-press"), { passive: true });
  window.addEventListener("pointerup", () => el.classList.remove("is-press"), { passive: true });

  const hide = () => {
    shown = false;
    el.classList.remove("is-shown");
  };
  document.addEventListener("mouseleave", hide);
  window.addEventListener("blur", hide);

  const loop = () => {
    requestAnimationFrame(loop);
    // Light lerp: mechanical precision with a hair of lag.
    x += (tx - x) * 0.35;
    y += (ty - y) * 0.35;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  requestAnimationFrame(loop);
}
