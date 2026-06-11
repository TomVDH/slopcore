/**
 * Couples the page scroll to the shader: energy dips through the solid
 * middle of the page and re-ignites at the footer (storytelling), scroll
 * velocity feeds the field, and rendering pauses entirely while the
 * canvas is covered by the midband.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import type { GlScene } from "../gl/scene";

export function initEnergy(scene: GlScene, lenis: Lenis): void {
  const state = { v: 1 };

  gsap
    .timeline({
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
      },
      onUpdate: () => scene.setEnergy(state.v),
    })
    .to(state, { v: 0.25, ease: "none", duration: 0.45 })
    .to(state, { v: 0.3, ease: "none", duration: 0.25 })
    .to(state, { v: 1.1, ease: "none", duration: 0.3 });

  lenis.on("scroll", (l) => scene.setScrollVelocity(l.velocity));

  const midband = document.getElementById("midband");
  if (midband) {
    ScrollTrigger.create({
      trigger: midband,
      start: "top top",
      end: "bottom bottom",
      onToggle: (self) => scene.setRunning(!self.isActive),
    });
  }
}
