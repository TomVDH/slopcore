/**
 * Kinetic marquee: drifts left at a base speed, accelerates with scroll
 * velocity and flips direction with scroll direction. Runs on gsap's
 * ticker; transform-only.
 */

import { gsap } from "gsap";

export function initMarquee(getVelocity: () => number): void {
  const track = document.querySelector<HTMLElement>(".marquee-track");
  const first = track?.children[0] as HTMLElement | undefined;
  if (!track || !first) return;

  let unitW = first.offsetWidth;

  function fill(): void {
    if (!track || !first) return;
    unitW = first.offsetWidth || 1;
    const needed = Math.ceil((window.innerWidth * 2) / unitW) + 1;
    while (track.children.length < needed) {
      track.appendChild(first.cloneNode(true));
    }
  }
  fill();
  window.addEventListener("resize", fill, { passive: true });

  let pos = 0;
  let dir = -1;
  const BASE = 70; // px per second

  gsap.ticker.add((_time, deltaTime) => {
    const vel = getVelocity();
    if (vel > 0.1) dir = -1;
    else if (vel < -0.1) dir = 1;
    const speed = (BASE + Math.min(Math.abs(vel) * 26, 420)) * dir;
    pos += (speed * deltaTime) / 1000;
    pos = gsap.utils.wrap(-unitW, 0, pos);
    track.style.transform = `translate3d(${pos}px, 0, 0)`;
  });
}
