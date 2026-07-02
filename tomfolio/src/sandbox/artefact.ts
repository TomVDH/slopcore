/**
 * Corner artefact sandbox.
 *
 * An empty viewport, inset 25px (white margin): the Presswerk dither mounted
 * full-height in the bottom-left, dissolving into the deep ground. The
 * right-aligned menu lists one item per dither sample (auto-discovered from
 * src/samples/) plus Field; picking one cross-fades the dithered image (dip
 * through the field, swap under cover, fade back in, quad ease). The colorway
 * (Palette) drives the ground + menu text. The menu arrangement is switchable
 * via `?layout=` (rail default / spine / ladder). A bottom-right Reveal button
 * smoothly crossfades the dithered plate to the full-res source photo (`uReveal`).
 * With `?dev`, a grouped dev bar exposes the treatment over two rows — Mark
 * (motif / cell / palette), Colour (RGB full-colour dither / levels), Tone
 * (brightness / contrast / invert), Dissolve (fade / cloud), View (Copy values) —
 * with a live settings readout. `?still` / reduced motion snap; `?nogl` leaves
 * the ground.
 */

import { setColorway } from "../system"; // token + base/component CSS side effects (no custom cursor)
import "./artefact.css";

import { gsap } from "gsap";
import { initScene, type GlScene } from "../gl/scene";
import { pressFrag } from "../directions/press/art";
import { PALETTES, COLORS } from "../palettes";
import { SAMPLES, sampleSrc } from "../samples";
import { EASES, FPS_MODES, FPS_LABELS, DEFAULT_MOTION, applyFps, type FpsMode } from "../system/motion";
import {
  loadTreatments, scheduleStore, storeDirty, markStoreClean, downloadTreatments, clearLocalTreatments,
  type StoreState,
} from "./treatments";

const params = new URLSearchParams(window.location.search);
const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("still");

// Menu arrangement (`?layout=`). rail = right-aligned display headers (default);
// spine = labels rotated up the right margin; ladder = mono captions stepping
// down the dither's fading edge. All three just re-place the same .art-menu; the
// content reveal (the dithered image swap) is identical across them.
const LAYOUTS = ["rail", "spine", "ladder"] as const;
const layoutParam = params.get("layout") ?? "";
const layout = (LAYOUTS as readonly string[]).includes(layoutParam) ? layoutParam : "rail";
document.body.classList.add(`art-layout-${layout}`);

const MOTIFS = ["Dots", "Disc", "X", "Plus", "Dash"];
// COLORS (dev-bar palette labels) is derived from PALETTE_DATA — see ../palettes.

// This module owns global window/document listeners, a redraw interval, and a WebGL
// context, none individually torn down — and they don't need to be: it's an entry
// module nothing HMR-accepts, so Vite does a clean FULL reload on edit (no stacking of
// duplicate listeners / cursors / GL contexts). If a parent ever self-accepts this
// module, add explicit teardown (AbortController + clearInterval + scene dispose) here.
// Index === uCursorMode value === the shader's if-ladder (keep in lockstep).
const CURSOR_MODES = ["Off", "Clear", "Ink", "Bias", "Negative", "Develop"];

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;

// Unified look state: the menu sets `image`, the dev bar sets the treatment.
const look = {
  image: "collection-207", // a sample key, or "field"
  motif: 1,
  colorway: 37, // Cyber
  marginAccent: 0, // frame margin colour: 0 body/ink, 1 brand accent
  cell: 306,
  plateWidth: 0.71, // plate box width as a fraction of the viewport (the photo fits into it via Fit/Pos)
  weight: 0.62,
  angle: 0,
  tone: 0.5,
  brightness: 0.15, // image brightness (added)
  contrast: 1, // image contrast (around mid)
  fit: 0, // image fit: 0 cover (crop), 1 contain (letterbox)
  posX: 0, // image anchor X (−1..2; 0 left, 0.5 centre, 1 right; <0 bleeds off-edge left)
  posY: 0.5, // image anchor Y in [0,1] (0 bottom, 0.5 centre, 1 top)
  zoom: 1, // image zoom within the plate (1 = fit, >1 zoomed in, <1 zoomed out)
  edgeFade: 0.12, // edge taper width: dissolve the plate's right edge into the ground (cloud modes)
  edgeCurve: 1, // edge taper ramp shape (higher = more gradual, lower = harder shoulder)
  edgeDepth: 1, // edge taper dissolve amount (1 = to ground, <1 = partial dot veil)
  invert: 0, // resolved 0/1 actually pushed to uInvert
  invertMode: 2, // Invert control: 0 Off, 1 On, 2 Auto (image-decided)
  fadeMode: 2, // 0 off, 1 simple gradient, 2 cloud
  cloudSize: 1.2, // cloud-noise frequency X (mode 2) — smaller = bigger billows
  cloudSizeY: 1.2, // cloud-noise frequency Y (independent stretch)
  noiseType: 0, // cloud noise: 0 fbm, 1 ridged, 2 voronoi, 3 turbulence, 4 cracks
  fadeWarp: 0, // domain-warp amount on the cloud noise (organic swirl)
  cloudW: 1, // cloud horizontal extent, independent of the image width (1 = plate)
  cloudAnim: 1, // cloud (mode 2): 1 scroll sideways, 0 static
  cloudSpeed: 0.01, // cloud sideways scroll speed
  fadePosX: 0.4, // dissolve anchor X in [0,1] (0 = left)
  fadePosY: 0, // dissolve anchor Y in [0,1] (0 = bottom)
  fadeReach: 1.45, // dissolve reach: distance at which the fade fully completes (bigger = more solid)
  fadeSoft: 1.15, // dissolve softness: width of the gradient band (bigger = more gradual)
  maskView: 0, // dev: 1 = show the raw fade mask as grayscale
  cursorView: 0, // dev: 1 = show raw cursor influence (infl) as grayscale
  showCanvas: 0, // dev: 1 = fluo border on the canvas/plate edge
  showImage: 0, // dev: 1 = fluo border on the fitted image's edge
  showCloud: 0, // dev: 1 = fluo line on the mask contour
  reveal: 0, // 0 dithered, 1 full-res photo in natural light (Reveal tweens between)
  imageState: 0, // dev: 1 shows the adjusted source the dither reads, undithered
  colorDither: 0, // 0 duotone (palette), 1 full-colour ordered dither
  colorLevels: 4, // posterise steps per channel in colour mode
  markBright: 0, // brightness offset on the dither mark colour (relative to the palette ink)
  cursorMode: 2, // 0 off, 1 clear, 2 ink, 3 bias, 4 negative, 5 develop
  cursorAmp: 0.4, // cursor strength
  cursorRadius: 1.4, // cursor disc falloff (larger = tighter)
  cursorHold: 0, // static persistence floor under the movement-driven strength
  cursorEdge: 0.25, // negative-mode disc hardness
  cursorDetail: 306, // develop sub-grid cell count (same units as `cell`)
  cursorColorize: 1, // develop colorize amount: 0 monochrome .. 1 full colour
  cursorStage: 0.45, // develop: grain->photo handoff point (0..1 of the press)
  cursorResolve: 1, // develop: how far a full press resolves toward the photo (0..1)
  cursorSat: 1, // develop: saturation of the resolved colour (0 gray .. 2 boost)
  cursorSharp: 0, // develop: local-contrast / unsharp pop
  cursorLevels: 4, // develop: posterise steps per channel (own Levels, vs colorLevels)
  cursorBright: 0, // develop: own brightness offset (on top of image B)
  cursorContrast: 1, // develop: own contrast (on top of image C)
};

const imgCache = new Map<string, HTMLImageElement>();
function loadImg(src: string): Promise<HTMLImageElement | null> {
  const hit = imgCache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      imgCache.set(src, im);
      resolve(im);
    };
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

/* ---- Auto invert: pick the natural polarity for the current palette ----
   The dither inks the dark tones (lum below the Bayer mid -> ink mark, else
   paper), so whether an un-inverted photo reads as a positive or as a negative
   depends on the PALETTE, not the image: when the ink (marks) is lighter than
   the paper (ground) — a dark-paper colorway — the bright parts of a photo must
   map to the ink, which means inverting. Auto applies exactly that, so a natural
   photo reads right on any colorway with no manual toggling. (Polarity is a
   palette property — image content does NOT change which polarity reads natural;
   the workflow's image-histogram heuristic renders dark photos as negatives, so
   it was rejected. Image content only matters as deliberate artistic intent,
   which is what manual On/Off is for.) */
interface AutoResult { invert: number; paperLum: number; inkLum: number; gap: number; }
let lastAuto: AutoResult | null = null;
let onAutoResolved: (() => void) | null = null;

function lumaHex(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Resolve look.invert (0/1) from the Invert control mode (0 Off, 1 On, 2 Auto).
// Auto inverts when the palette's paper is darker than its ink (dark-paper stock).
function resolveAuto(): void {
  if (look.invertMode !== 2) {
    look.invert = look.invertMode === 1 ? 1 : 0;
    lastAuto = null;
  } else {
    const pal = PALETTES[look.colorway] ?? PALETTES[10];
    const paperLum = lumaHex(pal.paper);
    const inkLum = lumaHex(pal.ink);
    look.invert = paperLum < inkLum ? 1 : 0;
    lastAuto = { invert: look.invert, paperLum, inkLum, gap: Math.abs(inkLum - paperLum) };
  }
  onAutoResolved?.();
}

function pushAutoInvert(): void {
  resolveAuto();
  if (scene) scene.setParam("uInvert", look.invert);
}

let curImageSrc: string | null = null;
let txToken = 0;

// The GL canvas is a FIXED stage — full plate height × (plateWidth × viewport width),
// left-aligned — so the page flow stays consistent regardless of which image loads.
// Each photo is cover-fit INTO this box by the shader (Image > Fit / Pos / Zoom),
// cropping the overflow; an image's source size/aspect never moves the layout (images
// are pre-edited to suit the canvas). Canvas precedence, NOT image precedence.
let curImageEl: HTMLImageElement | null = null;
function applyCanvasWidth(): void {
  if (!canvas) return;
  const frame = canvas.parentElement as HTMLElement | null;
  if (!frame || !frame.clientWidth) {
    canvas.style.width = ""; // frame not laid out yet — fall back to CSS (never 0px)
    return;
  }
  // The plate is a FIXED box: full height × (Width × viewport width). The photo is
  // fitted into it by the shader (Image > Fit / Pos), independent of its own aspect
  // — so cover/contain/position actually have room to act.
  canvas.style.width = `${Math.round(frame.clientWidth * look.plateWidth)}px`;
}
let onImageChange: (() => void) | null = null; // dev-bar image thumbnail hook
function fitCanvas(im: HTMLImageElement | null): void {
  curImageEl = im;
  applyCanvasWidth();
  window.dispatchEvent(new Event("resize")); // scene re-measures uRes off the new box
  onImageChange?.();
}
window.addEventListener("resize", applyCanvasWidth, { passive: true });

const cur = { uImageOn: 0 }; // tweened field<->image crossfade amount
const xf = { v: 0 }; // tweened image<->image crossfade amount (uXfade)

function pushXfade(): void {
  if (scene) scene.setParam("uXfade", xf.v);
}

function applyColorwayChrome(i: number): void {
  setColorway(i); // system bridge: --ground/--ink/--art-cursor/--art-accent on body
  // Frame margin (the body bg showing around the plate): body ink, or the colorway
  // accent. Page policy, deliberately NOT part of the system setColorway.
  document.body.style.background = look.marginAccent ? "var(--art-accent)" : "var(--ink)";
}

// Straight uniform <- look-field pushes (1:1, numeric). The single place to wire a
// new numeric param's uniform; the derived / vec2 / conditional values stay explicit
// in pushTreatment below. Field names must match the `look` object.
const PARAM_UNIFORMS: ReadonlyArray<readonly [string, keyof typeof look]> = [
  ["uMotif", "motif"], ["uColorway", "colorway"], ["uMotifWeight", "weight"],
  ["uMotifAngle", "angle"], ["uMotifTone", "tone"], ["uImageBrightness", "brightness"],
  ["uImageContrast", "contrast"], ["uFadeMode", "fadeMode"], ["uFadeScale", "cloudSize"],
  ["uFadeScaleY", "cloudSizeY"], ["uNoiseType", "noiseType"], ["uFadeWarp", "fadeWarp"],
  ["uCloudWidth", "cloudW"], ["uFit", "fit"], ["uImgScale", "zoom"], ["uEdgeFade", "edgeFade"],
  ["uEdgeCurve", "edgeCurve"], ["uEdgeDepth", "edgeDepth"],
  ["uFadeReach", "fadeReach"], ["uFadeSoft", "fadeSoft"],
  ["uMaskView", "maskView"], ["uCursorView", "cursorView"],
  ["uShowCanvas", "showCanvas"], ["uShowImage", "showImage"], ["uShowCloud", "showCloud"],
  ["uColorDither", "colorDither"],
  ["uColorLevels", "colorLevels"], ["uMarkBright", "markBright"], ["uCursorMode", "cursorMode"],
  ["uCursorAmp", "cursorAmp"], ["uCursorRadius", "cursorRadius"], ["uHold", "cursorHold"],
  ["uCursorEdge", "cursorEdge"], ["uDevCell", "cursorDetail"], ["uDevColor", "cursorColorize"],
  ["uDevStage", "cursorStage"], ["uDevResolve", "cursorResolve"], ["uDevSat", "cursorSat"],
  ["uDevLevels", "cursorLevels"], ["uDevSharp", "cursorSharp"], ["uDevBright", "cursorBright"],
  ["uDevContrast", "cursorContrast"],
];

function pushTreatment(): void {
  if (!scene) return;
  resolveAuto(); // refresh resolved polarity before pushing uInvert (Auto re-evaluates per palette)
  for (const [uniform, field] of PARAM_UNIFORMS) scene.setParam(uniform, look[field] as number);
  // Derived / vec2 / conditional values stay explicit:
  scene.setParam("uCell", effectiveCell());
  scene.setParam("uInvert", look.invert);
  scene.setParam("uImgAlign", [look.posX, look.posY]);
  scene.setParam("uFadePos", [look.fadePosX, look.fadePosY]);
  scene.setParam("uCloudSpeed", look.cloudAnim ? look.cloudSpeed : 0);
  applyColorwayChrome(look.colorway);
  persistLook(); // auto-save the live look to its context (general, or this image's config)
}

// ---- Per-image parameters ---------------------------------------------------
// Two tiers. `general` is the live dev-menu config — it applies to EVERY image
// that has no config of its own, so menu changes carry across all un-pinned
// images. An image only deviates once you "Save to image" (writes its own config);
// visiting an un-pinned image shows `general`, returning to a written one reads its
// config back. Editing auto-persists to the current context (the image's own config
// if it has one, else `general`). Full readout — general + per-image — in Copy JSON.
const PARAM_SKIP = new Set(["image", "maskView", "cursorView", "showCanvas", "showImage", "showCloud", "imageState", "reveal", "invert"]);
function snapshotParams(): Record<string, number> {
  const p: Record<string, number> = {};
  for (const [k, v] of Object.entries(look)) {
    if (!PARAM_SKIP.has(k) && typeof v === "number") p[k] = v;
  }
  return p;
}
let general = snapshotParams(); // the live general/menu config (un-pinned images use it)
const imageParams: Record<string, Record<string, number>> = {}; // per-image written configs
let refreshControls: (() => void) | null = null; // dev-bar display refresh hook
const isPinned = (key: string): boolean => Object.prototype.hasOwnProperty.call(imageParams, key);
// Write the live look back to its context: the image's own config if it has one,
// otherwise the shared general. Called on every edit (via pushTreatment).
let persistGuard = false; // contact sheet drives the scene without dirtying the store
function persistLook(): void {
  if (persistGuard) return;
  if (isPinned(look.image)) imageParams[look.image] = snapshotParams();
  else general = snapshotParams();
  pushStore(); // debounced crash-pad write (treatments store)
}
// Load an image's treatment: its written config if any, else the general menu config.
function applyImageParams(key: string): void {
  Object.assign(look, imageParams[key] ?? general);
  refreshControls?.();
}
function pinCurrentImageParams(): void { // give this image its own config
  imageParams[look.image] = snapshotParams();
  pushStore();
}
function clearCurrentImageParams(): void { // drop it → back to the general menu config
  delete imageParams[look.image];
  Object.assign(look, general);
  refreshControls?.();
  if (scene) pushTreatment();
  pushStore();
}

// Reveal: smoothly crossfade the dither <-> full-res photo AND ramp the cell
// frequency up 32x so the marks shrink and resolve into the image. `rev.v` is
// the tweened amount [0..1]; `look.reveal` is the 0/1 target the button flips.
//
// The ramp is GEOMETRIC, not linear. On-screen mark size is `uRes.y / uCell`
// (see pressFrag), so size ∝ 1/uCell. A linear uCell ramp shrinks the marks as
// 1/(1+31·v) — ~75% of the shrink lands in the first 10% of the tween, so the
// dither resolves to fine grain almost instantly while the photo crossfade
// (uReveal, linear in v) is still near zero: the two read as out of sync.
// Scaling uCell by MULT^v makes log-resolution linear in v, so the perceived
// "resolving" of the marks advances in lockstep with the crossfade.
// Live-tunable motion for every dither/reveal transition — the Reveal crossfade
// + geometric cell depixel, and all the image crossfades — so they move as one.
// Driven by the dev-bar Motion group for testing. Default is a quint ease-OUT:
// fast attack, then a long deceleration that settles into the final frame, so
// the motion lands instead of gliding (matches the collapse's easeOutQuint). The
// list leans ease-out (slow into the end), plus a couple of comparison curves.
// Ease list + FPS presets live in the system motion vocabulary (system/motion.ts);
// `motion` stays page-local mutable state, driven by the dev-bar Motion group.
const motion = { ...DEFAULT_MOTION };
const mEase = (): string => EASES[motion.easeIdx][1];

// ---- Durable treatments -------------------------------------------------------
// src/samples/treatments.json (committed) is the source of truth; a localStorage
// crash-pad survives mid-session reloads. Boot arbitrates the two (revision tag),
// merges into the compiled defaults, and restores general / pinned images /
// motion / last-viewed image. Every edit funnels through pushStore (debounced).
const VALID_IMAGE_KEYS: ReadonlySet<string> = new Set([...SAMPLES.map((s) => s.key), "field"]);
const bootTreatments = loadTreatments(snapshotParams(), VALID_IMAGE_KEYS);
general = bootTreatments.general;
Object.assign(imageParams, bootTreatments.images);
const imageNotes: Record<string, string> = bootTreatments.notes;
if (bootTreatments.motion) {
  const m = bootTreatments.motion;
  const ei = EASES.findIndex(([, e]) => e === m.ease);
  if (ei >= 0) motion.easeIdx = ei;
  if (Number.isFinite(m.dur)) motion.dur = Math.min(5, Math.max(0.05, m.dur));
  if ((FPS_MODES as readonly string[]).includes(m.fps)) motion.fps = m.fps as FpsMode;
}
if (bootTreatments.image) look.image = bootTreatments.image;
Object.assign(look, imageParams[look.image] ?? general);

const storeState = (): StoreState => ({
  image: look.image,
  motion: { ease: mEase(), dur: motion.dur, fps: motion.fps },
  general,
  images: imageParams,
  notes: imageNotes,
  sourceOf: (key) => (key === "field" ? undefined : sampleSrc(key)?.split("/").pop()),
});
let onStoreChanged: (() => void) | null = null; // dev-bar store-status refresh hook
function pushStore(): void {
  scheduleStore(storeState, bootTreatments.fileSavedAt);
  onStoreChanged?.();
}

// A small live ease preview: an inline SVG plotting the selected GSAP ease, with
// a playhead dot that runs the curve in real time (looping at the chosen
// duration) so you see the shape AND the timing of the motion.
function easeGraph(): { svg: SVGSVGElement; update: () => void } {
  const NS = "http://www.w3.org/2000/svg";
  const W = 120, H = 52, P = 6;
  const px = (p: number): number => P + p * (W - 2 * P);
  const py = (v: number): number => H - P - v * (H - 2 * P);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "art-ease");
  const curve = document.createElementNS(NS, "path");
  curve.setAttribute("class", "art-ease-curve");
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("r", "2.6");
  dot.setAttribute("class", "art-ease-dot");
  svg.append(curve, dot);
  const head = { p: 0 };
  let tween: gsap.core.Tween | null = null;
  const update = (): void => {
    const fn = gsap.parseEase(mEase());
    let d = "";
    const N = 32;
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      d += `${i === 0 ? "M" : "L"}${px(p).toFixed(1)} ${py(fn(p)).toFixed(1)} `;
    }
    curve.setAttribute("d", d.trim());
    const place = (): void => {
      dot.setAttribute("cx", px(head.p).toFixed(1));
      dot.setAttribute("cy", py(fn(head.p)).toFixed(1));
    };
    tween?.kill();
    head.p = 0;
    place();
    if (!reduced) {
      tween = gsap.to(head, { p: 1, duration: motion.dur, ease: "none", repeat: -1, repeatDelay: 0.3, onUpdate: place });
    }
  };
  return { svg, update };
}

const rev = { v: 0 };
const REVEAL_CELL_MULT = 32;
function effectiveCell(): number {
  return Math.round(look.cell * Math.pow(REVEAL_CELL_MULT, rev.v));
}
function pushReveal(): void {
  if (!scene) return;
  scene.setParam("uReveal", rev.v);
  scene.setParam("uCell", effectiveCell());
}
const revealBtns: HTMLButtonElement[] = [];
function syncRevealBtns(): void {
  for (const b of revealBtns) b.textContent = look.reveal ? "Dither" : "Reveal";
}
function toggleReveal(): void {
  look.reveal ^= 1;
  syncRevealBtns();
  gsap.killTweensOf(rev);
  if (reduced) {
    rev.v = look.reveal;
    pushReveal();
  } else {
    gsap.to(rev, { v: look.reveal, duration: motion.dur, ease: mEase(), onUpdate: pushReveal });
  }
}

function pushImageOn(): void {
  if (scene) scene.setParam("uImageOn", cur.uImageOn);
}

// Switch the dithered image (or the field). Image -> image is a true crossfade
// through the shader's second slot (uXfade), so it never dips through the
// procedural field — no bright flash between photos. Field <-> image still uses
// the uImageOn crossfade (the field is not a photo).
function goImage(key: string): void {
  look.image = key;
  applyImageParams(key); // load this image's pinned override, else the default + refresh dev bar
  if (scene) pushTreatment(); // apply the loaded treatment to the shader
  if (!scene) return;
  const targetSrc = key === "field" ? null : sampleSrc(key);
  const tok = ++txToken;
  gsap.killTweensOf(cur);
  gsap.killTweensOf(xf);

  if (reduced) {
    if (targetSrc) {
      loadImg(targetSrc).then((im) => {
        if (tok !== txToken) return;
        if (im && scene) {
          scene.setImage(im);
          scene.setImage2(null);
          curImageSrc = targetSrc;
          fitCanvas(im);
        }
        cur.uImageOn = 1;
        xf.v = 0;
        pushImageOn();
        pushXfade();
        pushAutoInvert();
      });
    } else {
      cur.uImageOn = 0;
      pushImageOn();
      pushAutoInvert();
      fitCanvas(null);
    }
    return;
  }

  // To the field: fade the image out and leave the procedural field.
  if (!targetSrc) {
    pushAutoInvert();
    fitCanvas(null);
    gsap.to(cur, { uImageOn: 0, duration: motion.dur, ease: mEase(), onUpdate: pushImageOn });
    return;
  }
  // Same image: just make sure it is fully on.
  if (targetSrc === curImageSrc) {
    gsap.to(cur, { uImageOn: 1, duration: motion.dur, ease: mEase(), onUpdate: pushImageOn });
    return;
  }
  // From the field (or first load): fade the new image in over the field.
  if (!curImageSrc || cur.uImageOn < 0.02) {
    void (async () => {
      const im = await loadImg(targetSrc);
      if (tok !== txToken) return;
      if (im && scene) {
        scene.setImage(im);
        curImageSrc = targetSrc;
        fitCanvas(im);
      }
      xf.v = 0;
      pushXfade();
      pushAutoInvert();
      gsap.to(cur, { uImageOn: 1, duration: motion.dur, ease: mEase(), onUpdate: pushImageOn });
    })();
    return;
  }
  // Image -> image: load into the second slot and crossfade directly, then
  // promote it to the primary slot (same pixels, so the handoff is seamless).
  void (async () => {
    const im = await loadImg(targetSrc);
    if (tok !== txToken || !im || !scene) return;
    scene.setImage2(im);
    xf.v = 0;
    pushXfade();
    pushAutoInvert(); // decide polarity for the incoming image as the crossfade begins
    gsap.to(xf, {
      v: 1,
      duration: motion.dur,
      ease: mEase(),
      onUpdate: pushXfade,
      onComplete: () => {
        if (tok !== txToken || !scene) return;
        scene.setImage(im);
        scene.setImage2(null);
        curImageSrc = targetSrc;
        fitCanvas(im);
        xf.v = 0;
        pushXfade();
      },
    });
  })();
}

try {
  if (canvas && !params.has("nogl")) {
    scene = initScene(canvas, reduced, pressFrag);
    scene.setEnergy(0.9);
    scene.setParam("uToneBase", 0.46);
    scene.setParam("uToneContrast", 0.3);
    scene.setParam("uToneScale", 1.6);
    scene.setParam("uDrift", 0.03);
    scene.setParam("uCrossOn", 0);
    pushTreatment();
    applyFps(motion.fps, reduced); // apply the default frame cadence (motion.fps) on load, not just on dev-bar change
    pushImageOn(); // field until the first image loads
    goImage(look.image); // form the portrait
    markStoreClean(storeState()); // boot state == the checkpoint; only real edits read as unsaved
  } else {
    throw new Error("nogl");
  }
} catch {
  document.body.classList.add("no-gl");
  canvas?.remove();
}

// ---- Contact sheet (?sheet) ---------------------------------------------------
// Renders every sample through the live scene with its treatment (pinned ??
// general) into a tile-grid overlay. Persistence is guarded for the whole run.
if (params.has("sheet") && scene && canvas) {
  const sheetScene = scene;
  const sheetCanvas = canvas;
  const before = { ...snapshotParams() };
  const beforeImage = look.image;
  void (async () => {
    await sheetScene.ready;
    persistGuard = true;
    const { runSheet } = await import("./artefact-sheet");
    await runSheet({
      samples: SAMPLES,
      isPinned,
      applyFor: (key, im) => {
        Object.assign(look, imageParams[key] ?? general);
        sheetScene.setImage(im);
        sheetScene.setParam("uImageOn", 1);
        sheetScene.setParam("uXfade", 0);
        pushTreatment();
      },
      restore: () => {
        Object.assign(look, before);
        persistGuard = false;
        goImage(beforeImage); // back through the normal path (also re-pushes)
      },
      capture: () => {
        sheetScene.renderOnce();
        return sheetCanvas.toDataURL("image/jpeg", 0.85); // same task as the draw
      },
      onPick: (key) => {
        look.image = key;
        pushStore(); // store's last-viewed image -> ?dev boots on the pick
        setTimeout(() => { location.search = "?dev"; }, 550); // past the debounce
      },
    });
  })();
}

/* ---- Menu: one item per sample image + Field ---- */
const menu = document.querySelector<HTMLElement>(".art-menu");
const MENU_ITEMS = [...SAMPLES.map((s) => ({ key: s.key, label: s.label })), { key: "field", label: "Field" }];
let hoverMode = false; // when on, hovering a menu item changes the image (no click needed)
if (menu) {
  const setActive = (b: HTMLElement, key: string): void => {
    for (const x of menu.querySelectorAll(".art-link")) x.classList.toggle("is-active", x === b);
    goImage(key);
  };
  MENU_ITEMS.forEach((item, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "art-link menu-link"
      + (layout === "ladder" ? " menu-link--caption" : "") // ladder = filled-mono caption treatment
      + (item.key === look.image ? " is-active" : "");
    b.textContent = item.label;
    b.dataset.key = item.key;
    b.style.setProperty("--i", String(i)); // ladder layout staggers each item by index
    b.addEventListener("click", () => setActive(b, item.key));
    b.addEventListener("pointerenter", () => { if (hoverMode) setActive(b, item.key); });
    menu.appendChild(b);
  });
}

/* ---- Reveal + Hover buttons (bottom-right, beside the menu) ---- */
if (scene) {
  const host = document.querySelector(".art-frame") ?? document.body;
  // Hover: toggle hover-to-change for the menu items.
  const hb = document.createElement("button");
  hb.type = "button";
  hb.className = "art-hover btn-reveal";
  hb.textContent = "Hover";
  hb.setAttribute("aria-pressed", "false");
  hb.addEventListener("click", () => {
    hoverMode = !hoverMode;
    hb.classList.toggle("is-on", hoverMode);
    hb.setAttribute("aria-pressed", String(hoverMode));
  });
  host.appendChild(hb);

  const rb = document.createElement("button");
  rb.type = "button";
  rb.className = "art-reveal btn-reveal";
  rb.textContent = "Reveal";
  rb.addEventListener("click", toggleReveal);
  revealBtns.push(rb);
  host.appendChild(rb);
}

/* ---- PULSE cursor — 10×10 inverting block, PULSE click animation ---- */
/* Fine-pointer + motion only. Click: 1.8× recoil + 3 concentric stamps
   staggered every f2 (83ms), all cut simultaneously at f12 (500ms). */
if (!reduced && window.matchMedia("(pointer: fine)").matches) {
  const FPS24 = 1000 / 24;
  const f = (n: number) => Math.round(n * FPS24);

  const cur = document.createElement("div");
  cur.className = "art-cursor";
  cur.setAttribute("aria-hidden", "true");
  document.body.appendChild(cur);
  document.body.classList.add("art-has-cursor");

  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");
  setX(window.innerWidth / 2);
  setY(window.innerHeight / 2);

  // Solid accent everywhere — no inversion.
  window.addEventListener("pointermove", (e) => { setX(e.clientX); setY(e.clientY); });
  document.addEventListener("pointerleave", () => { cur.style.opacity = "0"; });
  document.addEventListener("pointerenter", () => { cur.style.opacity = ""; });

  window.addEventListener("pointerdown", (e) => {
    // Block recoil on every click.
    gsap.killTweensOf(cur, "scale");
    gsap.fromTo(cur, { scale: 1.8 }, { scale: 1, duration: f(2) / 1000, ease: "power2.out" });

    // Stamps fire over the plate and the menu, but not the dev bar (so its
    // steppers/drags don't burst).
    const t = e.target as HTMLElement | null;
    if (t && t.closest(".art-dev")) return;

    const SIZES = [26, 42, 60];
    const stamps: HTMLDivElement[] = [];
    SIZES.forEach((size, i) => {
      window.setTimeout(() => {
        const s = document.createElement("div");
        s.className = "art-stamp";
        s.style.left = `${e.clientX - size / 2}px`;
        s.style.top = `${e.clientY - size / 2}px`;
        s.style.width = `${size}px`;
        s.style.height = `${size}px`;
        document.body.appendChild(s);
        stamps.push(s);
      }, f(i * 2));
    });
    window.setTimeout(() => { stamps.forEach((s) => s.remove()); }, f(12));
  });

  // Easter egg: a triple-click blooms the cursor effect to full and holds it for
  // a brief moment (defeating the usual movement-strength fade), then it eases
  // back down. Ignored over the dev bar so triple-tapping a control is safe.
  window.addEventListener("click", (e) => {
    if (e.detail < 3) return; // the 3rd click of a triple (and beyond) only
    const t = e.target as HTMLElement | null;
    if (t && t.closest(".art-dev")) return;
    scene?.cursorBurst(1.0, 300, 0.8); // full strength, 300ms hold, radius 0.8 (big disc)
  });
}

/* ---- Dev bar (?dev): treatment toggles + live readout + copy values ---- */
function flash(btn: HTMLElement, msg: string): void {
  const prev = btn.textContent;
  btn.textContent = msg;
  window.setTimeout(() => {
    btn.textContent = prev;
  }, 1100);
}

/* ---- JS port of the shader's fade-mask noise, for the dev-bar noise thumbnail.
   Mirrors `fadeNoise`/fbm/ridged/voronoi/turbulence/worleyEdge in art.ts so the
   preview matches the plate. Evaluated on a tiny grid, on change (never per-frame). */
const nfr = (v: number): number => v - Math.floor(v);
function nhash(x: number, y: number): number {
  let px = nfr(x * 123.34), py = nfr(y * 456.21);
  const dt = px * (px + 45.32) + py * (py + 45.32);
  px += dt; py += dt;
  return nfr(px * py);
}
function nvnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = nhash(ix, iy), b = nhash(ix + 1, iy), c = nhash(ix, iy + 1), d = nhash(ix + 1, iy + 1);
  const m0 = a + (b - a) * ux, m1 = c + (d - c) * ux;
  return m0 + (m1 - m0) * uy;
}
function noct(x: number, y: number, mode: number): number {
  // mode: 0 fbm, 1 ridged, 2 turbulence
  let v = 0, amp = mode === 1 ? 0.5 : 0.55;
  for (let i = 0; i < 4; i++) {
    const s = nvnoise(x, y);
    if (mode === 1) { const n = 1 - Math.abs(s * 2 - 1); v += amp * n * n; }
    else if (mode === 2) { v += amp * Math.abs(s * 2 - 1); }
    else { v += amp * s; }
    x *= 2.02; y *= 2.02; amp *= 0.5;
  }
  return v;
}
function ncell(x: number, y: number, edge: boolean): number {
  const gx = Math.floor(x), gy = Math.floor(y), fx = x - gx, fy = y - gy;
  let f1 = 1.5, f2 = 1.5;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const hx = nhash(gx + i, gy + j), hy = nhash(gx + i + 31.7, gy + j + 31.7);
    const d = Math.hypot(i + hx - fx, j + hy - fy);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return edge ? Math.min(Math.max((f2 - f1) * 1.4, 0), 1) : Math.min(Math.max(f1, 0), 1);
}
function nfadeNoise(x: number, y: number, type: number, warp: number): number {
  if (warp > 0.001) {
    const wx = noct(x + 1.7, y + 9.2, 0), wy = noct(x + 8.3, y + 2.8, 0);
    x += (wx - 0.5) * warp * 2; y += (wy - 0.5) * warp * 2;
  }
  if (type > 3.5) return ncell(x, y, true);   // cracks (Worley F2-F1)
  if (type > 2.5) return noct(x, y, 2);        // turbulence
  if (type > 1.5) return ncell(x, y, false);   // voronoi
  if (type > 0.5) return noct(x, y, 1);        // ridged
  return noct(x, y, 0);                         // fbm
}
function renderNoiseThumb(c: HTMLCanvasElement): void {
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const W = c.width, H = c.height;
  const sx = look.cloudSize, sy = look.cloudSizeY, type = look.noiseType, warp = look.fadeWarp;
  const cw = Math.max(look.cloudW, 0.05); // cloud-width scale on x (mirrors the shader)
  // First pass: sample; second pass: normalise to the full range so faint noise
  // types (fbm/ridged top out ~0.5) still read clearly in the thumbnail.
  const vals = new Float32Array(W * H);
  let mn = Infinity, mx = -Infinity;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const cx = (px / W - 0.5) / cw + 0.5;
      const v = nfadeNoise(cx * sx, (1 - py / H) * sy, type, warp);
      vals[py * W + px] = v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  const span = Math.max(mx - mn, 1e-4);
  const out = ctx.createImageData(W, H);
  for (let i = 0; i < vals.length; i++) {
    const g = Math.round(Math.min(Math.max((vals[i] - mn) / span, 0), 1) * 255);
    out.data[i * 4] = g; out.data[i * 4 + 1] = g; out.data[i * 4 + 2] = g; out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// Concise helper text per control label — shown in the hover info-circles (and
// the same copy documents each setting). Keyed by the control's label.
const HELP: Record<string, string> = {
  Motif: "Mark shape: solid, disc (round halftone dot), X, plus, or dash.",
  Cells: "Dither cell count = density. Lower = bigger dots, higher = finer grain. (Develop's Cells = the resolve sub-grid; same unit.)",
  Width: "Plate box width as a % of the viewport (full height). The photo fits into this box via Image > Fit / Pos.",
  Type: "The mask: Off (no dissolve / full-bleed), Simple (radial gradient), or the animated Cloud.",
  Margin: "Colour of the frame margin around the plate: the body ink, or the colorway's own accent.",
  "Billow X": "Cloud billow size across — lower = bigger, softer billows.",
  "Billow Y": "Cloud billow size vertically (independent stretch).",
  Noise: "Mask noise: FBM (billowy), Ridged (Musgrave creases), Voronoi (cells), Turbulence (smoky), Cracks (Worley veins).",
  Warp: "Domain-warp the noise — swirls the mask into more organic, turbulent shapes (works on any Noise type).",
  "Cloud width": "Horizontal extent of the cloud layer, independent of the image width — stretch the dissolve + texture wider/narrower than the photo.",
  "Cloud anim": "Scroll the cloud sideways, or hold it static.",
  "Cloud speed": "How fast the cloud drifts when animated.",
  "Fade X": "Move the dissolve's anchor left/right (0 = left edge).",
  "Fade Y": "Move the dissolve's anchor down/up (0 = bottom edge).",
  Reach: "Dissolve REACH (size) — how far the fade extends from the anchor before it's fully gone. Bigger = more of the plate stays solid; smaller = dissolves closer in.",
  Softness: "Dissolve SOFTNESS — width of the fade's gradient band. Bigger = a softer, more gradual edge; smaller = a sharper cut.",
  Palette: "Paper + ink colourway (54 presets).",
  "Full colour": "Dither the photo's real RGB instead of duotone paper/ink.",
  Levels: "Posterise steps per colour channel — lower = chunkier colour.",
  "Mark bright": "Brighten/darken the mark colour itself, vs the palette ink.",
  Fit: "How the photo fills the plate: Cover (fill + crop) or Contain (fit whole image, letterbox to ground).",
  "Pos X": "Image anchor across: 0 left · 0.5 centre · 1 right. Goes negative / past 1 to bleed the photo off the edge (revealed area = ground).",
  "Pos Y": "Image anchor vertical: 0 bottom · 0.5 centre · 1 top. Negative / >1 pushes it off the edge.",
  Zoom: "Scale the photo in/out within the plate, on top of Fit. >1 crops in tighter, <1 shrinks it (surrounded by ground).",
  Feather: "Right-edge falloff WIDTH — taper the plate's right edge into the ground over the last N of the plate width (a clean vertical fade on top of the cloud dissolve). 0 = hard edge.",
  Curve: "Right-edge falloff SHAPE — lower = harder/sharper shoulder, higher = a more gradual ramp. 1 = plain S-curve.",
  Depth: "Right-edge falloff DEPTH — how far it dissolves: 1 = all the way to ground, lower = a partial dot veil.",
  Brightness: "Source-image luminance, applied before dithering.",
  Contrast: "Source-image contrast, applied before dithering.",
  Invert: "Tone polarity. Auto flips it on dark-paper stocks. Duotone only.",
  Auto: "Whether Auto inverted, and why (the palette's stock).",
  Mode: "What the pointer does: clear, ink, bias, negative, or develop.",
  Strength: "Cursor effect intensity.",
  Falloff: "Cursor disc falloff rate — LOWER = bigger / softer disc, higher = tighter.",
  Hold: "Static floor so the effect persists when the pointer stops.",
  Hardness: "Negative cursor mode: hardness of the polarity-flip edge.",
  Stage: "Where the finer develop dither ramps in during a press.",
  Resolve: "How fully a full press replaces base marks with fine dither.",
  Colorize: "Develop in mono (0) up to the photo's true colour (1).",
  Saturation: "Vibrance of the developed colour.",
  Pop: "Local-contrast / unsharp boost in the develop region.",
  "Dev bright": "Brightness of the develop region (on top of the image grade).",
  "Dev contrast": "Contrast of the develop region (on top of the image grade).",
  Ease: "Easing curve for every transition.",
  Duration: "Transition length, in seconds.",
  FPS: "Frame cap: Fluid (uncapped), Cine 24, Commo 17.",
  Reveal: "Crossfade the whole plate to the true natural-light photo.",
  "Image state": "Peek the undithered, brightness/contrast-adjusted source.",
  "Fade mask": "Show the fade mask itself — white = marks, black = ground.",
  "Cursor field": "Show the raw cursor influence as grayscale — white = full influence, black = none.",
  "Canvas edge": "Dev overlay: a fluo GREEN border on the canvas/plate edge.",
  "Image edge": "Dev overlay: a fluo MAGENTA border on the fitted image's edge (sits off-plate when cover-cropped).",
  "Mask edge": "Dev overlay: a fluo YELLOW line on the mask contour — where the dissolve is half-covered.",
  Stored: "Whether this image has its own written config (custom) or follows the general dev-menu settings.",
  "Save to image": "Give this image its own config (a copy of the current settings). Until then it follows the general menu settings, which apply to every image without its own config.",
  "Reset image": "Drop this image's config — back to the general menu settings.",
  "Copy JSON": "Copy every setting as JSON to the clipboard.",
  "Copy look": "Stash this image's full treatment on an in-session clipboard.",
  Note: "Free-text note for this image \u2014 why it's tuned this way. Saved in the treatments store and the downloaded checkpoint.",
  "Suggest B/C": "Auto-levels suggestion: measures the photo's 2nd/98th luma percentiles and sets Brightness/Contrast so they land at 0.08/0.92. A starting point \u2014 tweak after. Never touches Invert.",
  "Paste look": "Apply the stashed treatment here \u2014 writes to this image's config if pinned, else to the general settings.",
  Store: "Treatments store state: file \u00b7 synced (committed treatments.json is current) or local \u00b7 unsaved (edits not yet downloaded + committed).",
  "Download treatments": "Download treatments.json \u2014 drop it into src/samples/ and commit. The committed file is the durable source of truth (and the future CMS seed).",
};

function buildDevBar(): void {
  if (!scene) return;
  const bar = document.createElement("div");
  bar.className = "art-dev";

  // Slim grip across the top: click (or backtick) collapses the controls down
  // to just this handle, so the plate can be read unobstructed. State persists.
  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "art-dev-grip";
  grip.setAttribute("aria-label", "Toggle dev controls");
  bar.appendChild(grip);

  // Clip wrapper carries the collapse; the row inside keeps its padding/flow.
  const clip = document.createElement("div");
  clip.className = "art-dev-clip";
  const row = document.createElement("div");
  row.className = "art-dev-row";
  clip.appendChild(row);
  bar.appendChild(clip);

  // The floating Reveal button duplicates View > Photo, so hide it while the
  // bar is open (avoids the bottom-right collision); it returns on collapse.
  const floatingReveal = document.querySelector<HTMLElement>(".art-reveal");
  let collapsed = false;
  const STORE = "artefact:devbar-collapsed";
  // Accordion: animate the clip to the row's exact height (no dead-time, no
  // clipping at any viewport), then release to auto when fully open.
  const setCollapsed = (next: boolean, persist = true): void => {
    collapsed = next;
    bar.classList.toggle("is-collapsed", collapsed);
    grip.textContent = collapsed ? "▴ Dev" : "Dev ▾";
    grip.setAttribute("aria-expanded", String(!collapsed));
    if (floatingReveal) floatingReveal.style.display = collapsed ? "" : "none";
    if (bar.classList.contains("no-anim")) {
      clip.style.maxHeight = collapsed ? "0px" : "";
    } else if (collapsed) {
      clip.style.maxHeight = `${row.offsetHeight}px`;
      void clip.offsetHeight; // reflow so the next set animates
      clip.style.maxHeight = "0px";
    } else {
      clip.style.maxHeight = `${row.offsetHeight}px`;
      const done = (e: TransitionEvent): void => {
        if (e.target === clip && !collapsed) clip.style.maxHeight = "";
        clip.removeEventListener("transitionend", done);
      };
      clip.addEventListener("transitionend", done);
    }
    if (persist) {
      try { localStorage.setItem(STORE, collapsed ? "1" : "0"); } catch { /* ignore */ }
    }
  };
  // Free-drag: the grip doubles as the panel's header + drag handle. Press and
  // move to reposition the whole panel anywhere on screen; a press that doesn't
  // move is a collapse toggle. Position persists as {x,y} (top-left), re-clamped
  // into the viewport on restore so it can never strand off-screen.
  const POS_STORE = "artefact:devbar-pos";
  const applyPos = (x: number, y: number): void => {
    const w = bar.offsetWidth || 264;
    const cx = Math.max(6, Math.min(x, window.innerWidth - w - 6));
    const cy = Math.max(6, Math.min(y, window.innerHeight - 44));
    bar.style.left = `${cx}px`;
    bar.style.top = `${cy}px`;
    bar.style.right = "auto";
  };
  let savedPos: { x: number; y: number } | null = null;
  try {
    const s = localStorage.getItem(POS_STORE);
    if (s) { const p = JSON.parse(s) as { x?: number; y?: number }; if (typeof p?.x === "number" && typeof p?.y === "number") savedPos = { x: p.x, y: p.y }; }
  } catch { /* ignore */ }

  let dragging = false, dragMoved = false, sx = 0, sy = 0, ox = 0, oy = 0;
  grip.addEventListener("pointerdown", (e) => {
    dragging = true; dragMoved = false;
    sx = e.clientX; sy = e.clientY;
    const r = bar.getBoundingClientRect();
    ox = r.left; oy = r.top;
    bar.classList.add("is-dragging");
    try { grip.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  grip.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
    if (dragMoved) applyPos(ox + dx, oy + dy);
  });
  const endDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    bar.classList.remove("is-dragging");
    if (dragMoved) {
      const r = bar.getBoundingClientRect();
      try { localStorage.setItem(POS_STORE, JSON.stringify({ x: r.left, y: r.top })); } catch { /* ignore */ }
    }
  };
  grip.addEventListener("pointerup", endDrag);
  grip.addEventListener("pointercancel", endDrag);
  grip.addEventListener("click", () => {
    if (dragMoved) { dragMoved = false; return; } // it was a drag, not a click
    setCollapsed(!collapsed);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "`" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setCollapsed(!collapsed);
    }
  });

  // A labeled column. Controls stack vertically inside it as [label · widget].
  // Foldable groups: click a group header to collapse its controls. The folded
  // set persists across reloads.
  const FOLD_STORE = "artefact:devbar-folds";
  let folded: Set<string>;
  try { folded = new Set(JSON.parse(localStorage.getItem(FOLD_STORE) || "[]") as string[]); }
  catch { folded = new Set(); }
  const group = (label: string): HTMLElement => {
    const g = document.createElement("div");
    g.className = "art-group";
    const l = document.createElement("button");
    l.type = "button";
    l.className = "art-group-l";
    l.textContent = label;
    const ctls = document.createElement("div");
    ctls.className = "art-group-ctls";
    g.classList.toggle("is-folded", folded.has(label));
    l.setAttribute("aria-expanded", String(!folded.has(label)));
    l.addEventListener("click", () => {
      if (folded.has(label)) folded.delete(label); else folded.add(label);
      const isFolded = folded.has(label);
      g.classList.toggle("is-folded", isFolded);
      l.setAttribute("aria-expanded", String(!isFolded));
      try { localStorage.setItem(FOLD_STORE, JSON.stringify([...folded])); } catch { /* ignore */ }
    });
    g.append(l, ctls);
    row.appendChild(g);
    return ctls;
  };

  // Shared hover tooltip for the info-circles. Fixed-position so it escapes the
  // panel's scroll clip; built once and re-positioned beside the hovered circle.
  const tipEl = document.createElement("div");
  tipEl.className = "art-tip";
  tipEl.setAttribute("role", "tooltip");
  document.body.appendChild(tipEl);
  const showTip = (anchor: HTMLElement, text: string): void => {
    tipEl.textContent = text;
    tipEl.style.display = "block";
    const a = anchor.getBoundingClientRect();
    const t = tipEl.getBoundingClientRect();
    let left = a.left - t.width - 10;
    if (left < 8) left = a.right + 10; // flip right if there's no room to the left
    const top = Math.max(8, Math.min(a.top + a.height / 2 - t.height / 2, window.innerHeight - t.height - 8));
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  };
  const hideTip = (): void => { tipEl.style.display = "none"; };
  // A hover info-circle carrying HELP[label]; attached to a label / button.
  const addInfo = (host: HTMLElement, label: string): HTMLElement | null => {
    const tip = HELP[label];
    if (!tip) return null;
    const info = document.createElement("span");
    info.className = "art-info";
    info.textContent = "i";
    info.setAttribute("aria-label", `${label}: ${tip}`);
    info.addEventListener("pointerenter", () => showTip(info, tip));
    info.addEventListener("pointerleave", hideTip);
    host.appendChild(info);
    return info;
  };

  // One control row: label on the left, widget on the right. Returns the row so
  // callers can mark it contextually N/A (dimmed + disabled).
  const ctl = (into: HTMLElement, label: string, widget: HTMLElement): HTMLElement => {
    const w = document.createElement("div");
    w.className = "art-ctl";
    const l = document.createElement("span");
    l.className = "art-ctl-l";
    l.textContent = label;
    addInfo(l, label);
    w.append(l, widget);
    into.appendChild(w);
    return w;
  };

  // A dropdown for multi-option params (motif, colorway, fade).
  // Controls register a "refresh display from look" closure so a programmatic
  // look change (e.g. switching to an image with its own params) re-syncs the UI.
  const syncers: Array<() => void> = [];
  const select = (
    into: HTMLElement,
    label: string,
    options: readonly string[],
    get: () => number,
    set: (i: number) => void,
    after?: () => void,
  ): HTMLElement => {
    const sel = document.createElement("select");
    sel.className = "art-sel";
    options.forEach((opt, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = opt;
      sel.appendChild(o);
    });
    sel.value = String(get());
    syncers.push(() => { sel.value = String(get()); });
    sel.addEventListener("change", () => {
      set(parseInt(sel.value, 10));
      pushTreatment();
      after?.();
    });
    return ctl(into, label, sel);
  };

  // A [−] value [+] stepper for numerics.
  const stepper = (
    into: HTMLElement,
    label: string,
    get: () => string,
    dec: () => void,
    inc: () => void,
    after?: () => void,
  ): HTMLElement => {
    const grp = document.createElement("div");
    grp.className = "art-step";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "art-step-b";
    minus.textContent = "−";
    const val = document.createElement("span");
    val.className = "art-ctl-v";
    val.textContent = get();
    syncers.push(() => { val.textContent = get(); });
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "art-step-b";
    plus.textContent = "+";
    minus.addEventListener("click", () => { dec(); pushTreatment(); val.textContent = get(); after?.(); });
    plus.addEventListener("click", () => { inc(); pushTreatment(); val.textContent = get(); after?.(); });
    // Drag-to-scrub: press the value and drag left/right to step it (≈6px/step),
    // reusing the same clamped dec/inc so bounds + push stay identical.
    val.classList.add("art-ctl-v-drag");
    let scrubbing = false, x0 = 0, applied = 0;
    val.addEventListener("pointerdown", (e) => {
      scrubbing = true; x0 = e.clientX; applied = 0;
      try { val.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });
    val.addEventListener("pointermove", (e) => {
      if (!scrubbing) return;
      const want = Math.round((e.clientX - x0) / 6);
      let d = want - applied;
      if (d === 0) return;
      while (d > 0) { inc(); d--; }
      while (d < 0) { dec(); d++; }
      applied = want;
      pushTreatment(); val.textContent = get(); after?.();
    });
    const stopScrub = (): void => { scrubbing = false; };
    val.addEventListener("pointerup", stopScrub);
    val.addEventListener("pointercancel", stopScrub);
    grp.append(minus, val, plus);
    return ctl(into, label, grp);
  };

  // A two-state toggle button (On is filled to read as "active").
  const toggle = (
    into: HTMLElement,
    label: string,
    on: () => boolean,
    flip: () => void,
    after?: () => void,
  ): HTMLElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "art-toggle";
    const sync = (): void => {
      btn.textContent = on() ? "On" : "Off";
      btn.classList.toggle("is-on", on());
    };
    sync();
    syncers.push(sync);
    btn.addEventListener("click", () => { flip(); pushTreatment(); sync(); after?.(); });
    return ctl(into, label, btn);
  };

  // A 3-state cycle button (e.g. Off / On / Auto). Lit only for the explicit "On" (index 1).
  const cycle3 = (
    into: HTMLElement,
    label: string,
    states: readonly string[],
    get: () => number,
    set: (i: number) => void,
  ): HTMLElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "art-toggle";
    const sync = (): void => {
      btn.textContent = states[get()];
      btn.classList.toggle("is-on", get() === 1);
    };
    sync();
    syncers.push(sync);
    btn.addEventListener("click", () => { set((get() + 1) % states.length); pushTreatment(); sync(); });
    return ctl(into, label, btn);
  };

  // A full-width action button (the Output column).
  const action = (into: HTMLElement, btn: HTMLButtonElement): void => {
    const w = document.createElement("div");
    w.className = "art-ctl art-ctl-act";
    btn.classList.add("art-act");
    const tip = HELP[btn.textContent ?? ""]; // captured at build (flash() text is transient)
    if (tip) {
      btn.addEventListener("pointerenter", () => showTip(btn, tip));
      btn.addEventListener("pointerleave", hideTip);
    }
    w.appendChild(btn);
    into.appendChild(w);
  };

  // Hide + disable a control that does not apply to the current mode.
  const setNA = (el: HTMLElement, na: boolean): void => {
    el.classList.toggle("is-na", na);
    el.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select").forEach(
      (c) => { c.disabled = na; },
    );
  };

  // Motif (mark shape) is surfaced in Screen always, and contextually in Colour
  // (full-colour) and Cursor (Develop) so it's at hand in those modes; every copy
  // drives look.motif and the set stays in sync.
  const motifSels: HTMLSelectElement[] = [];
  const syncMotif = (): void => { for (const s of motifSels) s.value = String(look.motif); };
  const addMotif = (into: HTMLElement): HTMLElement => {
    const row = select(into, "Motif", MOTIFS, () => look.motif, (i) => { look.motif = i; }, () => syncMotif());
    const s = row.querySelector("select");
    if (s) motifSels.push(s);
    return row;
  };

  // SCREEN — just the dither marks: motif, density (Cell), plate width, margin colour.
  const screen = group("Screen");
  addMotif(screen);
  stepper(screen, "Cells", () => String(look.cell),
    () => { look.cell = Math.max(16, look.cell - 12); },
    () => { look.cell = Math.min(600, look.cell + 12); });
  // Plate width: the plate box as a fraction of the viewport width (full height).
  // The photo fits into this box via Image > Fit / Pos. Re-sizes #gl (not a uniform).
  stepper(screen, "Width", () => `${Math.round(look.plateWidth * 100)}%`,
    () => { look.plateWidth = Math.max(0.2, +(look.plateWidth - 0.05).toFixed(2)); },
    () => { look.plateWidth = Math.min(1, +(look.plateWidth + 0.05).toFixed(2)); },
    () => fitCanvas(curImageEl));
  // Frame margin colour: the body (ink) or the colorway's own accent.
  select(screen, "Margin", ["Body", "Accent"], () => look.marginAccent, (i) => { look.marginAccent = i; });

  // FADE — everything about how the plate dissolves into the ground: mode (master
  // switch), the dissolve shape (anchor / reach / softness), the right-edge taper,
  // and (Cloud mode only) the cloud texture. Mode always shows; the rest gates off it.
  const fade = group("Fade");
  // Mode: Off (full-bleed), Simple (radial gradient), or the animated Cloud.
  select(fade, "Type", ["Off", "Simple", "Cloud"], () => look.fadeMode, (i) => { look.fadeMode = i; }, () => refreshNA());
  // Dissolve shape — position (anchor), size (Reach), Softness. Any fade mode.
  const fadeXCtl = stepper(fade, "Fade X", () => look.fadePosX.toFixed(2),
    () => { look.fadePosX = Math.max(-1, +(look.fadePosX - 0.05).toFixed(2)); },
    () => { look.fadePosX = Math.min(2, +(look.fadePosX + 0.05).toFixed(2)); });
  const fadeYCtl = stepper(fade, "Fade Y", () => look.fadePosY.toFixed(2),
    () => { look.fadePosY = Math.max(-1, +(look.fadePosY - 0.05).toFixed(2)); },
    () => { look.fadePosY = Math.min(2, +(look.fadePosY + 0.05).toFixed(2)); });
  const fadeReachCtl = stepper(fade, "Reach", () => look.fadeReach.toFixed(2),
    () => { look.fadeReach = Math.max(0.1, +(look.fadeReach - 0.05).toFixed(2)); },
    () => { look.fadeReach = Math.min(8, +(look.fadeReach + 0.05).toFixed(2)); });
  const fadeSoftCtl = stepper(fade, "Softness", () => look.fadeSoft.toFixed(2),
    () => { look.fadeSoft = Math.max(0.05, +(look.fadeSoft - 0.05).toFixed(2)); },
    () => { look.fadeSoft = Math.min(6, +(look.fadeSoft + 0.05).toFixed(2)); });
  // Right-edge taper (part of the mask — shows when Fade ≠ Off): Feather (width) ·
  // Curve (ramp shape) · Depth (dissolve amount).
  const featherCtl = stepper(fade, "Feather", () => look.edgeFade.toFixed(2),
    () => { look.edgeFade = Math.max(0, +(look.edgeFade - 0.02).toFixed(2)); },
    () => { look.edgeFade = Math.min(1, +(look.edgeFade + 0.02).toFixed(2)); });
  const curveCtl = stepper(fade, "Curve", () => look.edgeCurve.toFixed(2),
    () => { look.edgeCurve = Math.max(0.1, +(look.edgeCurve - 0.1).toFixed(2)); },
    () => { look.edgeCurve = Math.min(10, +(look.edgeCurve + 0.1).toFixed(2)); });
  const depthCtl = stepper(fade, "Depth", () => look.edgeDepth.toFixed(2),
    () => { look.edgeDepth = Math.max(0, +(look.edgeDepth - 0.1).toFixed(2)); },
    () => { look.edgeDepth = Math.min(1, +(look.edgeDepth + 0.1).toFixed(2)); });
  // Cloud texture (Cloud mode only): a live noise preview + its shape controls.
  const noiseThumb = document.createElement("canvas");
  noiseThumb.className = "art-thumb";
  noiseThumb.width = 200;
  noiseThumb.height = 64;
  fade.appendChild(noiseThumb);
  const drawNoise = (): void => renderNoiseThumb(noiseThumb);
  drawNoise();
  const cloudCtl = stepper(fade, "Billow X", () => look.cloudSize.toFixed(1),
    () => { look.cloudSize = Math.max(0.5, +(look.cloudSize - 0.5).toFixed(1)); },
    () => { look.cloudSize = Math.min(20, +(look.cloudSize + 0.5).toFixed(1)); }, drawNoise);
  const cloudYCtl = stepper(fade, "Billow Y", () => look.cloudSizeY.toFixed(1),
    () => { look.cloudSizeY = Math.max(0.5, +(look.cloudSizeY - 0.5).toFixed(1)); },
    () => { look.cloudSizeY = Math.min(20, +(look.cloudSizeY + 0.5).toFixed(1)); }, drawNoise);
  const noiseCtl = select(fade, "Noise", ["FBM", "Ridged", "Voronoi", "Turbulence", "Cracks"], () => look.noiseType, (i) => { look.noiseType = i; }, drawNoise);
  const warpCtl = stepper(fade, "Warp", () => look.fadeWarp.toFixed(2),
    () => { look.fadeWarp = Math.max(0, +(look.fadeWarp - 0.1).toFixed(2)); },
    () => { look.fadeWarp = Math.min(3, +(look.fadeWarp + 0.1).toFixed(2)); }, drawNoise);
  const cloudWCtl = stepper(fade, "Cloud width", () => `${look.cloudW.toFixed(2)}×`,
    () => { look.cloudW = Math.max(0.2, +(look.cloudW - 0.1).toFixed(2)); },
    () => { look.cloudW = Math.min(5, +(look.cloudW + 0.1).toFixed(2)); }, drawNoise);
  const cloudAnimCtl = toggle(fade, "Cloud anim", () => !!look.cloudAnim, () => { look.cloudAnim ^= 1; });
  const cloudSpeedCtl = stepper(fade, "Cloud speed", () => look.cloudSpeed.toFixed(2),
    () => { look.cloudSpeed = Math.max(0, +(look.cloudSpeed - 0.02).toFixed(2)); },
    () => { look.cloudSpeed = Math.min(2, +(look.cloudSpeed + 0.02).toFixed(2)); });

  // COLOUR — palette + full-colour mode (Levels only applies in full colour).
  const colour = group("Colour");
  // Palette readout: three swatches (paper / ink / accent) of the CURRENT colorway,
  // so the chosen palette's colours are visible above the switcher. Display only.
  const chipsWrap = document.createElement("div");
  chipsWrap.className = "art-chips";
  const swatches = (["paper", "ink", "accent"] as const).map((key) => {
    const s = document.createElement("span");
    s.className = "art-chip swatch";
    chipsWrap.appendChild(s);
    return { key, el: s };
  });
  colour.appendChild(chipsWrap);
  const syncChips = (): void => {
    const pal = PALETTES[look.colorway] ?? PALETTES[10];
    for (const { key, el } of swatches) { el.style.background = pal[key]; el.title = `${key}: ${pal[key]}`; }
  };
  syncers.push(syncChips);
  syncChips();
  // Palette is a ‹ name › stepper that wraps around all 24 colorways. The
  // stepper's +/- already run pushTreatment() (which pushes uColorway and runs
  // applyColorwayChrome), so the chrome and shader stay in lockstep.
  const nColors = COLORS.length;
  const palRow = stepper(colour, "Palette", () => COLORS[look.colorway],
    () => { look.colorway = (look.colorway - 1 + nColors) % nColors; },
    () => { look.colorway = (look.colorway + 1) % nColors; },
    () => syncChips());
  const palBtns = palRow.querySelectorAll<HTMLButtonElement>(".art-step-b");
  if (palBtns[0]) palBtns[0].textContent = "‹";
  if (palBtns[1]) palBtns[1].textContent = "›";
  palRow.querySelector(".art-ctl-v")?.classList.add("is-name");
  toggle(colour, "Full colour", () => !!look.colorDither, () => { look.colorDither ^= 1; }, () => refreshNA());
  const colourMotifCtl = addMotif(colour); // mark shape, surfaced for full-colour
  const levelsCtl = stepper(colour, "Levels", () => String(look.colorLevels),
    () => { look.colorLevels = Math.max(2, look.colorLevels - 1); },
    () => { look.colorLevels = Math.min(16, look.colorLevels + 1); });
  // Mark brightness: brightens/darkens the dither mark colour itself (the palette
  // ink / colour dot), distinct from Image > Brightness which adjusts the source.
  stepper(colour, "Mark bright", () => look.markBright.toFixed(2),
    () => { look.markBright = Math.max(-1, +(look.markBright - 0.05).toFixed(2)); },
    () => { look.markBright = Math.min(1, +(look.markBright + 0.05).toFixed(2)); });

  // IMAGE — source photo tone.
  const image = group("Image");
  // Image thumbnail (top of the group): the SOURCE photo, framed by the same
  // Fit / Pos / Zoom mapping the shader uses — NOT the dithered plate. (A dithered
  // mini goes nearly invisible on dark-paper palettes and hides what the photo is;
  // the point of this preview is to see the picture and how it's cropped.) Live, so
  // tweaking Fit / Pos / Zoom / Brightness / Contrast updates it; tone is the source
  // (no dither / palette / invert) so it reads on any stock.
  const imgThumb = document.createElement("canvas");
  imgThumb.className = "art-thumb";
  imgThumb.width = 200;
  imgThumb.height = 64;
  imgThumb.setAttribute("aria-hidden", "true");
  image.appendChild(imgThumb);
  const thumbCtx = imgThumb.getContext("2d");
  const drawSourceThumb = (): void => {
    if (!thumbCtx) return;
    const tw = imgThumb.width, th = imgThumb.height;
    thumbCtx.filter = "none";
    thumbCtx.clearRect(0, 0, tw, th); // bare = thumb's --ground (letterbox / off-edge)
    const im = curImageEl;
    if (!im || !im.naturalWidth || !im.naturalHeight || !canvas) return;
    const plateA = (canvas.width || 1) / (canvas.height || 1);
    // The plate-aspect area, contain-fit into the thumb (so framing reads true).
    let pw = tw, ph = tw / plateA;
    if (ph > th) { ph = th; pw = th * plateA; }
    const px = (tw - pw) / 2, py = (th - ph) / 2;
    // Fit / Pos / Zoom — mirror of the shader's isc / iuv (see art.ts image block).
    const imgW = im.naturalWidth, imgH = im.naturalHeight;
    const r = (imgW / imgH) / plateA;
    const cover = look.fit < 0.5;
    let iscx: number, iscy: number;
    if (cover) { if (r > 1) { iscx = 1 / r; iscy = 1; } else { iscx = 1; iscy = r; } }
    else { if (r > 1) { iscx = 1; iscy = r; } else { iscx = 1 / r; iscy = 1; } }
    const z = Math.max(look.zoom, 0.05); iscx /= z; iscy /= z;
    const u0x = look.posX * (1 - iscx), u0y = look.posY * (1 - iscy);
    // Visible source rect in image px (Y flipped: shader v=0 == image bottom).
    let sx = u0x * imgW, sw = iscx * imgW;
    let sy = (1 - (u0y + iscy)) * imgH, sh = iscy * imgH;
    let dx = px, dy = py, dw = pw, dh = ph;
    // Clamp the source rect into the image, shrinking dest in step — so contain
    // letterbox + negative-Pos bleed fall back to the bare ground (matches the plate).
    if (sx < 0) { const f = -sx / sw; dx += f * dw; dw -= f * dw; sw += sx; sx = 0; }
    if (sx + sw > imgW) { const f = (sx + sw - imgW) / sw; dw -= f * dw; sw = imgW - sx; }
    if (sy < 0) { const f = -sy / sh; dy += f * dh; dh -= f * dh; sh += sy; sy = 0; }
    if (sy + sh > imgH) { const f = (sy + sh - imgH) / sh; dh -= f * dh; sh = imgH - sy; }
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    // Approximate the source brightness/contrast (the dither's own, not the palette).
    const b = 1 + Math.max(-0.95, look.brightness);
    thumbCtx.filter = `brightness(${b.toFixed(3)}) contrast(${Math.max(0, look.contrast).toFixed(3)})`;
    try { thumbCtx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); } catch { /* ignore */ }
    thumbCtx.filter = "none";
    if (histOn) drawThumbOverlays(px, py, pw, ph);
  };
  // ---- Histogram / matching overlays (click the thumb to toggle) ----
  // Luma histogram of the GRADED crop (what the dither actually reads), a clip
  // readout, the plate boundary, and the fade anchor — all drawn over the thumb.
  let histOn = false;
  const histStat = document.createElement("div");
  histStat.className = "art-thumb-note";
  histStat.hidden = true;
  image.appendChild(histStat);
  const drawThumbOverlays = (px: number, py: number, pw: number, ph: number): void => {
    if (!thumbCtx) return;
    // Histogram from the drawn thumb region (already fit/pos/zoom + B/C graded).
    let data: ImageData;
    try { data = thumbCtx.getImageData(0, 0, imgThumb.width, imgThumb.height); } catch { return; }
    const bins = new Array<number>(64).fill(0);
    let n = 0, sum = 0, lo = 0, hi = 0;
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue; // bare ground (letterbox/off-edge), not image
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      bins[Math.min(63, Math.floor(l * 64))]++;
      sum += l; n++;
      if (l <= 0.008) lo++; else if (l >= 0.992) hi++;
    }
    if (!n) { histStat.textContent = "no image"; return; }
    const peak = Math.max(...bins);
    // Bars over the lower band, cream translucent (readable on any photo).
    const bandH = imgThumb.height * 0.42;
    thumbCtx.fillStyle = "rgba(244, 239, 221, 0.75)";
    const bw = imgThumb.width / 64;
    for (let i = 0; i < 64; i++) {
      const h = (bins[i] / peak) * bandH;
      thumbCtx.fillRect(i * bw, imgThumb.height - h, Math.max(bw - 0.5, 0.5), h);
    }
    // Plate boundary + fade anchor (shader v=0 == plate bottom).
    thumbCtx.strokeStyle = "rgba(57, 255, 20, 0.9)"; // fluo green, matches uShowCanvas
    thumbCtx.lineWidth = 1;
    thumbCtx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    if (look.fadeMode > 0) {
      thumbCtx.fillStyle = "rgba(255, 60, 172, 0.95)"; // fluo magenta dot
      thumbCtx.beginPath();
      thumbCtx.arc(px + look.fadePosX * pw, py + (1 - look.fadePosY) * ph, 2.5, 0, Math.PI * 2);
      thumbCtx.fill();
    }
    histStat.textContent = `mean ${(sum / n).toFixed(2)} · clip ${((lo / n) * 100).toFixed(1)}%/${((hi / n) * 100).toFixed(1)}%`;
  };
  imgThumb.style.cursor = "pointer";
  imgThumb.title = "Toggle histogram + plate/fade markers";
  imgThumb.addEventListener("click", () => {
    histOn = !histOn;
    histStat.hidden = !histOn;
    drawSourceThumb();
  });
  onImageChange = drawSourceThumb;
  drawSourceThumb();
  window.setInterval(drawSourceThumb, 160); // keep it live (reflects Fit/Pos/Zoom/B/C)
  // Fit + position: how the photo maps into the plate. Pos X/Y anchor the crop
  // (cover) or the letterbox placement (contain). 0,0 = bottom-left; 0.5 = centre.
  select(image, "Fit", ["Cover", "Contain"], () => look.fit, (i) => { look.fit = i; });
  stepper(image, "Pos X", () => look.posX.toFixed(2),
    () => { look.posX = Math.max(-1, +(look.posX - 0.1).toFixed(2)); },
    () => { look.posX = Math.min(2, +(look.posX + 0.1).toFixed(2)); });
  stepper(image, "Pos Y", () => look.posY.toFixed(2),
    () => { look.posY = Math.max(-1, +(look.posY - 0.1).toFixed(2)); },
    () => { look.posY = Math.min(2, +(look.posY + 0.1).toFixed(2)); });
  // Zoom: scale the photo in/out within the plate, on top of Cover/Contain.
  stepper(image, "Zoom", () => `${look.zoom.toFixed(2)}×`,
    () => { look.zoom = Math.max(0.2, +(look.zoom - 0.1).toFixed(2)); },
    () => { look.zoom = Math.min(5, +(look.zoom + 0.1).toFixed(2)); });
  stepper(image, "Brightness", () => look.brightness.toFixed(2),
    () => { look.brightness = Math.max(-1, +(look.brightness - 0.05).toFixed(2)); },
    () => { look.brightness = Math.min(1, +(look.brightness + 0.05).toFixed(2)); });
  stepper(image, "Contrast", () => look.contrast.toFixed(2),
    () => { look.contrast = Math.max(0.1, +(look.contrast - 0.1).toFixed(2)); },
    () => { look.contrast = Math.min(5, +(look.contrast + 0.1).toFixed(2)); });
  // Auto-levels SUGGESTION: measure the raw photo's p2/p98 luma percentiles and
  // invert the shader grade (adj = (l-.5)·C + .5 + B) so they land on 0.08/0.92.
  // Whole-frame measure (not the crop) — a starting point, tweakable after; never
  // touches Invert (palette-owned, see resolveAuto).
  const suggestBtn = document.createElement("button");
  suggestBtn.type = "button";
  suggestBtn.textContent = "Suggest B/C";
  suggestBtn.addEventListener("click", () => {
    const im = curImageEl;
    if (!im || !im.naturalWidth) { flash(suggestBtn, "No image"); return; }
    const mc = document.createElement("canvas");
    mc.width = 96; mc.height = 64;
    const mctx = mc.getContext("2d");
    if (!mctx) return;
    mctx.drawImage(im, 0, 0, mc.width, mc.height);
    let data: ImageData;
    try { data = mctx.getImageData(0, 0, mc.width, mc.height); } catch { return; }
    const lums: number[] = [];
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      lums.push((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255);
    }
    lums.sort((a, b) => a - b);
    const p2 = lums[Math.floor(lums.length * 0.02)];
    const p98 = lums[Math.floor(lums.length * 0.98)];
    if (p98 - p2 < 0.02) { flash(suggestBtn, "Flat image"); return; } // degenerate
    const C = Math.min(5, Math.max(0.1, 0.84 / (p98 - p2)));
    const B = Math.min(1, Math.max(-1, -((p2 + p98) / 2 - 0.5) * C));
    look.contrast = +C.toFixed(2);
    look.brightness = +B.toFixed(2);
    refreshControls?.();
    if (scene) pushTreatment();
    flash(suggestBtn, `B ${look.brightness} · C ${look.contrast}`);
  });
  action(image, suggestBtn);
  const invertCtl = cycle3(image, "Invert", ["Off", "On", "Auto"], () => look.invertMode, (i) => { look.invertMode = i; });
  // Auto status (shown only in Auto mode): whether Auto inverted, and why — the
  // palette stock. "ON · dark" inverts on a dark-paper colorway; "OFF · light".
  const autoStat = document.createElement("span");
  autoStat.className = "art-ctl-v is-name";
  const autoRow = ctl(image, "Auto", autoStat);
  const updateAutoStatus = (): void => {
    // Invert is duotone-only: full-colour never inverts, so hide both rows there.
    setNA(invertCtl, !!look.colorDither);
    setNA(autoRow, !!look.colorDither || look.invertMode !== 2);
    if (look.colorDither || look.invertMode !== 2 || !lastAuto) return;
    const r = lastAuto;
    autoStat.textContent = `${r.invert ? "ON" : "OFF"} · ${r.paperLum < r.inkLum ? "dark" : "light"}`;
    autoStat.title = `paper ${r.paperLum.toFixed(2)} · ink ${r.inkLum.toFixed(2)} · gap ${r.gap.toFixed(2)}`;
    autoStat.style.background = r.invert ? "#f4efdd" : "";
    autoStat.style.color = r.invert ? "#14121a" : "";
    autoStat.style.padding = r.invert ? "0 4px" : "";
  };
  onAutoResolved = updateAutoStatus;
  updateAutoStatus();
  // Per-image persistence: settings are live/transient until pinned here. "Stored"
  // shows whether this image carries its own override or rides the default; Save
  // pins the current look to it; Reset drops the override back to the default.
  const pinStat = document.createElement("span");
  pinStat.className = "art-ctl-v is-name";
  ctl(image, "Stored", pinStat);
  const updatePinStatus = (): void => {
    const pinned = !!imageParams[look.image];
    pinStat.textContent = pinned ? "custom" : "general";
    pinStat.style.background = pinned ? "#f4efdd" : "";
    pinStat.style.color = pinned ? "#14121a" : "";
    pinStat.style.padding = pinned ? "0 4px" : "";
  };
  syncers.push(updatePinStatus); // re-evaluate on image switch (refreshControls runs syncers)
  updatePinStatus();
  // Treatment clipboard: carry one image's look to another without the JSON
  // round-trip. Copy stashes the current snapshot; Paste assigns + persists to
  // the current context (pinned image or general) through the normal edit path.
  let lookClipboard: Record<string, number> | null = null;
  const copyLookBtn = document.createElement("button");
  copyLookBtn.type = "button";
  copyLookBtn.textContent = "Copy look";
  const pasteLookBtn = document.createElement("button");
  pasteLookBtn.type = "button";
  pasteLookBtn.textContent = "Paste look";
  pasteLookBtn.disabled = true;
  pasteLookBtn.style.opacity = "0.4";
  copyLookBtn.addEventListener("click", () => {
    lookClipboard = snapshotParams();
    pasteLookBtn.disabled = false;
    pasteLookBtn.style.opacity = "";
    flash(copyLookBtn, "Copied ✓");
  });
  pasteLookBtn.addEventListener("click", () => {
    if (!lookClipboard) return;
    Object.assign(look, lookClipboard);
    refreshControls?.();
    if (scene) pushTreatment(); // persists to the right context via persistLook
    updatePinStatus();
    flash(pasteLookBtn, "Pasted ✓");
  });
  action(image, copyLookBtn);
  action(image, pasteLookBtn);
  // Per-image note: why this image is tuned the way it is. Any image (pinned or
  // not); persisted in the treatments store, exported in the checkpoint file.
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.className = "art-note";
  noteInput.placeholder = "note…";
  noteInput.setAttribute("aria-label", "Per-image note");
  const syncNote = (): void => { noteInput.value = imageNotes[look.image] ?? ""; };
  syncNote();
  syncers.push(syncNote);
  noteInput.addEventListener("blur", () => {
    const v = noteInput.value.trim();
    if (v) imageNotes[look.image] = v;
    else delete imageNotes[look.image];
    pushStore();
  });
  ctl(image, "Note", noteInput);
  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.textContent = "Save to image";
  pinBtn.addEventListener("click", () => { pinCurrentImageParams(); updatePinStatus(); flash(pinBtn, "Saved ✓"); });
  action(image, pinBtn);
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.textContent = "Reset image";
  resetBtn.addEventListener("click", () => { clearCurrentImageParams(); updatePinStatus(); flash(resetBtn, "Default ✓"); });
  action(image, resetBtn);

  // CURSOR — how the pointer presses into the dither. Edge applies to Negative;
  // Detail + Colorize apply to Develop (others are hidden for the active mode).
  const cursor = group("Cursor");
  select(cursor, "Mode", CURSOR_MODES, () => look.cursorMode, (i) => { look.cursorMode = i; }, () => refreshNA());
  const cursorMotifCtl = addMotif(cursor); // mark shape, surfaced for Develop
  stepper(cursor, "Strength", () => look.cursorAmp.toFixed(2),
    () => { look.cursorAmp = Math.max(0, +(look.cursorAmp - 0.1).toFixed(2)); },
    () => { look.cursorAmp = Math.min(5, +(look.cursorAmp + 0.1).toFixed(2)); });
  stepper(cursor, "Falloff", () => look.cursorRadius.toFixed(1),
    () => { look.cursorRadius = Math.max(0.2, +(look.cursorRadius - 0.2).toFixed(1)); },
    () => { look.cursorRadius = Math.min(16, +(look.cursorRadius + 0.2).toFixed(1)); });
  stepper(cursor, "Hold", () => look.cursorHold.toFixed(2),
    () => { look.cursorHold = Math.max(0, +(look.cursorHold - 0.1).toFixed(2)); },
    () => { look.cursorHold = Math.min(3, +(look.cursorHold + 0.1).toFixed(2)); });
  const edgeCtl = stepper(cursor, "Hardness", () => look.cursorEdge.toFixed(2),
    () => { look.cursorEdge = Math.max(0, +(look.cursorEdge - 0.05).toFixed(2)); },
    () => { look.cursorEdge = Math.min(2, +(look.cursorEdge + 0.05).toFixed(2)); });

  // DEVELOP — the look of cursor mode 5 (Develop): all hidden unless Mode = Develop.
  const develop = group("Develop");
  const developGroupEl = develop.parentElement as HTMLElement; // wrapper, hidden when not Develop
  stepper(develop, "Cells", () => String(look.cursorDetail),
    () => { look.cursorDetail = Math.max(40, look.cursorDetail - 24); },
    () => { look.cursorDetail = Math.min(3000, look.cursorDetail + 24); });
  stepper(develop, "Stage", () => look.cursorStage.toFixed(2),
    () => { look.cursorStage = Math.max(0, +(look.cursorStage - 0.05).toFixed(2)); },
    () => { look.cursorStage = Math.min(1, +(look.cursorStage + 0.05).toFixed(2)); });
  stepper(develop, "Resolve", () => look.cursorResolve.toFixed(2),
    () => { look.cursorResolve = Math.max(0, +(look.cursorResolve - 0.1).toFixed(2)); },
    () => { look.cursorResolve = Math.min(1, +(look.cursorResolve + 0.1).toFixed(2)); });
  stepper(develop, "Colorize", () => look.cursorColorize.toFixed(2),
    () => { look.cursorColorize = Math.max(0, +(look.cursorColorize - 0.1).toFixed(2)); },
    () => { look.cursorColorize = Math.min(1, +(look.cursorColorize + 0.1).toFixed(2)); });
  stepper(develop, "Saturation", () => look.cursorSat.toFixed(2),
    () => { look.cursorSat = Math.max(0, +(look.cursorSat - 0.1).toFixed(2)); },
    () => { look.cursorSat = Math.min(4, +(look.cursorSat + 0.1).toFixed(2)); });
  // Posterise steps for the develop colour, same as the full-colour Levels but its own.
  stepper(develop, "Levels", () => String(look.cursorLevels),
    () => { look.cursorLevels = Math.max(2, look.cursorLevels - 1); },
    () => { look.cursorLevels = Math.min(16, look.cursorLevels + 1); });
  stepper(develop, "Pop", () => look.cursorSharp.toFixed(2),
    () => { look.cursorSharp = Math.max(0, +(look.cursorSharp - 0.1).toFixed(2)); },
    () => { look.cursorSharp = Math.min(3, +(look.cursorSharp + 0.1).toFixed(2)); });
  // Develop's own brightness / contrast (on top of the Image grade, applied to
  // the develop region's source before it's re-dithered).
  stepper(develop, "Dev bright", () => look.cursorBright.toFixed(2),
    () => { look.cursorBright = Math.max(-1, +(look.cursorBright - 0.05).toFixed(2)); },
    () => { look.cursorBright = Math.min(1, +(look.cursorBright + 0.05).toFixed(2)); });
  stepper(develop, "Dev contrast", () => look.cursorContrast.toFixed(2),
    () => { look.cursorContrast = Math.max(0.1, +(look.cursorContrast - 0.1).toFixed(2)); },
    () => { look.cursorContrast = Math.min(5, +(look.cursorContrast + 0.1).toFixed(2)); });

  // MOTION — the easing curve + duration of every dither/reveal transition, the
  // FPS cadence (Cine 24 / Fluid uncapped), and a live preview of the ease.
  const mo = group("Motion");
  const ease = easeGraph();
  select(mo, "Ease", EASES.map((e) => e[0]), () => motion.easeIdx, (i) => { motion.easeIdx = i; pushStore(); }, () => ease.update());
  stepper(mo, "Duration", () => `${motion.dur.toFixed(2)}s`,
    () => { motion.dur = Math.max(0.05, +(motion.dur - 0.05).toFixed(2)); pushStore(); },
    () => { motion.dur = Math.min(5, +(motion.dur + 0.05).toFixed(2)); pushStore(); },
    () => ease.update());
  select(mo, "FPS", FPS_LABELS, () => FPS_MODES.indexOf(motion.fps),
    (i) => { motion.fps = FPS_MODES[i]; applyFps(motion.fps, reduced); pushStore(); });
  mo.appendChild(ease.svg);
  ease.update();

  // OUTPUT — reveal the source + export the settings.
  const output = group("Output");
  const revealCtl = document.createElement("button");
  revealCtl.type = "button";
  revealCtl.textContent = look.reveal ? "Dither" : "Reveal";
  revealCtl.addEventListener("click", toggleReveal);
  revealBtns.push(revealCtl);
  action(output, revealCtl);
  // Image state: peek at the continuous-tone source the dither reads (with the
  // current brightness / contrast / invert applied), undithered. Distinct from
  // Reveal, which shows the photo in natural light (inversion reverted).
  const stateCtl = document.createElement("button");
  stateCtl.type = "button";
  stateCtl.textContent = "Image state";
  stateCtl.classList.toggle("is-on", !!look.imageState);
  stateCtl.setAttribute("aria-pressed", String(!!look.imageState));
  stateCtl.addEventListener("click", () => {
    look.imageState ^= 1;
    if (scene) scene.setParam("uImageState", look.imageState);
    stateCtl.classList.toggle("is-on", !!look.imageState);
    stateCtl.setAttribute("aria-pressed", String(!!look.imageState));
  });
  action(output, stateCtl);
  // Mask view: show the raw fade mask (gradient / cloud) as grayscale, so its
  // shape and moved anchor are directly visible — white = marks, black = ground.
  const maskCtl = document.createElement("button");
  maskCtl.type = "button";
  maskCtl.textContent = "Fade mask";
  maskCtl.classList.toggle("is-on", !!look.maskView);
  maskCtl.setAttribute("aria-pressed", String(!!look.maskView));
  maskCtl.addEventListener("click", () => {
    look.maskView ^= 1;
    if (scene) scene.setParam("uMaskView", look.maskView);
    maskCtl.classList.toggle("is-on", !!look.maskView);
    maskCtl.setAttribute("aria-pressed", String(!!look.maskView));
  });
  action(output, maskCtl);
  // Cursor view: show the raw cursor influence (infl) as grayscale — white = full
  // influence, black = none — so the ellipse shape and orientation are directly visible.
  const cursorViewCtl = document.createElement("button");
  cursorViewCtl.type = "button";
  cursorViewCtl.textContent = "Cursor field";
  cursorViewCtl.classList.toggle("is-on", !!look.cursorView);
  cursorViewCtl.setAttribute("aria-pressed", String(!!look.cursorView));
  cursorViewCtl.addEventListener("click", () => {
    look.cursorView ^= 1;
    if (scene) scene.setParam("uCursorView", look.cursorView);
    cursorViewCtl.classList.toggle("is-on", !!look.cursorView);
    cursorViewCtl.setAttribute("aria-pressed", String(!!look.cursorView));
  });
  action(output, cursorViewCtl);
  // Boundary overlays (dev): fluo borders for the canvas (green), the fitted image
  // (magenta), and the mask contour (yellow), so the coordinate spaces are visible.
  const boundToggle = (label: string, field: "showCanvas" | "showImage" | "showCloud", uniform: string): void => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    const sync = (): void => { btn.classList.toggle("is-on", !!look[field]); btn.setAttribute("aria-pressed", String(!!look[field])); };
    sync();
    btn.addEventListener("click", () => { look[field] ^= 1; if (scene) scene.setParam(uniform, look[field]); sync(); });
    action(output, btn);
  };
  boundToggle("Canvas edge", "showCanvas", "uShowCanvas");
  boundToggle("Image edge", "showImage", "uShowImage");
  boundToggle("Mask edge", "showCloud", "uShowCloud");
  // Treatments checkpoint: the store status row shows whether the working copy
  // is ahead of the committed file; Download writes treatments.json (drop into
  // src/samples/ + commit = the durable checkpoint and the future CMS seed).
  const storeStat = document.createElement("span");
  storeStat.className = "art-ctl-v is-name";
  ctl(output, "Store", storeStat);
  const updateStoreStatus = (): void => {
    const dirty = storeDirty(storeState());
    storeStat.textContent = dirty ? "local · unsaved" : `${bootTreatments.source} · synced`;
    storeStat.style.background = dirty ? "#f4efdd" : "";
    storeStat.style.color = dirty ? "#14121a" : "";
    storeStat.style.padding = dirty ? "0 4px" : "";
  };
  onStoreChanged = updateStoreStatus;
  updateStoreStatus();
  const dl = document.createElement("button");
  dl.type = "button";
  dl.textContent = "Download treatments";
  dl.addEventListener("click", () => {
    downloadTreatments(storeState());
    updateStoreStatus();
    flash(dl, "Saved ✓");
  });
  action(output, dl);
  // Copy a full, reload-restorable snapshot of the settings as JSON. Clipboard
  // first; if that's blocked, drop into a prompt() so it's still selectable/copyable.
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy JSON";
  const srcName = (key: string): string => (key === "field" ? "field" : (sampleSrc(key)?.split("/").pop() ?? key));
  copy.addEventListener("click", async () => {
    // Each written image-config is tagged with its source file name, so the JSON
    // names every image it pins, not just an internal key.
    const images: Record<string, unknown> = {};
    for (const [key, params] of Object.entries(imageParams)) {
      images[key] = { source: srcName(key), ...params };
    }
    const snapshot = {
      current: { image: look.image, source: srcName(look.image) },
      motion: { ease: mEase(), dur: motion.dur, fps: motion.fps },
      general, // the shared dev-menu config every un-pinned image uses
      images, // images with their own written config (each tagged with its source file)
    };
    const json = JSON.stringify(snapshot, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      flash(copy, "Copied ✓");
    } catch {
      window.prompt("Settings JSON (⌘C to copy):", json);
      flash(copy, "See prompt");
    }
  });
  action(output, copy);

  // Show only the controls that apply to the current mode (others are hidden).
  function refreshNA(): void {
    setNA(levelsCtl, !look.colorDither); // Levels: full-colour only
    setNA(colourMotifCtl, !look.colorDither); // Colour-group Motif: full-colour only
    updateAutoStatus(); // Invert/Auto rows: duotone-only (hidden in full colour)
    // Fade group: Mode is the always-visible master switch. Dissolve shape (anchor /
    // reach / softness / right-edge) shows for any fade; cloud texture only in Cloud.
    const fadeOff = look.fadeMode === 0;
    const notCloud = look.fadeMode !== 2;
    setNA(fadeXCtl, fadeOff);
    setNA(fadeYCtl, fadeOff);
    setNA(fadeReachCtl, fadeOff);
    setNA(fadeSoftCtl, fadeOff);
    setNA(featherCtl, fadeOff); // right-edge taper: part of the mask (any fade mode)
    setNA(curveCtl, fadeOff);
    setNA(depthCtl, fadeOff);
    noiseThumb.style.display = notCloud ? "none" : ""; // cloud-texture preview
    setNA(cloudCtl, notCloud); // Billow X
    setNA(cloudYCtl, notCloud); // Billow Y
    setNA(noiseCtl, notCloud); // Noise type
    setNA(warpCtl, notCloud); // Warp
    setNA(cloudWCtl, notCloud); // Cloud width
    setNA(cloudAnimCtl, notCloud); // Cloud anim
    setNA(cloudSpeedCtl, notCloud); // Cloud speed
    setNA(edgeCtl, look.cursorMode !== 4); // Edge: Negative only
    const notDev = look.cursorMode !== 5;
    setNA(cursorMotifCtl, notDev); // Cursor-group Motif: Develop only
    developGroupEl.style.display = notDev ? "none" : ""; // whole Develop group is Develop-only
  }
  // Re-sync every control's display from `look`, then re-evaluate contextual hides.
  // Called when an image's saved params are loaded (goImage → applyImageParams).
  refreshControls = (): void => { for (const s of syncers) s(); refreshNA(); };
  refreshNA();

  document.body.appendChild(bar);
  if (savedPos) applyPos(savedPos.x, savedPos.y); // restore drag position (needs layout)

  let startCollapsed = false;
  try { startCollapsed = localStorage.getItem(STORE) === "1"; } catch { /* ignore */ }
  bar.classList.add("no-anim"); // no slide on first paint
  setCollapsed(startCollapsed, false);
  requestAnimationFrame(() => bar.classList.remove("no-anim"));
}

if (params.has("dev")) buildDevBar();

if (import.meta.env.DEV) {
  Object.assign(window, {
    scene,
    look,
    // Test hook for the treatments store (artefact-check persistence run).
    artefactStore: {
      state: storeState,
      clear: clearLocalTreatments,
      source: (): string => bootTreatments.source,
      push: (): void => pushStore(),
    },
  });
}
