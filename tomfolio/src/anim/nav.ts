/**
 * Nav behavior: solid backdrop after leaving the hero, hide on scroll
 * down / show on scroll up, and smooth anchor navigation via Lenis.
 * With a null lenis (reduced motion), anchors fall back to native jumps
 * and the nav stays static.
 */

import type Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function initNav(lenis: Lenis | null): void {
  const nav = document.querySelector<HTMLElement>(".nav");

  if (nav && lenis) {
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const y = self.scroll();
        nav.classList.toggle("nav-solid", y > 60);
        if (self.direction === 1 && y > 260) {
          gsap.to(nav, { yPercent: -110, duration: 0.5, ease: "power3.out", overwrite: true });
        } else {
          gsap.to(nav, { yPercent: 0, duration: 0.5, ease: "power3.out", overwrite: true });
        }
      },
    });
  }

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id.length < 2) return;
      const target = document.querySelector<HTMLElement>(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target);
      } else {
        target.scrollIntoView();
      }
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });
}
