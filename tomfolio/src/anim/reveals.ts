/**
 * Generic entrance reveals: section headers (.reveal), bento cells, and
 * footer content. Once-only, transform and opacity exclusively.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function initReveals(): void {
  const items = [
    ...gsap.utils.toArray<HTMLElement>(".reveal"),
    ...gsap.utils.toArray<HTMLElement>(".footer .btn-big, .socials, .fineprint"),
  ];
  if (items.length > 0) {
    gsap.set(items, { y: 28, autoAlpha: 0 });
    ScrollTrigger.batch(items, {
      start: "top 86%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.1 }),
    });
  }

  const cells = gsap.utils.toArray<HTMLElement>(".bento .cell");
  if (cells.length > 0) {
    gsap.set(cells, { y: 30, autoAlpha: 0 });
    ScrollTrigger.batch(cells, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.85, ease: "power3.out", stagger: 0.07 }),
    });
  }
}
