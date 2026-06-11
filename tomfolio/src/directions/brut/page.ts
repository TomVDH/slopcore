/**
 * Direction: Brut. Page runtime.
 *
 * Ceremonial motion on native scroll: IntersectionObserver reveals
 * (deco voice, slow rise), scrawl ink-ins (brut voice, chunky steps),
 * directory rail sync, nav solidify, and the sunburst canvas.
 *
 * Hidden states exist only when JS runs (body.js); without JS the page
 * is fully readable. `?still` or reduced motion renders everything
 * visible with a single static canvas frame.
 */

import "../base.css";
import "./page.css";
import "@fontsource/limelight/400.css";
import "@fontsource/poiret-one/400.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/jost/600.css";
import "@fontsource/permanent-marker/400.css";

import { initRays } from "./canvas";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const still = new URLSearchParams(window.location.search).has("still");
const staticMode = reduceMotion || still;

document.body.classList.add("js");
if (staticMode) {
  document.body.classList.add("still");
  document.documentElement.style.scrollBehavior = "auto";
}

/* Canvas + velocity marquee (one shared loop) ------------------------ */

const track = document.querySelector<HTMLElement>(".marquee-track");
let marqueeX = 0;

const driveMarquee = (dt: number, scrollVel: number): void => {
  if (!track) return;
  const unit = track.scrollWidth / 2;
  if (unit <= 0) return;
  const speed = 60 + Math.max(-640, Math.min(640, scrollVel * 420));
  marqueeX = (((marqueeX - (speed * dt) / 1000) % unit) - unit) % unit;
  track.style.transform = `translate3d(${marqueeX}px, 0, 0)`;
};

const canvas = document.getElementById("rays");
const rays =
  canvas instanceof HTMLCanvasElement
    ? initRays(canvas, staticMode, staticMode ? undefined : driveMarquee)
    : undefined;

/* The sun takes a click on the chin -------------------------------- */

const face = document.querySelector(".sun-face");
let winkTimer = 0;

if (!staticMode) {
  document.querySelector(".hero")?.addEventListener("pointerdown", () => {
    rays?.kick();
    if (!face) return;
    face.classList.add("wink");
    window.clearTimeout(winkTimer);
    winkTimer = window.setTimeout(() => face.classList.remove("wink"), 550);
  });
}

/* Reveals + scrawl inking ------------------------------------------- */

const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
const inkables = Array.from(
  document.querySelectorAll<HTMLElement>(".creed-frame, .plate-in, .stub, .footer-brut"),
);

if (staticMode) {
  for (const el of reveals) el.classList.add("is-in");
  for (const el of inkables) el.classList.add("is-inked");
  document.querySelector(".hero-title")?.classList.add("is-inked");
  document.querySelector(".sun-face")?.classList.add("is-inked");
  document.querySelector(".foot-arrow")?.classList.add("is-inked");
} else {
  // Hold the entrance until the page is actually being looked at, so a
  // background-tab load does not play the ceremony to an empty house.
  const startMotion = (): void => {
    const revealIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          revealIO.unobserve(entry.target);
        }
      },
      { threshold: 0.18 },
    );
    for (const el of reveals) revealIO.observe(el);

    const inkIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-inked");
          inkIO.unobserve(entry.target);
        }
      },
      { threshold: 0.5 },
    );
    for (const el of inkables) inkIO.observe(el);
    const arrow = document.querySelector(".foot-arrow");
    if (arrow) inkIO.observe(arrow);

    // The hero scrawl signs itself once the deco lines have settled,
    // then the hand puts a face on the risen sun.
    window.setTimeout(() => {
      document.querySelector(".hero-title")?.classList.add("is-inked");
    }, 950);
    window.setTimeout(() => {
      document.querySelector(".sun-face")?.classList.add("is-inked");
    }, 1750);
  };

  if (document.visibilityState === "hidden") {
    document.addEventListener("visibilitychange", () => startMotion(), { once: true });
  } else {
    startMotion();
  }
}

/* Nav: transparent over the hero, lacquer once scrolled -------------- */

const nav = document.querySelector(".nav");
const sentinel = document.getElementById("nav-sentinel");
if (nav && sentinel) {
  new IntersectionObserver((entries) => {
    nav.classList.toggle("is-solid", !entries[0].isIntersecting);
  }).observe(sentinel);
}

/* Directory rail: track which plate is in the viewing band ----------- */

const rows = Array.from(document.querySelectorAll<HTMLAnchorElement>(".dir-row"));
const plates = Array.from(document.querySelectorAll<HTMLElement>(".plate"));

if (rows.length && plates.length) {
  const byId = new Map(rows.map((row) => [row.hash.slice(1), row]));

  const setActive = (id: string): void => {
    for (const row of rows) row.classList.toggle("is-active", row === byId.get(id));
  };

  const plateIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    },
    { rootMargin: "-42% 0px -42% 0px" },
  );
  for (const plate of plates) plateIO.observe(plate);
  setActive(plates[0].id);
}
