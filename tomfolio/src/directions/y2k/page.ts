/**
 * TT2000 page logic: chrome blob canvas behind everything, springy
 * entrances, one marquee, and the pinned horizontal showroom (desktop
 * only; it stacks on touch and narrow screens).
 */

import "../base.css";
import "./page.css";
import "../fonts.css";
import "@fontsource/poiret-one/400.css";
import "@fontsource/permanent-marker/400.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { initScene, type GlScene } from "../../gl/scene";
import { initSmoothScroll } from "../../anim/smooth-scroll";
import { initMarquee } from "../../anim/marquee";
import {
  identity,
  image,
  playground,
  playgroundMotto,
  projects,
} from "../../content/portfolio";
import { y2kFrag } from "./art";

gsap.registerPlugin(ScrollTrigger);

const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("still");
if (reduced) document.documentElement.classList.add("reduced");

/* ---- Content ---- */

const track = document.querySelector<HTMLElement>(".yk-track");
if (track) {
  track.innerHTML = projects
    .map(
      (p) => `
      <article class="yk-card">
        <div class="yk-card-inner">
          <img src="${image(p.slug, 880, 660)}" alt="${p.alt}" loading="lazy" width="880" height="660" />
          <div class="yk-card-body">
            <h3 class="yk-card-title">${p.title}</h3>
            <p class="yk-card-meta">${p.category} / ${p.year}</p>
            <p class="yk-card-summary">${p.summary}</p>
          </div>
        </div>
      </article>`,
    )
    .join("");
}

const manifesto = document.querySelector<HTMLElement>(".yk-manifesto-text");
if (manifesto) {
  const m = identity.manifesto;
  manifesto.innerHTML = `${m.before}<em>${m.emphasis}</em>${m.after}`;
}

const wall = document.querySelector<HTMLElement>(".yk-wall");
if (wall) {
  wall.innerHTML =
    playground
      .map(
        (item) => `
        <figure class="yk-polaroid">
          <img src="${image(item.slug, 700, 700)}" alt="${item.alt}" loading="lazy" width="700" height="700" />
          <figcaption>${item.title}<span>${item.detail}</span></figcaption>
        </figure>`,
      )
      .join("") + `<p class="yk-motto">${playgroundMotto}</p>`;
}

const footerRow = document.querySelector<HTMLElement>(".yk-footer-row");
if (footerRow) {
  footerRow.innerHTML = `
    <a href="mailto:${identity.email}">${identity.email}</a>
    <a href="${identity.github}" rel="noopener" target="_blank">GitHub</a>
    <a href="/directions/">Direction shelf</a>`;
}

const fine = document.querySelector<HTMLElement>(".yk-fineprint");
if (fine) fine.textContent = identity.smallPrint;

/* ---- Canvas ---- */

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !new URLSearchParams(window.location.search).has("nogl")) {
    scene = initScene(canvas, reduced, y2kFrag);
  } else {
    throw new Error("nogl");
  }
} catch {
  canvas?.remove();
}

if (import.meta.env.DEV) {
  Object.assign(window, { gsap, scene });
}

/* ---- Motion: springy ---- */

if (!reduced) {
  const lenis = initSmoothScroll();

  let velocity = 0;
  lenis.on("scroll", (l) => {
    velocity = l.velocity;
    scene?.setScrollVelocity(l.velocity);
  });
  initMarquee(() => velocity);

  // Canvas energy: lively at the hero, idling through the middle,
  // back up for the footer.
  if (scene) {
    const state = { v: 1 };
    gsap
      .timeline({
        scrollTrigger: {
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
        },
        onUpdate: () => scene?.setEnergy(state.v),
      })
      .to(state, { v: 0.35, ease: "none", duration: 0.5 })
      .to(state, { v: 1.1, ease: "none", duration: 0.5 });
  }

  // Hero entrance: springy pops.
  gsap.set([".yk-headline-line", ".yk-sub", ".yk-hero .yk-btn"], { y: 30, autoAlpha: 0 });
  gsap.set([".yk-sticker-a", ".yk-sticker-b"], { scale: 0, autoAlpha: 0 });
  gsap
    .timeline({ delay: 0.15 })
    .to(".yk-headline-line", {
      y: 0,
      autoAlpha: 1,
      duration: 0.8,
      ease: "back.out(1.6)",
      stagger: 0.1,
    })
    .to([".yk-sub", ".yk-hero .yk-btn"], {
      y: 0,
      autoAlpha: 1,
      duration: 0.6,
      ease: "back.out(1.4)",
      stagger: 0.08,
    }, "-=0.4")
    .to([".yk-sticker-a", ".yk-sticker-b"], {
      scale: 1,
      autoAlpha: 1,
      duration: 0.55,
      ease: "back.out(2.2)",
      stagger: 0.12,
    }, "-=0.3");

  // The showroom: pinned horizontal pan on fine-pointer desktop only.
  const mm = gsap.matchMedia();
  mm.add("(min-width: 768px)", () => {
    const pan = document.querySelector<HTMLElement>(".yk-pan");
    const trackEl = document.querySelector<HTMLElement>(".yk-track");
    if (!pan || !trackEl) return;

    const distance = () => trackEl.scrollWidth - window.innerWidth;
    const tween = gsap.to(trackEl, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: pan,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  });

  // Soft pops for the rest.
  const pop = (targets: Element[], stagger = 0.1) => {
    if (targets.length === 0) return;
    gsap.set(targets, { y: 26, autoAlpha: 0 });
    ScrollTrigger.batch(targets, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          y: 0,
          autoAlpha: 1,
          duration: 0.7,
          ease: "back.out(1.5)",
          stagger,
        }),
    });
  };
  pop(gsap.utils.toArray<HTMLElement>(".yk-polaroid"), 0.12);
  pop(
    [".yk-manifesto-text", ".yk-motto", ".yk-footer-title", ".yk-footer .yk-btn-big"]
      .map((s) => document.querySelector(s))
      .filter((el): el is Element => el !== null),
    0.1,
  );
}
