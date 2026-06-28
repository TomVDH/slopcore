/**
 * Corner artefact sandbox.
 *
 * An empty viewport: the Presswerk dither (pressFrag) mounted in the
 * bottom-left and CSS-masked so it dissolves into a gray-purple ground.
 * Uses the Heather colorway, whose paper equals the page ground exactly,
 * so only the cream disc marks read. `?still` / reduced motion render a
 * static frame; `?nogl` leaves the bare ground.
 */

import "../system"; // token + base/component CSS side effects (no custom cursor)
import "./artefact.css";

import { initScene, type GlScene } from "../gl/scene";
import { pressFrag } from "../directions/press/art";

const params = new URLSearchParams(window.location.search);
const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("still");

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !params.has("nogl")) {
    scene = initScene(canvas, reduced, pressFrag);
    scene.setEnergy(0.9);
    // Cream discs on the gray-purple ground (Heather paper == page bg, so
    // the plate has no visible edge; only the marks survive the CSS mask).
    scene.setParam("uColorway", 10); // Heather
    scene.setParam("uMotif", 1); // Disc
    scene.setParam("uMotifWeight", 0.6);
    scene.setParam("uMotifTone", 0.55); // dots swell where the field darkens
    scene.setParam("uCell", 122);
    scene.setParam("uToneBase", 0.46);
    scene.setParam("uToneContrast", 0.3);
    scene.setParam("uToneScale", 1.6);
    scene.setParam("uDrift", 0.03);
    scene.setParam("uCrossOn", 0); // no registration cross on the artefact
  } else {
    throw new Error("nogl");
  }
} catch {
  document.body.classList.add("no-gl");
  canvas?.remove();
}

if (import.meta.env.DEV) {
  Object.assign(window, { scene });
}
