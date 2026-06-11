/**
 * Work list: rows reveal on entry; on fine-pointer devices a floating
 * preview image trails the cursor with a little velocity-based tilt.
 * Keyboard focus gets the same preview, pinned beside the focused row.
 * Touch devices use inline thumbnails instead (CSS).
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function initWork(): void {
  const rows = gsap.utils.toArray<HTMLElement>(".work-row");
  if (rows.length === 0) return;

  gsap.set(rows, { y: 34, autoAlpha: 0 });
  ScrollTrigger.batch(rows, {
    start: "top 88%",
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out", stagger: 0.08 }),
  });

  const preview = document.querySelector<HTMLElement>(".work-preview");
  const img = preview?.querySelector("img");
  const list = document.querySelector<HTMLElement>(".work-list");
  if (!preview || !img || !list) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  gsap.set(preview, { scale: 0.92, transformOrigin: "center" });

  const warmed = new Set<string>();
  function warm(src: string | undefined): void {
    if (!src || warmed.has(src)) return;
    const i = new Image();
    i.src = src;
    warmed.add(src);
  }
  list.addEventListener("pointerenter", () => rows.forEach((r) => warm(r.dataset.image)), {
    once: true,
  });

  const xTo = gsap.quickTo(preview, "x", { duration: 0.5, ease: "power3" });
  const yTo = gsap.quickTo(preview, "y", { duration: 0.5, ease: "power3" });
  const rTo = gsap.quickTo(preview, "rotation", { duration: 0.6, ease: "power3" });
  let lastX = 0;

  list.addEventListener(
    "pointermove",
    (e) => {
      xTo(e.clientX - preview.offsetWidth / 2 + 110);
      yTo(e.clientY - preview.offsetHeight / 2);
      rTo(gsap.utils.clamp(-9, 9, (e.clientX - lastX) * 0.55));
      lastX = e.clientX;
    },
    { passive: true },
  );

  function show(src: string | undefined): void {
    if (!src || !img) return;
    img.src = src;
    gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out", overwrite: "auto" });
  }
  function hide(): void {
    gsap.to(preview, { autoAlpha: 0, scale: 0.92, duration: 0.35, ease: "power3.in", overwrite: "auto" });
  }

  // The pointer can leave the section without a pointerleave firing
  // (scrolling with a stationary cursor); hide whenever the section exits.
  ScrollTrigger.create({
    trigger: ".work",
    start: "top bottom",
    end: "bottom top",
    onLeave: hide,
    onLeaveBack: hide,
  });

  rows.forEach((row) => {
    row.addEventListener("pointerenter", () => show(row.dataset.image));
    row.addEventListener("pointerleave", hide);

    row.addEventListener("focus", () => {
      if (!row.matches(":focus-visible")) return;
      const rect = row.getBoundingClientRect();
      gsap.set(preview, {
        x: Math.min(rect.right - preview.offsetWidth, window.innerWidth - preview.offsetWidth - 24),
        y: rect.top + rect.height / 2 - preview.offsetHeight / 2,
        rotation: 0,
      });
      show(row.dataset.image);
    });
    row.addEventListener("blur", hide);
  });
}
