/**
 * Letterpress sandbox runtime.
 *
 * Mounts the Presswerk dither (pressFrag) into a centered 4:3 framed
 * plate via the shared initScene engine, and boots the site system
 * (tokens, base, components, fonts) plus the custom registration cursor.
 * The only shader interaction is its own cursor press (uMouse /
 * uMouseStrength). `?still` or reduced motion gives a static frame;
 * `?nogl` or a missing context falls back to a CSS dot texture.
 */

import { initCursor } from "../system";
import "./letterpress.css";

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
if (fine) fine.textContent = "LETTERPRESS PLATE // EFFECT SANDBOX";

initCursor();

if (import.meta.env.DEV) {
  Object.assign(window, { scene });
}
