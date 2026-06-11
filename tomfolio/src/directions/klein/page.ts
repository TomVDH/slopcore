/**
 * Bleu page logic: renders shared content into the modular grid and
 * the typographic index, drives the sweep bar with scroll progress,
 * and reveals everything with fast, precise snaps.
 */

import "../base.css";
import "./page.css";
import "../fonts.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { initScene, type GlScene } from "../../gl/scene";
import { initSmoothScroll } from "../../anim/smooth-scroll";
import { currentlyInto, identity, image, projects } from "../../content/portfolio";
import { kleinFrag } from "./art";

gsap.registerPlugin(ScrollTrigger);

const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("still");
if (reduced) document.documentElement.classList.add("reduced");

/* ---- Content ---- */

const grid = document.querySelector<HTMLElement>(".kl-grid");
if (grid) {
  grid.innerHTML = projects
    .map(
      (p) => `
      <article class="kl-piece">
        <figure>
          <img src="${image(p.slug, 960, 600)}" alt="${p.alt}" loading="lazy" width="960" height="600" />
        </figure>
        <div class="kl-piece-caption">
          <h3 class="kl-piece-title">${p.title}</h3>
          <span class="kl-piece-meta">${p.category}, ${p.year}</span>
        </div>
        <p class="kl-piece-summary">${p.summary}</p>
      </article>`,
    )
    .join("");
}

const INDEX = [
  { word: "Strategy", desc: "Positioning, campaign planning, funnels worked weekly." },
  { word: "Identity", desc: "Brand systems and launch kits that survive contact with reality." },
  { word: "Motion", desc: "Shaders, scroll choreography, audio-reactive projection." },
  { word: "Machines", desc: `Plotters and toys. Currently ${currentlyInto.join(", ").toLowerCase()}.` },
];

const indexRows = document.querySelector<HTMLElement>(".kl-index-rows");
if (indexRows) {
  indexRows.innerHTML = INDEX.map(
    (i) => `
    <div class="kl-index-row">
      <span class="kl-index-word">${i.word}</span>
      <span class="kl-index-desc">${i.desc}</span>
    </div>`,
  ).join("");
}

const manifesto = document.querySelector<HTMLElement>(".kl-manifesto-text");
if (manifesto) {
  const m = identity.manifesto;
  manifesto.innerHTML = `${m.before}<em>${m.emphasis}</em>${m.after}`;
}

const footerRow = document.querySelector<HTMLElement>(".kl-footer-row");
if (footerRow) {
  footerRow.innerHTML = `
    <a href="mailto:${identity.email}">${identity.email}</a>
    <a href="${identity.github}" rel="noopener" target="_blank">GitHub</a>
    <a href="/directions/">Direction shelf</a>`;
}

const fine = document.querySelector<HTMLElement>(".kl-fineprint");
if (fine) fine.textContent = identity.smallPrint;

/* ---- Canvas ---- */

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !new URLSearchParams(window.location.search).has("nogl")) {
    scene = initScene(canvas, reduced, kleinFrag);
    scene.setEnergy(0);
  } else {
    throw new Error("nogl");
  }
} catch {
  canvas?.remove();
}

if (import.meta.env.DEV) {
  Object.assign(window, { gsap, scene });
}

/* ---- Motion: precise ---- */

if (!reduced) {
  const lenis = initSmoothScroll();
  lenis.on("scroll", (l) => scene?.setScrollVelocity(l.velocity));

  // Scroll progress drives the sweep bar across the lattice.
  if (scene) {
    const state = { v: 0 };
    gsap.to(state, {
      v: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.4,
      },
      onUpdate: () => scene?.setEnergy(state.v),
    });
  }

  // Hero: one decisive entrance.
  gsap.set([".kl-headline", ".kl-sub", ".kl-hero .kl-btn"], { y: 16, autoAlpha: 0 });
  gsap.to([".kl-headline", ".kl-sub", ".kl-hero .kl-btn"], {
    y: 0,
    autoAlpha: 1,
    duration: 0.5,
    ease: "expo.out",
    stagger: 0.06,
    delay: 0.1,
  });

  const snap = (targets: Element[], stagger = 0.05) => {
    if (targets.length === 0) return;
    gsap.set(targets, { y: 16, autoAlpha: 0 });
    ScrollTrigger.batch(targets, {
      start: "top 90%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.4, ease: "expo.out", stagger }),
    });
  };

  snap(gsap.utils.toArray<HTMLElement>(".kl-piece"), 0.07);
  snap(gsap.utils.toArray<HTMLElement>(".kl-index-row"), 0.05);
  snap(
    [".kl-manifesto-text", ".kl-footer-title", ".kl-footer .kl-btn-big"]
      .map((s) => document.querySelector(s))
      .filter((el): el is Element => el !== null),
    0.06,
  );
}
