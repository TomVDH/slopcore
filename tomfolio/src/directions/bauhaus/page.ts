/**
 * Toolhaus page logic: posters pinned from shared content, shapes
 * drifting in the manifesto, rotation-settle entrances. The hero
 * canvas is scoped to the hero (a poster, not a backdrop).
 */

import "../base.css";
import "./page.css";
import "../fonts.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/jost/600.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { initScene, type GlScene } from "../../gl/scene";
import { initSmoothScroll } from "../../anim/smooth-scroll";
import {
  identity,
  image,
  playground,
  playgroundMotto,
  projects,
} from "../../content/portfolio";
import { bauhausFrag } from "./art";

gsap.registerPlugin(ScrollTrigger);

const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("still");
if (reduced) document.documentElement.classList.add("reduced");

/* ---- Content ---- */

const wall = document.querySelector<HTMLElement>(".bh-wall");
if (wall) {
  wall.innerHTML = projects
    .map(
      (p) => `
      <article class="bh-poster">
        <div class="bh-poster-frame">
          <img src="${image(p.slug, 900, 720)}" alt="${p.alt}" loading="lazy" width="900" height="720" />
        </div>
        <div class="bh-poster-body">
          <h3 class="bh-poster-title">${p.title}</h3>
          <p class="bh-poster-meta">${p.category} / ${p.year}</p>
          <p class="bh-poster-summary">${p.summary}</p>
        </div>
      </article>`,
    )
    .join("");
}

const manifesto = document.querySelector<HTMLElement>(".bh-manifesto-text");
if (manifesto) {
  const m = identity.manifesto;
  manifesto.innerHTML = `${m.before}<em>${m.emphasis}</em>${m.after}`;
}

const playGrid = document.querySelector<HTMLElement>(".bh-play-grid");
if (playGrid) {
  playGrid.innerHTML = playground
    .map(
      (item) => `
      <figure class="bh-toy">
        <img src="${image(item.slug, 720, 720)}" alt="${item.alt}" loading="lazy" width="720" height="720" />
        <figcaption>${item.title}<span>${item.detail}</span></figcaption>
      </figure>`,
    )
    .join("");
}

const motto = document.querySelector<HTMLElement>(".bh-motto");
if (motto) {
  motto.innerHTML = playgroundMotto.replace("build one", "<em>build one</em>");
}

const footerRow = document.querySelector<HTMLElement>(".bh-footer-row");
if (footerRow) {
  footerRow.innerHTML = `
    <a href="mailto:${identity.email}">${identity.email}</a>
    <a href="${identity.github}" rel="noopener" target="_blank">GitHub</a>
    <a href="/directions/">Direction shelf</a>`;
}

const fine = document.querySelector<HTMLElement>(".bh-fineprint");
if (fine) fine.textContent = identity.smallPrint;

/* ---- Canvas (hero poster) ---- */

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !new URLSearchParams(window.location.search).has("nogl")) {
    scene = initScene(canvas, reduced, bauhausFrag);
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

/* ---- Motion: playful-precise ---- */

if (!reduced) {
  initSmoothScroll();

  // Hero rows slide in like blocks being set.
  gsap.set(".bh-headline-row", { x: -28, autoAlpha: 0 });
  gsap.set([".bh-sub", ".bh-hero .bh-btn"], { y: 18, autoAlpha: 0 });
  gsap
    .timeline({ delay: 0.1 })
    .to(".bh-headline-row", {
      x: 0,
      autoAlpha: 1,
      duration: 0.55,
      ease: "expo.out",
      stagger: 0.09,
    })
    .to([".bh-sub", ".bh-hero .bh-btn"], {
      y: 0,
      autoAlpha: 1,
      duration: 0.5,
      ease: "expo.out",
      stagger: 0.07,
    }, "-=0.25");

  // Posters settle into their pinned rotation.
  const settleRotate = (targets: HTMLElement[], extra: number, stagger: number) => {
    if (targets.length === 0) return;
    targets.forEach((el) => {
      const final = gsap.getProperty(el, "rotation") as number;
      gsap.set(el, { rotation: final + extra, y: 34, autoAlpha: 0 });
      el.dataset.finalRot = String(final);
    });
    ScrollTrigger.batch(targets, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        batch.forEach((el, i) =>
          gsap.to(el, {
            rotation: Number((el as HTMLElement).dataset.finalRot ?? 0),
            y: 0,
            autoAlpha: 1,
            duration: 0.75,
            ease: "back.out(1.3)",
            delay: i * stagger,
          }),
        ),
    });
  };

  settleRotate(gsap.utils.toArray<HTMLElement>(".bh-poster"), -3, 0.1);
  settleRotate(gsap.utils.toArray<HTMLElement>(".bh-toy"), 3, 0.09);

  // The manifesto shapes drift on slow loops.
  gsap.to(".bh-shape-circle", {
    y: 26,
    duration: 7,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
  });
  gsap.to(".bh-shape-bar", {
    x: 30,
    rotation: -12,
    duration: 9,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
  });
  gsap.to(".bh-shape-square", {
    rotation: 24,
    duration: 11,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
  });

  const rise = (targets: Element[], stagger = 0.08) => {
    if (targets.length === 0) return;
    gsap.set(targets, { y: 22, autoAlpha: 0 });
    ScrollTrigger.batch(targets, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.6, ease: "expo.out", stagger }),
    });
  };
  rise(
    [".bh-manifesto-text", ".bh-motto", ".bh-footer-title", ".bh-footer .bh-btn-big"]
      .map((s) => document.querySelector(s))
      .filter((el): el is Element => el !== null),
    0.08,
  );
}
