/**
 * Corner artefact sandbox.
 *
 * An empty viewport, inset 25px (white margin): the Presswerk dither mounted in
 * the bottom-left, CSS-masked so it dissolves into the deep ground. The
 * right-aligned menu lists one item per dither sample (auto-discovered from
 * src/samples/) plus Field; picking one cross-fades the dithered image (dip
 * through the field, swap under cover, fade back in, quad ease). On load each
 * image's mean luminance is measured: a near-black source (a bright subject on
 * black, like the moon) auto-inverts polarity so the subject renders as marks
 * instead of the empty ground. The colorway drives the ground + menu text.
 * With `?dev`, a dev bar exposes the treatment grouped as Mark (motif / cell /
 * colorway), Dissolve (fade / cloud), Tone (brightness / contrast / invert) and
 * View (a Source toggle that previews the raw photo with the current brightness
 * / contrast instead of the dither, plus a Copy-values button) over a live
 * settings readout. `?still` / reduced motion snap; `?nogl` leaves the ground.
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
const COLORS = ["Bone", "Blueprint", "Sepia", "Acid", "Cyanotype", "Riso Pink", "Riso Blue", "Steel", "Oxblood", "Mono Inv", "Heather"];
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
  showRaw: 0, // debug: 1 shows the raw source photo instead of the dither
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

// Mean luminance of an image (downscaled), cached by src. Drives auto-polarity:
// a near-black source (a bright subject on black, like the moon) dithers better
// inverted so the subject becomes marks instead of the empty ground. Measured
// across the sample set, every photographic image scores >= 0.2; only an
// almost-entirely-black frame falls under the 0.08 threshold.
const meanLumCache = new Map<string, number>();
function meanLuminance(im: HTMLImageElement): number {
  const key = im.src;
  const hit = meanLumCache.get(key);
  if (hit !== undefined) return hit;
  let m = 0.5;
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 48;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (x) {
    x.drawImage(im, 0, 0, 48, 48);
    try {
      const d = x.getImageData(0, 0, 48, 48).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) {
        s += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      }
      m = s / (d.length / 4);
    } catch {
      m = 0.5;
    }
  }
  meanLumCache.set(key, m);
  return m;
}
const DARK_IMAGE_LUM = 0.08; // below this, auto-invert (bright subject on black)

let curImageSrc: string | null = null;
let txToken = 0;
const cur = { uImageOn: 0 }; // tweened field<->image crossfade amount

let readoutEl: HTMLElement | null = null;
function updateReadout(): void {
  if (!readoutEl) return;
  const fade = FADES[look.fadeMode] + (look.fadeMode === 2 ? ` ${look.cloudSize.toFixed(1)}` : "");
  readoutEl.textContent =
    `${look.image} · ${MOTIFS[look.motif].toLowerCase()} · ${COLORS[look.colorway].toLowerCase()} · ` +
    `cell ${look.cell} · bright ${look.brightness.toFixed(2)} · contrast ${look.contrast.toFixed(2)} · ` +
    `tone ${look.tone.toFixed(2)} · inv ${look.invert ? "on" : "off"} · fade ${fade}` +
    (look.showRaw ? " · RAW PHOTO" : "");
}

function applyColorwayChrome(i: number): void {
  const pal = PALETTES[i] ?? PALETTES[10];
  document.body.style.setProperty("--ground", pal.paper);
  document.body.style.setProperty("--ink", pal.ink);
}

function pushTreatment(): void {
  if (!scene) return;
  scene.setParam("uMotif", look.motif);
  scene.setParam("uColorway", look.colorway);
  scene.setParam("uCell", look.cell);
  scene.setParam("uMotifWeight", look.weight);
  scene.setParam("uMotifAngle", look.angle);
  scene.setParam("uMotifTone", look.tone);
  scene.setParam("uImageBrightness", look.brightness);
  scene.setParam("uImageContrast", look.contrast);
  scene.setParam("uInvert", look.invert);
  scene.setParam("uFadeMode", look.fadeMode);
  scene.setParam("uFadeScale", look.cloudSize);
  scene.setParam("uShowRaw", look.showRaw);
  applyColorwayChrome(look.colorway);
  updateReadout();
}

function pushImageOn(): void {
  if (scene) scene.setParam("uImageOn", cur.uImageOn);
}

// Refreshes the dev-bar control labels from `look` (assigned by buildDevBar).
// A no-op until the dev bar is built; lets auto-polarity update the Invert
// control instead of leaving it stale.
let refreshDevBar: () => void = () => {};

function setPolarity(v: number): void {
  look.invert = v;
  if (scene) scene.setParam("uInvert", v);
  updateReadout();
  refreshDevBar();
}

function autoPolarity(im: HTMLImageElement): void {
  setPolarity(meanLuminance(im) < DARK_IMAGE_LUM ? 1 : 0);
}

// Cross-fade to a sample image (or the field). Different image dips through the
// field — fade out, swap under cover, fade back in.
function goImage(key: string): void {
  look.image = key;
  updateReadout();
  if (!scene) return;
  const targetSrc = key === "field" ? null : sampleSrc(key);

  if (reduced) {
    if (targetSrc) {
      cur.uImageOn = 1;
      loadImg(targetSrc).then((im) => {
        if (im && scene) {
          autoPolarity(im);
          scene.setImage(im);
          curImageSrc = targetSrc;
          pushImageOn();
        }
      });
    } else {
      cur.uImageOn = 0;
      setPolarity(0);
    }
    pushImageOn();
    return;
  }

  const tok = ++txToken;
  gsap.killTweensOf(cur);
  if (!targetSrc) {
    // Reset polarity to the field default after the image has faded out, so the
    // outgoing photo keeps its own polarity while dissolving.
    gsap.to(cur, {
      uImageOn: 0,
      duration: 0.6,
      ease: "power2.inOut",
      onUpdate: pushImageOn,
      onComplete: () => setPolarity(0),
    });
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
      autoPolarity(im); // swap polarity under cover, with the new texture
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

  readoutEl = document.createElement("div");
  readoutEl.className = "art-readout";
  bar.appendChild(readoutEl);
  updateReadout();

  const row = document.createElement("div");
  row.className = "art-dev-row";
  bar.appendChild(row);

  // Each control registers a refresher so external state changes (e.g. auto-
  // polarity flipping Invert on image load) keep the bar in sync.
  const refreshers: (() => void)[] = [];

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

  // A value button that advances through options on click.
  const cycle = (into: HTMLElement, label: string, get: () => string, advance: () => void): void => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "art-ctl-v";
    btn.textContent = get();
    btn.addEventListener("click", () => {
      advance();
      pushTreatment();
      btn.textContent = get();
    });
    refreshers.push(() => { btn.textContent = get(); });
    ctl(into, label, btn);
  };

  // A [-] value [+] stepper.
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
    minus.addEventListener("click", () => {
      dec();
      pushTreatment();
      val.textContent = get();
    });
    plus.addEventListener("click", () => {
      inc();
      pushTreatment();
      val.textContent = get();
    });
    refreshers.push(() => { val.textContent = get(); });
    grp.append(minus, val, plus);
    ctl(into, label, grp);
  };

  const mark = group("Mark");
  cycle(mark, "Motif", () => MOTIFS[look.motif], () => { look.motif = (look.motif + 1) % MOTIFS.length; });
  stepper(mark, "Cell", () => String(look.cell),
    () => { look.cell = Math.max(60, look.cell - 12); },
    () => { look.cell = Math.min(320, look.cell + 12); });
  cycle(mark, "Color", () => COLORS[look.colorway], () => { look.colorway = (look.colorway + 1) % COLORS.length; });

  const dissolve = group("Dissolve");
  cycle(dissolve, "Fade", () => FADES[look.fadeMode], () => { look.fadeMode = (look.fadeMode + 1) % FADES.length; });
  stepper(dissolve, "Cloud", () => look.cloudSize.toFixed(1),
    () => { look.cloudSize = Math.max(1, +(look.cloudSize - 0.5).toFixed(1)); },
    () => { look.cloudSize = Math.min(8, +(look.cloudSize + 0.5).toFixed(1)); });

  const tone = group("Tone");
  stepper(tone, "Bright", () => look.brightness.toFixed(2),
    () => { look.brightness = Math.max(-0.5, +(look.brightness - 0.05).toFixed(2)); },
    () => { look.brightness = Math.min(0.5, +(look.brightness + 0.05).toFixed(2)); });
  stepper(tone, "Contrast", () => look.contrast.toFixed(2),
    () => { look.contrast = Math.max(0.4, +(look.contrast - 0.1).toFixed(2)); },
    () => { look.contrast = Math.min(2.6, +(look.contrast + 0.1).toFixed(2)); });
  cycle(tone, "Invert", () => (look.invert ? "on" : "off"), () => { look.invert ^= 1; });

  // Meta / debug controls grouped apart from the treatment.
  const view = group("View");
  cycle(view, "Source", () => (look.showRaw ? "photo" : "dither"), () => { look.showRaw ^= 1; });
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

  refreshDevBar = () => {
    for (const r of refreshers) r();
  };

  document.body.appendChild(bar);
}

if (params.has("dev")) buildDevBar();

if (import.meta.env.DEV) {
  Object.assign(window, { scene, look });
}
