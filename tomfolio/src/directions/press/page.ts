/**
 * Presswerk page logic: renders shared content into the compartment
 * grid, runs the constant-speed ticker, and snaps sections in with
 * stepped, mechanical reveals. Native scroll throughout; the press
 * does not glide.
 */

import "../base.css";
import "./page.css";
import "../fonts.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource-variable/archivo/index.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { initScene, type GlScene } from "../../gl/scene";
import { initMarquee } from "../../anim/marquee";
import {
  currentlyInto,
  identity,
  image,
  projects,
} from "../../content/portfolio";
import { pressFrag } from "./art";

gsap.registerPlugin(ScrollTrigger);

const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("still");
if (reduced) document.documentElement.classList.add("reduced");

/* ---- Content rendering ---- */

const rows = document.querySelector<HTMLOListElement>(".press-rows");
if (rows) {
  rows.innerHTML = projects
    .map(
      (p, i) => `
      <li class="press-row">
        <span class="press-row-num" aria-hidden="true">0${i + 1}</span>
        <span class="press-row-title">${p.title}</span>
        <span class="press-row-summary">${p.summary}</span>
        <span class="press-row-meta"><span>${p.category}</span><span>${p.year}</span></span>
        <figure class="press-row-figure">
          <img src="${image(p.slug, 640, 420)}" alt="${p.alt}" loading="lazy" width="640" height="420" />
        </figure>
      </li>`,
    )
    .join("");
}

const SPEC = [
  { key: "A.1", name: "Strategy", desc: "Positioning, campaign planning, the long funnel worked weekly" },
  { key: "A.2", name: "Identity", desc: "Brand systems, launch kits, type that holds at any size" },
  { key: "B.1", name: "Motion", desc: "Shaders, scroll choreography, audio-reactive projection" },
  { key: "B.2", name: "Machines", desc: `Plotters and toys. Currently: ${currentlyInto.join(", ").toLowerCase()}` },
];

const specGrid = document.querySelector<HTMLElement>(".press-spec-grid");
if (specGrid) {
  specGrid.innerHTML =
    SPEC.map(
      (s) => `
      <div class="press-spec-cell">
        <span class="press-spec-key">${s.key}</span>
        <span class="press-spec-name">${s.name}</span>
        <span class="press-spec-desc">${s.desc}</span>
      </div>`,
    ).join("") +
    `<span class="press-cross" style="top: -8px; left: 25%"></span>
     <span class="press-cross" style="top: -8px; left: 50%"></span>
     <span class="press-cross" style="top: -8px; left: 75%"></span>`;
}

const notice = document.querySelector<HTMLElement>(".press-notice-text");
if (notice) {
  const m = identity.manifesto;
  notice.innerHTML = `${m.before}<em>${m.emphasis}</em>${m.after}`;
}

const contactRow = document.querySelector<HTMLElement>(".press-contact-row");
if (contactRow) {
  contactRow.innerHTML = `
    <a href="mailto:${identity.email}">${identity.email}</a>
    <a href="${identity.github}" rel="noopener" target="_blank">GitHub</a>
    <a href="/directions/">Direction shelf</a>`;
}

const fine = document.querySelector<HTMLElement>(".press-fineprint");
if (fine) fine.textContent = identity.smallPrint;

/* ---- Canvas: the dither plate ---- */

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !new URLSearchParams(window.location.search).has("nogl")) {
    scene = initScene(canvas, reduced, pressFrag);
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

/* ---- Motion: mechanical ---- */

if (!reduced) {
  initMarquee(() => 0);

  const stamp = (targets: Element[], stagger = 0.06) => {
    if (targets.length === 0) return;
    gsap.set(targets, { autoAlpha: 0 });
    ScrollTrigger.batch(targets, {
      start: "top 90%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { autoAlpha: 1, duration: 0.4, ease: "steps(3)", stagger }),
    });
  };

  stamp(gsap.utils.toArray<HTMLElement>(".press-row"), 0.08);
  stamp(gsap.utils.toArray<HTMLElement>(".press-spec-cell"), 0.07);

  const single = [".press-notice-text", ".press-contact-title", ".press-contact .press-btn-big"];
  for (const sel of single) {
    const el = document.querySelector(sel);
    if (!el) continue;
    gsap.set(el, { autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => gsap.to(el, { autoAlpha: 1, duration: 0.35, ease: "steps(3)" }),
    });
  }
}
