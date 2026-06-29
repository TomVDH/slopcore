/**
 * Corner artefact sandbox.
 *
 * An empty viewport, inset 25px (white margin): the Presswerk dither mounted
 * full-height in the bottom-left, dissolving into the deep ground. The
 * right-aligned menu lists one item per dither sample (auto-discovered from
 * src/samples/) plus Field; picking one cross-fades the dithered image (dip
 * through the field, swap under cover, fade back in, quad ease). The colorway
 * (Palette) drives the ground + menu text. A bottom-right Reveal button smoothly
 * crossfades the dithered plate to the full-res source photo and back (`uReveal`).
 * With `?dev`, a grouped dev bar exposes the treatment over two rows — Mark
 * (motif / cell / palette), Colour (RGB full-colour dither / levels), Tone
 * (brightness / contrast / invert), Dissolve (fade / cloud), View (Copy values) —
 * with a live settings readout. `?still` / reduced motion snap; `?nogl` leaves
 * the ground.
 */

import "../system"; // token + base/component CSS side effects (no custom cursor)
import "./artefact.css";

import { gsap } from "gsap";
import { initScene, type GlScene } from "../gl/scene";
import { pressFrag, PALETTES } from "../directions/press/art";
import { SAMPLES, sampleSrc } from "../samples";

const params = new URLSearchParams(window.location.search);
const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("still");

const MOTIFS = ["Dots", "Disc", "X", "Plus", "Dash"];
const COLORS = [
  "Bone", "Blueprint", "Sepia", "Acid", "Cyanotype", "Riso Pink", "Riso Blue",
  "Steel", "Oxblood", "Mono Inv", "Heather", "Noir", "Newsprint", "Terminal",
  "Amber", "Gameboy", "Ultraviolet", "Lagoon", "Marigold", "Mint Iron", "Plum",
  "Slate Ice", "Rust Sand", "Indigo Sun",
];
const FADES = ["off", "simple", "cloud"];

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;

// Unified look state: the menu sets `image`, the dev bar sets the treatment.
const look = {
  image: "portrait", // a sample key, or "field"
  motif: 1,
  colorway: 10,
  cell: 150,
  weight: 0.62,
  angle: 0,
  tone: 0.5,
  brightness: 0, // image brightness (added)
  contrast: 1, // image contrast (around mid)
  invert: 0,
  fadeMode: 2, // 0 off, 1 simple gradient, 2 cloud
  cloudSize: 1.2, // cloud-noise frequency (mode 2) — smaller = bigger billows
  reveal: 0, // 0 dithered, 1 full-res photo (the Reveal button tweens between)
  colorDither: 0, // 0 duotone (palette), 1 full-colour ordered dither
  colorLevels: 4, // posterise steps per channel in colour mode
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

let curImageSrc: string | null = null;
let txToken = 0;
const cur = { uImageOn: 0 }; // tweened field<->image crossfade amount

function applyColorwayChrome(i: number): void {
  const pal = PALETTES[i] ?? PALETTES[10];
  document.body.style.setProperty("--ground", pal.paper);
  document.body.style.setProperty("--ink", pal.ink);
}

function pushTreatment(): void {
  if (!scene) return;
  scene.setParam("uMotif", look.motif);
  scene.setParam("uColorway", look.colorway);
  scene.setParam("uCell", effectiveCell());
  scene.setParam("uMotifWeight", look.weight);
  scene.setParam("uMotifAngle", look.angle);
  scene.setParam("uMotifTone", look.tone);
  scene.setParam("uImageBrightness", look.brightness);
  scene.setParam("uImageContrast", look.contrast);
  scene.setParam("uInvert", look.invert);
  scene.setParam("uFadeMode", look.fadeMode);
  scene.setParam("uFadeScale", look.cloudSize);
  scene.setParam("uColorDither", look.colorDither);
  scene.setParam("uColorLevels", look.colorLevels);
  applyColorwayChrome(look.colorway);
}

// Reveal: smoothly crossfade the dither <-> full-res photo AND ramp the cell
// frequency up 32x so the marks shrink and resolve into the image. `rev.v` is
// the tweened amount [0..1]; `look.reveal` is the 0/1 target the button flips.
const rev = { v: 0 };
const REVEAL_CELL_MULT = 32;
function effectiveCell(): number {
  return Math.round(look.cell * (1 + (REVEAL_CELL_MULT - 1) * rev.v));
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
    gsap.to(rev, { v: look.reveal, duration: 0.85, ease: "power2.inOut", onUpdate: pushReveal });
  }
}

function pushImageOn(): void {
  if (scene) scene.setParam("uImageOn", cur.uImageOn);
}

// Cross-fade to a sample image (or the field). Different image dips through the
// field — fade out, swap under cover, fade back in.
function goImage(key: string): void {
  look.image = key;
  if (!scene) return;
  const targetSrc = key === "field" ? null : sampleSrc(key);

  if (reduced) {
    if (targetSrc) {
      cur.uImageOn = 1;
      loadImg(targetSrc).then((im) => {
        if (im && scene) {
          scene.setImage(im);
          curImageSrc = targetSrc;
          pushImageOn();
        }
      });
    } else {
      cur.uImageOn = 0;
    }
    pushImageOn();
    return;
  }

  const tok = ++txToken;
  gsap.killTweensOf(cur);
  if (!targetSrc) {
    gsap.to(cur, { uImageOn: 0, duration: 0.6, ease: "power2.inOut", onUpdate: pushImageOn });
    return;
  }
  if (targetSrc === curImageSrc) {
    gsap.to(cur, { uImageOn: 1, duration: 0.6, ease: "power2.inOut", onUpdate: pushImageOn });
    return;
  }
  const fadeIn = async (): Promise<void> => {
    const im = await loadImg(targetSrc);
    if (tok !== txToken) return;
    if (im && scene) {
      scene.setImage(im);
      curImageSrc = targetSrc;
    }
    gsap.to(cur, { uImageOn: 1, duration: 0.6, ease: "power2.out", onUpdate: pushImageOn });
  };
  if (!curImageSrc || cur.uImageOn < 0.02) {
    void fadeIn();
  } else {
    gsap.to(cur, {
      uImageOn: 0,
      duration: 0.45,
      ease: "power2.in",
      onUpdate: pushImageOn,
      onComplete: () => {
        if (tok === txToken) void fadeIn();
      },
    });
  }
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
    pushImageOn(); // field until the first image loads
    goImage(look.image); // form the portrait
  } else {
    throw new Error("nogl");
  }
} catch {
  document.body.classList.add("no-gl");
  canvas?.remove();
}

/* ---- Menu: one item per sample image + Field ---- */
const menu = document.querySelector<HTMLElement>(".art-menu");
const MENU_ITEMS = [...SAMPLES.map((s) => ({ key: s.key, label: s.label })), { key: "field", label: "Field" }];
if (menu) {
  for (const item of MENU_ITEMS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "art-link" + (item.key === look.image ? " is-active" : "");
    b.textContent = item.label;
    b.dataset.key = item.key;
    b.addEventListener("click", () => {
      for (const x of menu.querySelectorAll(".art-link")) x.classList.toggle("is-active", x === b);
      goImage(item.key);
    });
    menu.appendChild(b);
  }
}

/* ---- Reveal button: smoothly resolve the dither into the full-res photo ---- */
if (scene) {
  const rb = document.createElement("button");
  rb.type = "button";
  rb.className = "art-reveal";
  rb.textContent = "Reveal";
  rb.addEventListener("click", toggleReveal);
  revealBtns.push(rb);
  (document.querySelector(".art-frame") ?? document.body).appendChild(rb);
}

/* ---- Dev bar (?dev): treatment toggles + live readout + copy values ---- */
function flash(btn: HTMLElement, msg: string): void {
  const prev = btn.textContent;
  btn.textContent = msg;
  window.setTimeout(() => {
    btn.textContent = prev;
  }, 1100);
}

function buildDevBar(): void {
  if (!scene) return;
  const bar = document.createElement("div");
  bar.className = "art-dev";

  const row = document.createElement("div");
  row.className = "art-dev-row";
  bar.appendChild(row);

  // A labeled group of controls, separated by dividers in the row.
  const group = (label: string): HTMLElement => {
    const g = document.createElement("div");
    g.className = "art-group";
    const l = document.createElement("span");
    l.className = "art-group-l";
    l.textContent = label;
    const ctls = document.createElement("div");
    ctls.className = "art-group-ctls";
    g.append(l, ctls);
    row.appendChild(g);
    return ctls;
  };

  const ctl = (into: HTMLElement, label: string, widget: HTMLElement): void => {
    const w = document.createElement("div");
    w.className = "art-ctl";
    const l = document.createElement("span");
    l.className = "art-ctl-l";
    l.textContent = label;
    w.append(l, widget);
    into.appendChild(w);
  };

  // A dropdown for multi-option params (motif, colorway, fade).
  const select = (
    into: HTMLElement,
    label: string,
    options: readonly string[],
    get: () => number,
    set: (i: number) => void,
  ): void => {
    const sel = document.createElement("select");
    sel.className = "art-sel";
    options.forEach((opt, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = opt;
      sel.appendChild(o);
    });
    sel.value = String(get());
    sel.addEventListener("change", () => {
      set(parseInt(sel.value, 10));
      pushTreatment();
    });
    ctl(into, label, sel);
  };

  // A [−] value [+] stepper for numerics.
  const stepper = (
    into: HTMLElement,
    label: string,
    get: () => string,
    dec: () => void,
    inc: () => void,
  ): void => {
    const grp = document.createElement("div");
    grp.className = "art-step";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    const val = document.createElement("span");
    val.className = "art-ctl-v";
    val.textContent = get();
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    minus.addEventListener("click", () => { dec(); pushTreatment(); val.textContent = get(); });
    plus.addEventListener("click", () => { inc(); pushTreatment(); val.textContent = get(); });
    grp.append(minus, val, plus);
    ctl(into, label, grp);
  };

  // A small two-state toggle button.
  const toggle = (into: HTMLElement, label: string, get: () => string, flip: () => void): void => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "art-ctl-v art-toggle";
    btn.textContent = get();
    btn.addEventListener("click", () => { flip(); pushTreatment(); btn.textContent = get(); });
    ctl(into, label, btn);
  };

  const mark = group("Mark");
  select(mark, "Motif", MOTIFS, () => look.motif, (i) => { look.motif = i; });
  stepper(mark, "Cell", () => String(look.cell),
    () => { look.cell = Math.max(60, look.cell - 12); },
    () => { look.cell = Math.min(320, look.cell + 12); });
  select(mark, "Palette", COLORS, () => look.colorway, (i) => { look.colorway = i; });

  const colour = group("Colour");
  toggle(colour, "RGB", () => (look.colorDither ? "on" : "off"), () => { look.colorDither ^= 1; });
  stepper(colour, "Levels", () => String(look.colorLevels),
    () => { look.colorLevels = Math.max(2, look.colorLevels - 1); },
    () => { look.colorLevels = Math.min(8, look.colorLevels + 1); });

  const tone = group("Tone");
  stepper(tone, "Bright", () => look.brightness.toFixed(2),
    () => { look.brightness = Math.max(-0.5, +(look.brightness - 0.05).toFixed(2)); },
    () => { look.brightness = Math.min(0.5, +(look.brightness + 0.05).toFixed(2)); });
  stepper(tone, "Contrast", () => look.contrast.toFixed(2),
    () => { look.contrast = Math.max(0.4, +(look.contrast - 0.1).toFixed(2)); },
    () => { look.contrast = Math.min(2.6, +(look.contrast + 0.1).toFixed(2)); });
  toggle(tone, "Invert", () => (look.invert ? "on" : "off"), () => { look.invert ^= 1; });

  // Force a second row: image-look controls above, scene + utilities below.
  const br = document.createElement("div");
  br.className = "art-rowbreak";
  row.appendChild(br);

  const dissolve = group("Dissolve");
  select(dissolve, "Fade", FADES, () => look.fadeMode, (i) => { look.fadeMode = i; });
  stepper(dissolve, "Cloud", () => look.cloudSize.toFixed(1),
    () => { look.cloudSize = Math.max(1, +(look.cloudSize - 0.5).toFixed(1)); },
    () => { look.cloudSize = Math.min(8, +(look.cloudSize + 0.5).toFixed(1)); });

  // Meta / debug controls grouped apart from the treatment.
  const view = group("View");
  const revealCtl = document.createElement("button");
  revealCtl.type = "button";
  revealCtl.className = "art-ctl-v art-toggle";
  revealCtl.textContent = look.reveal ? "Dither" : "Reveal";
  revealCtl.addEventListener("click", toggleReveal);
  revealBtns.push(revealCtl);
  ctl(view, "Photo", revealCtl);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "art-copy";
  copy.textContent = "Copy values";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(look, null, 2));
      flash(copy, "Copied");
    } catch {
      flash(copy, "Failed");
    }
  });
  view.appendChild(copy);

  document.body.appendChild(bar);
}

if (params.has("dev")) buildDevBar();

if (import.meta.env.DEV) {
  Object.assign(window, { scene, look });
}
