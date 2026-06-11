/**
 * Manifesto scrub: words fade from ghost to full as the reader scrolls
 * through the statement, pacing the read.
 */

import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

export function initManifesto(): void {
  const el = document.getElementById("manifesto-text");
  if (!el) return;

  const split = new SplitText(el, { type: "words" });
  gsap.set(split.words, { opacity: 0.12 });
  gsap.to(split.words, {
    opacity: 1,
    stagger: 0.05,
    ease: "none",
    scrollTrigger: {
      trigger: el,
      start: "top 75%",
      end: "bottom 55%",
      scrub: true,
    },
  });
}
