import "./styles/main.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

import { initScene, type GlScene } from "./gl/scene";
import { resolveVariant } from "./gl/variants";
import { initSmoothScroll } from "./anim/smooth-scroll";
import { runIntro } from "./anim/intro";
import { initNav } from "./anim/nav";
import { initMarquee } from "./anim/marquee";
import { initManifesto } from "./anim/manifesto";
import { initWork } from "./anim/work";
import { initReveals } from "./anim/reveals";
import { initMagnetic } from "./anim/magnetic";
import { initEnergy } from "./anim/energy";

gsap.registerPlugin(ScrollTrigger, SplitText);

// ?still freezes the page like prefers-reduced-motion: one static shader
// frame, native scrolling. Used for visual regression shots.
const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("still");
if (reduced) document.documentElement.classList.add("reduced");

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
const params = new URLSearchParams(window.location.search);
const variant = resolveVariant(params.get("shader"));
try {
  if (canvas && !params.has("nogl")) scene = initScene(canvas, reduced, variant.frag);
  else throw new Error("nogl");
} catch {
  document.documentElement.classList.add("no-gl");
  canvas?.remove();
}

if (!reduced) {
  const lenis = initSmoothScroll();
  initNav(lenis);

  let velocity = 0;
  lenis.on("scroll", (l) => {
    velocity = l.velocity;
  });

  initMarquee(() => velocity);
  initManifesto();
  initWork();
  initReveals();
  initMagnetic();
  if (scene) initEnergy(scene, lenis);

  if (import.meta.env.DEV) {
    Object.assign(window, { lenis });
  }
} else {
  initNav(null);
}

if (import.meta.env.DEV) {
  Object.assign(window, { gsap, scene });
}

runIntro(reduced, scene?.ready ?? Promise.resolve());
