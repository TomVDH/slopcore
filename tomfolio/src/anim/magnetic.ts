/**
 * Light magnetic pull on pill buttons (fine pointers only): tactile
 * feedback on the two CTAs without full physics theatrics.
 */

import { gsap } from "gsap";

export function initMagnetic(): void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  document.querySelectorAll<HTMLElement>(".btn").forEach((btn) => {
    const xTo = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3" });

    btn.addEventListener(
      "pointermove",
      (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.34);
      },
      { passive: true },
    );
    btn.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}
