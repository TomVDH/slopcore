/**
 * Corner artefact sandbox.
 *
 * An empty viewport, inset 10px: the Presswerk dither (pressFrag) mounted
 * in the bottom-left and CSS-masked so it dissolves into a deep gray-purple
 * ground. Uses the Heather colorway, whose paper equals the page ground
 * exactly, so only the cream marks read.
 *
 * A placeholder right-aligned menu drives the dither: clicking a section
 * re-dithers the field, and the portrait (`public/portrait.jpg`, a
 * placeholder until the real photo is dropped in) is dithered via `uImageOn`.
 * Switching is instant for now (the animated transition was removed).
 * `?still` / reduced motion render a static frame; `?nogl` leaves the ground.
 */

import "../system"; // token + base/component CSS side effects (no custom cursor)
import "./artefact.css";

import { initScene, type GlScene } from "../gl/scene";
import { pressFrag } from "../directions/press/art";

const params = new URLSearchParams(window.location.search);
const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("still");

// Per-section presets. uImageOn 1 dithers the portrait; Info (0) shows field.
const PRESETS: Record<string, number>[] = [
  { uImageOn: 1, uMotif: 1, uCell: 150, uMotifWeight: 0.62, uMotifAngle: 0, uMotifTone: 0.5 }, // Work  — disc
  { uImageOn: 1, uMotif: 3, uCell: 120, uMotifWeight: 0.42, uMotifAngle: 0, uMotifTone: 0.6 }, // Play  — plus
  { uImageOn: 1, uMotif: 4, uCell: 110, uMotifWeight: 0.4, uMotifAngle: 0.08, uMotifTone: 0.5 }, // Words — dash
  { uImageOn: 0, uMotif: 1, uCell: 122, uMotifWeight: 0.6, uMotifAngle: 0, uMotifTone: 0.55 }, // Info  — field
];

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;

function applyPreset(i: number): void {
  const p = PRESETS[i] ?? PRESETS[0];
  if (!scene) return;
  for (const [k, v] of Object.entries(p)) scene.setParam(k, v);
}

try {
  if (canvas && !params.has("nogl")) {
    scene = initScene(canvas, reduced, pressFrag);
    scene.setEnergy(0.9);
    // Constants: the ground palette and field; the menu varies the marks.
    scene.setParam("uColorway", 10); // Heather (paper == page ground)
    scene.setParam("uToneBase", 0.46);
    scene.setParam("uToneContrast", 0.3);
    scene.setParam("uToneScale", 1.6);
    scene.setParam("uDrift", 0.03);
    scene.setParam("uCrossOn", 0); // no registration cross on the artefact
    applyPreset(0);

    // Dither the portrait once it loads (preset already applied above, so a
    // failed load just leaves the Work preset over the grey placeholder).
    const img = new Image();
    img.onload = () => scene?.setImage(img);
    img.src = "/portrait.jpg";
  } else {
    throw new Error("nogl");
  }
} catch {
  document.body.classList.add("no-gl");
  canvas?.remove();
}

/* ---- Placeholder section menu: click to re-dither the field ---- */
const links = Array.from(document.querySelectorAll<HTMLButtonElement>(".art-link"));
for (const btn of links) {
  btn.addEventListener("click", () => {
    for (const b of links) b.classList.toggle("is-active", b === btn);
    applyPreset(Number(btn.dataset.i));
  });
}

if (import.meta.env.DEV) {
  Object.assign(window, { scene });
}
