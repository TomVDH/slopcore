/**
 * Letterpress sandbox runtime.
 *
 * Mounts the Presswerk dither (pressFrag) into a small centered 4:3
 * plate via the shared initScene engine, which sizes to the canvas
 * element and renders a synchronous first frame. The only interaction
 * is the shader's own cursor press (uMouse / uMouseStrength). `?still`
 * or reduced motion gives a static frame; `?nogl` or a missing context
 * falls back to a CSS dot texture so the plate never reads broken.
 */

import "./letterpress.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import { initScene, type GlScene } from "../gl/scene";
import { pressFrag } from "../directions/press/art";
import { identity } from "../content/portfolio";

const params = new URLSearchParams(window.location.search);
const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("still");

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !params.has("nogl")) {
    scene = initScene(canvas, reduced, pressFrag);
    // The plate is a finished proof, not a screensaver: full press pressure.
    scene.setEnergy(1);
  } else {
    throw new Error("nogl");
  }
} catch {
  document.body.classList.add("no-gl");
  canvas?.remove();
}

const fine = document.querySelector<HTMLElement>(".lp-fine");
if (fine) fine.textContent = identity.smallPrint;

if (import.meta.env.DEV) {
  Object.assign(window, { scene });
}
