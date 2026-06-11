/**
 * Preloader curtain + hero entrance. Waits for fonts and the first
 * rendered shader frame so the reveal lands on a finished hero.
 *
 * Initial hidden states are set here at runtime (not in CSS), so the
 * page stays fully readable without JavaScript and for reduced motion.
 */

import { gsap } from "gsap";

export function runIntro(reduced: boolean, sceneReady: Promise<void>): void {
  const loader = document.querySelector<HTMLElement>(".loader");

  if (reduced) {
    loader?.remove();
    return;
  }

  gsap.set(".hero-title .line-inner", { yPercent: 115 });
  gsap.set([".hero-sub", ".hero .btn"], { y: 26, autoAlpha: 0 });
  gsap.set(".nav", { yPercent: -110, autoAlpha: 0 });

  const minWait = new Promise((resolve) => setTimeout(resolve, 400));

  Promise.all([document.fonts.ready, sceneReady, minWait]).then(() => {
    const tl = gsap.timeline();
    if (loader) {
      tl.to(loader, { yPercent: -100, duration: 0.9, ease: "power4.inOut" }).set(loader, {
        display: "none",
      });
    }
    tl.to(".nav", { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out" }, "-=0.45")
      .to(
        ".hero-title .line-inner",
        { yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.09 },
        "<",
      )
      .to(
        [".hero-sub", ".hero .btn"],
        { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.08 },
        "-=0.7",
      );
  });
}
