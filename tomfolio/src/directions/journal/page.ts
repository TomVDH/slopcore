/**
 * Journal page logic: renders shared content into the spreads, runs
 * calm editorial motion (long Lenis, soft once-only reveals), and
 * mounts the ink-wash study in the lead panel.
 */

import "../base.css";
import "./page.css";
import "../fonts.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { initScene, type GlScene } from "../../gl/scene";
import { initSmoothScroll } from "../../anim/smooth-scroll";
import {
  identity,
  image,
  playground,
  projects,
} from "../../content/portfolio";
import { journalFrag } from "./art";

gsap.registerPlugin(ScrollTrigger);

const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("still");
if (reduced) document.documentElement.classList.add("reduced");

/* ---- Content ---- */

const spreads = document.querySelector<HTMLElement>(".jnl-spreads");
if (spreads) {
  spreads.innerHTML = projects
    .map(
      (p) => `
      <article class="jnl-spread">
        <figure class="jnl-spread-figure">
          <img src="${image(p.slug, 1100, 760)}" alt="${p.alt}" loading="lazy" width="1100" height="760" />
          <figcaption>${p.title}, ${p.year.toLowerCase()}.</figcaption>
        </figure>
        <div class="jnl-spread-copy">
          <span class="jnl-kicker-num">${p.category}</span>
          <h3 class="jnl-spread-title">${p.title}</h3>
          <p class="jnl-spread-meta">${p.year}</p>
          <p class="jnl-spread-summary">${p.summary}</p>
        </div>
      </article>`,
    )
    .join("");
}

const letter = document.querySelector<HTMLElement>(".jnl-letter-text");
if (letter) {
  const m = identity.manifesto;
  letter.innerHTML = `${m.before}<em>${m.emphasis}</em>${m.after}`;
}

const margins = document.querySelector<HTMLElement>(".jnl-margin-grid");
if (margins) {
  margins.innerHTML = playground
    .map(
      (item) => `
      <figure class="jnl-margin-item">
        <img src="${image(item.slug, 800, 600)}" alt="${item.alt}" loading="lazy" width="800" height="600" />
        <figcaption>${item.title}<span>${item.detail}</span></figcaption>
      </figure>`,
    )
    .join("");
}

const colophonRow = document.querySelector<HTMLElement>(".jnl-colophon-row");
if (colophonRow) {
  colophonRow.innerHTML = `
    <a href="mailto:${identity.email}">${identity.email}</a>
    <a href="${identity.github}" rel="noopener" target="_blank">GitHub</a>
    <a href="/directions/">Direction shelf</a>`;
}

const fine = document.querySelector<HTMLElement>(".jnl-fineprint");
if (fine) fine.textContent = identity.smallPrint;

/* ---- Canvas ---- */

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !new URLSearchParams(window.location.search).has("nogl")) {
    scene = initScene(canvas, reduced, journalFrag);
    scene.setEnergy(1);
  } else {
    throw new Error("nogl");
  }
} catch {
  canvas?.remove();
}

if (import.meta.env.DEV) {
  Object.assign(window, { gsap, scene });
}

/* ---- Motion: calm ---- */

if (!reduced) {
  initSmoothScroll();

  const settle = (targets: Element[], stagger = 0.1) => {
    if (targets.length === 0) return;
    gsap.set(targets, { y: 14, autoAlpha: 0 });
    ScrollTrigger.batch(targets, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1.0, ease: "power2.out", stagger }),
    });
  };

  settle(gsap.utils.toArray<HTMLElement>(".jnl-spread"), 0.12);
  settle(gsap.utils.toArray<HTMLElement>(".jnl-margin-item"), 0.1);
  settle(
    [".jnl-letter-text", ".jnl-letter-sig", ".jnl-colophon-title", ".jnl-cta-big"]
      .map((s) => document.querySelector(s))
      .filter((el): el is Element => el !== null),
    0.12,
  );
}
