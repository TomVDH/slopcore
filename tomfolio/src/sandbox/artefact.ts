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

import "../system"; // token + base/component CSS side effects (no custom cursor)
import "./artefact.css";

import { gsap } from "gsap";
import { initScene, type GlScene } from "../gl/scene";
import { pressFrag, PALETTES } from "../directions/press/art";
import { SAMPLES, sampleSrc } from "../samples";

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
const COLORS = [
  "Bone", "Blueprint", "Sepia", "Acid", "Cyanotype", "Riso Pink", "Riso Blue",
  "Steel", "Oxblood", "Mono Inv", "Heather", "Noir", "Newsprint", "Terminal",
  "Amber", "Gameboy", "Ultraviolet", "Lagoon", "Marigold", "Mint Iron", "Plum",
  "Slate Ice", "Rust Sand", "Indigo Sun",
  "Emerald", "Ruby", "Sapphire", "Amethyst", "Topaz", "Jade",
  "Bubblegum", "Mint Cream", "Butter", "Periwinkle", "Peach", "Lilac",
  "Hot Pink", "Cyber", "Volt", "Laser", "Electric",
  "Moss", "Clay", "Saffron", "Fernway", "Dune",
  "Miami", "Vaporwave", "Chrome", "Dusk Grid",
  "Cobalt", "Forest Lemon", "Oxide", "Klein Pop",
];
// Index === uCursorMode value === the shader's if-ladder (keep in lockstep).
const CURSOR_MODES = ["Off", "Clear", "Ink", "Bias", "Negative", "Develop"];

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
  invert: 0, // resolved 0/1 actually pushed to uInvert
  invertMode: 2, // Invert control: 0 Off, 1 On, 2 Auto (image-decided)
  fadeMode: 2, // 0 off, 1 simple gradient, 2 cloud
  cloudSize: 1.2, // cloud-noise frequency (mode 2) — smaller = bigger billows
  reveal: 0, // 0 dithered, 1 full-res photo in natural light (Reveal tweens between)
  imageState: 0, // dev: 1 shows the adjusted source the dither reads, undithered
  colorDither: 0, // 0 duotone (palette), 1 full-colour ordered dither
  colorLevels: 4, // posterise steps per channel in colour mode
  cursorMode: 1, // 0 off, 1 clear, 2 ink, 3 bias, 4 negative, 5 develop
  cursorAmp: 0.4, // cursor strength
  cursorRadius: 2.2, // cursor disc falloff (larger = tighter)
  cursorHold: 0, // static persistence floor under the movement-driven strength
  cursorEdge: 0.25, // negative-mode disc hardness
  cursorDetail: 450, // develop sub-grid cell count (same units as `cell`)
  cursorColorize: 1, // develop: 1 resolve to true-colour photo, 0 stay monotone
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

// Size the GL canvas to the current image's NATIVE aspect at full plate height
// (left-aligned), so photos read at their original proportions and landscape
// shots fill further right — instead of being cover-cropped into the fixed CSS
// box. The scene re-measures uRes off the canvas, so its cover-fit becomes a
// no-op (no crop). Reverts to the CSS default for the procedural field.
let curImageEl: HTMLImageElement | null = null;
function applyCanvasWidth(): void {
  if (!canvas) return;
  const frame = canvas.parentElement as HTMLElement | null;
  if (!curImageEl || !curImageEl.naturalWidth || !frame || !frame.clientHeight) {
    canvas.style.width = ""; // no image, or frame not laid out yet — fall back to CSS (never 0px)
    return;
  }
  const aspect = curImageEl.naturalWidth / curImageEl.naturalHeight;
  const want = frame.clientHeight * aspect;
  const cap = frame.clientWidth * 0.9; // keep a sliver of ground for the menu
  canvas.style.width = `${Math.round(Math.min(want, cap))}px`;
}
function fitCanvas(im: HTMLImageElement | null): void {
  curImageEl = im;
  applyCanvasWidth();
  window.dispatchEvent(new Event("resize")); // scene re-measures uRes off the new box
}
window.addEventListener("resize", applyCanvasWidth, { passive: true });

const cur = { uImageOn: 0 }; // tweened field<->image crossfade amount
const xf = { v: 0 }; // tweened image<->image crossfade amount (uXfade)

function pushXfade(): void {
  if (scene) scene.setParam("uXfade", xf.v);
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
  scene.setParam("uCell", effectiveCell());
  scene.setParam("uMotifWeight", look.weight);
  scene.setParam("uMotifAngle", look.angle);
  scene.setParam("uMotifTone", look.tone);
  scene.setParam("uImageBrightness", look.brightness);
  scene.setParam("uImageContrast", look.contrast);
  resolveAuto(); // refresh resolved polarity (Auto re-evaluates for the current palette)
  scene.setParam("uInvert", look.invert);
  scene.setParam("uFadeMode", look.fadeMode);
  scene.setParam("uFadeScale", look.cloudSize);
  scene.setParam("uColorDither", look.colorDither);
  scene.setParam("uColorLevels", look.colorLevels);
  scene.setParam("uCursorMode", look.cursorMode);
  scene.setParam("uCursorAmp", look.cursorAmp);
  scene.setParam("uCursorRadius", look.cursorRadius);
  scene.setParam("uHold", look.cursorHold);
  scene.setParam("uCursorEdge", look.cursorEdge);
  scene.setParam("uDevCell", look.cursorDetail);
  scene.setParam("uDevColor", look.cursorColorize);
  applyColorwayChrome(look.colorway);
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
const EASES: ReadonlyArray<readonly [string, string]> = [
  ["Cubic out", "power2.out"],
  ["Quart out", "power3.out"],
  ["Quint out", "power4.out"],
  ["Expo out", "expo.out"],
  ["Circ out", "circ.out"],
  ["Quint inout", "power4.inOut"],
  ["Back out", "back.out(1.6)"],
];
const motion = { easeIdx: 2, dur: 0.6 }; // default: Quint out, 0.6s
const mEase = (): string => EASES[motion.easeIdx][1];

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
let hoverMode = false; // when on, hovering a menu item changes the image (no click needed)
if (menu) {
  const setActive = (b: HTMLElement, key: string): void => {
    for (const x of menu.querySelectorAll(".art-link")) x.classList.toggle("is-active", x === b);
    goImage(key);
  };
  MENU_ITEMS.forEach((item, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "art-link" + (item.key === look.image ? " is-active" : "");
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
  hb.className = "art-hover";
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
  rb.className = "art-reveal";
  rb.textContent = "Reveal";
  rb.addEventListener("click", toggleReveal);
  revealBtns.push(rb);
  host.appendChild(rb);
}

/* ---- Pixel-cross custom cursor + click "detonation" ---- */
/* A box-shadow pixel crosshair tracks the pointer (native cursor hidden). On a
   click over the plate, a ring of dither pixels bursts outward and the crosshair
   punches — the marks scatter from the click. Fine-pointer + motion only. */
if (!reduced && window.matchMedia("(pointer: fine)").matches) {
  const cur = document.createElement("div");
  cur.className = "art-cursor";
  cur.setAttribute("aria-hidden", "true");
  document.body.appendChild(cur);
  document.body.classList.add("art-has-cursor");
  const setX = gsap.quickSetter(cur, "x", "px");
  const setY = gsap.quickSetter(cur, "y", "px");
  setX(window.innerWidth / 2);
  setY(window.innerHeight / 2);
  window.addEventListener("pointermove", (e) => { setX(e.clientX); setY(e.clientY); });
  document.addEventListener("pointerleave", () => { cur.style.opacity = "0"; });
  document.addEventListener("pointerenter", () => { cur.style.opacity = ""; });

  window.addEventListener("pointerdown", (e) => {
    // Crosshair recoil on every click (elastic punch).
    gsap.fromTo(cur, { scale: 1.7 }, { scale: 1, duration: 0.55, ease: "elastic.out(1, 0.4)" });
    // Detonation only over the plate, not the controls (so steppers don't burst).
    const t = e.target as HTMLElement | null;
    if (t && t.closest(".art-dev, .art-reveal, .art-menu, button, select, input")) return;
    const x = e.clientX, y = e.clientY;
    const N = 14;
    for (let i = 0; i < N; i++) {
      const px = document.createElement("div");
      px.className = "art-px" + (i % 3 === 0 ? " is-accent" : "");
      px.style.left = `${x}px`;
      px.style.top = `${y}px`;
      document.body.appendChild(px);
      const a = (i / N) * Math.PI * 2 + i * 0.7;
      const dist = 34 + (i % 5) * 12;
      gsap.to(px, {
        x: Math.cos(a) * dist,
        y: Math.sin(a) * dist,
        rotation: 90,
        scale: 0.2,
        opacity: 0,
        duration: 0.45 + (i % 4) * 0.08,
        ease: "power3.out",
        onComplete: () => px.remove(),
      });
    }
    const ring = document.createElement("div");
    ring.className = "art-ring";
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    document.body.appendChild(ring);
    gsap.fromTo(ring, { scale: 0.2, opacity: 0.8 },
      { scale: 2.4, opacity: 0, duration: 0.5, ease: "power2.out", onComplete: () => ring.remove() });
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
  grip.addEventListener("click", () => setCollapsed(!collapsed));
  window.addEventListener("keydown", (e) => {
    if (e.key === "`" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setCollapsed(!collapsed);
    }
  });

  // A labeled column. Controls stack vertically inside it as [label · widget].
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

  // One control row: label on the left, widget on the right. Returns the row so
  // callers can mark it contextually N/A (dimmed + disabled).
  const ctl = (into: HTMLElement, label: string, widget: HTMLElement): HTMLElement => {
    const w = document.createElement("div");
    w.className = "art-ctl";
    const l = document.createElement("span");
    l.className = "art-ctl-l";
    l.textContent = label;
    w.append(l, widget);
    into.appendChild(w);
    return w;
  };

  // A dropdown for multi-option params (motif, colorway, fade).
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
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "art-step-b";
    plus.textContent = "+";
    minus.addEventListener("click", () => { dec(); pushTreatment(); val.textContent = get(); });
    plus.addEventListener("click", () => { inc(); pushTreatment(); val.textContent = get(); });
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
    btn.addEventListener("click", () => { set((get() + 1) % states.length); pushTreatment(); sync(); });
    return ctl(into, label, btn);
  };

  // A full-width action button (the Output column).
  const action = (into: HTMLElement, btn: HTMLButtonElement): void => {
    const w = document.createElement("div");
    w.className = "art-ctl art-ctl-act";
    btn.classList.add("art-act");
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

  // SCREEN — the dither marks + edge dissolve (Cloud only applies to Cloud fade).
  const screen = group("Screen");
  select(screen, "Motif", MOTIFS, () => look.motif, (i) => { look.motif = i; });
  stepper(screen, "Cell", () => String(look.cell),
    () => { look.cell = Math.max(60, look.cell - 12); },
    () => { look.cell = Math.min(320, look.cell + 12); });
  select(screen, "Fade", ["Off", "Simple", "Cloud"], () => look.fadeMode, (i) => { look.fadeMode = i; }, () => refreshNA());
  const cloudCtl = stepper(screen, "Cloud", () => look.cloudSize.toFixed(1),
    () => { look.cloudSize = Math.max(1, +(look.cloudSize - 0.5).toFixed(1)); },
    () => { look.cloudSize = Math.min(8, +(look.cloudSize + 0.5).toFixed(1)); });

  // COLOUR — palette + full-colour mode (Levels only applies in full colour).
  const colour = group("Colour");
  // Palette is a ‹ name › stepper that wraps around all 24 colorways. The
  // stepper's +/- already run pushTreatment() (which pushes uColorway and runs
  // applyColorwayChrome), so the chrome and shader stay in lockstep.
  const nColors = COLORS.length;
  const palRow = stepper(colour, "Palette", () => COLORS[look.colorway],
    () => { look.colorway = (look.colorway - 1 + nColors) % nColors; },
    () => { look.colorway = (look.colorway + 1) % nColors; });
  const palBtns = palRow.querySelectorAll<HTMLButtonElement>(".art-step-b");
  if (palBtns[0]) palBtns[0].textContent = "‹";
  if (palBtns[1]) palBtns[1].textContent = "›";
  palRow.querySelector(".art-ctl-v")?.classList.add("is-name");
  toggle(colour, "Full colour", () => !!look.colorDither, () => { look.colorDither ^= 1; }, () => refreshNA());
  const levelsCtl = stepper(colour, "Levels", () => String(look.colorLevels),
    () => { look.colorLevels = Math.max(2, look.colorLevels - 1); },
    () => { look.colorLevels = Math.min(8, look.colorLevels + 1); });

  // IMAGE — source photo tone.
  const image = group("Image");
  stepper(image, "Brightness", () => look.brightness.toFixed(2),
    () => { look.brightness = Math.max(-0.5, +(look.brightness - 0.05).toFixed(2)); },
    () => { look.brightness = Math.min(0.5, +(look.brightness + 0.05).toFixed(2)); });
  stepper(image, "Contrast", () => look.contrast.toFixed(2),
    () => { look.contrast = Math.max(0.4, +(look.contrast - 0.1).toFixed(2)); },
    () => { look.contrast = Math.min(2.6, +(look.contrast + 0.1).toFixed(2)); });
  cycle3(image, "Invert", ["Off", "On", "Auto"], () => look.invertMode, (i) => { look.invertMode = i; });
  // Auto status (shown only in Auto mode): whether Auto inverted, and why — the
  // palette stock. "ON · dark" inverts on a dark-paper colorway; "OFF · light".
  const autoStat = document.createElement("span");
  autoStat.className = "art-ctl-v is-name";
  const autoRow = ctl(image, "Auto", autoStat);
  const updateAutoStatus = (): void => {
    setNA(autoRow, look.invertMode !== 2);
    if (look.invertMode !== 2 || !lastAuto) return;
    const r = lastAuto;
    autoStat.textContent = `${r.invert ? "ON" : "OFF"} · ${r.paperLum < r.inkLum ? "dark" : "light"}`;
    autoStat.title = `paper ${r.paperLum.toFixed(2)} · ink ${r.inkLum.toFixed(2)} · gap ${r.gap.toFixed(2)}`;
    autoStat.style.background = r.invert ? "#f4efdd" : "";
    autoStat.style.color = r.invert ? "#14121a" : "";
    autoStat.style.padding = r.invert ? "0 4px" : "";
  };
  onAutoResolved = updateAutoStatus;
  updateAutoStatus();

  // CURSOR — how the pointer presses into the dither. Edge applies to Negative;
  // Detail + Colorize apply to Develop (others are hidden for the active mode).
  const cursor = group("Cursor");
  select(cursor, "Mode", CURSOR_MODES, () => look.cursorMode, (i) => { look.cursorMode = i; }, () => refreshNA());
  stepper(cursor, "Strength", () => look.cursorAmp.toFixed(2),
    () => { look.cursorAmp = Math.max(0, +(look.cursorAmp - 0.1).toFixed(2)); },
    () => { look.cursorAmp = Math.min(1.5, +(look.cursorAmp + 0.1).toFixed(2)); });
  stepper(cursor, "Radius", () => look.cursorRadius.toFixed(1),
    () => { look.cursorRadius = Math.max(0.6, +(look.cursorRadius - 0.2).toFixed(1)); },
    () => { look.cursorRadius = Math.min(6, +(look.cursorRadius + 0.2).toFixed(1)); });
  stepper(cursor, "Hold", () => look.cursorHold.toFixed(2),
    () => { look.cursorHold = Math.max(0, +(look.cursorHold - 0.1).toFixed(2)); },
    () => { look.cursorHold = Math.min(1, +(look.cursorHold + 0.1).toFixed(2)); });
  const edgeCtl = stepper(cursor, "Edge", () => look.cursorEdge.toFixed(2),
    () => { look.cursorEdge = Math.max(0, +(look.cursorEdge - 0.05).toFixed(2)); },
    () => { look.cursorEdge = Math.min(0.8, +(look.cursorEdge + 0.05).toFixed(2)); });
  const detailCtl = stepper(cursor, "Detail", () => String(look.cursorDetail),
    () => { look.cursorDetail = Math.max(120, look.cursorDetail - 12); },
    () => { look.cursorDetail = Math.min(960, look.cursorDetail + 12); });
  const colorizeCtl = toggle(cursor, "Colorize", () => !!look.cursorColorize, () => { look.cursorColorize ^= 1; });

  // MOTION — the easing curve + duration of every dither/reveal transition.
  const mo = group("Motion");
  select(mo, "Ease", EASES.map((e) => e[0]), () => motion.easeIdx, (i) => { motion.easeIdx = i; });
  stepper(mo, "Duration", () => `${motion.dur.toFixed(2)}s`,
    () => { motion.dur = Math.max(0.15, +(motion.dur - 0.05).toFixed(2)); },
    () => { motion.dur = Math.min(1.5, +(motion.dur + 0.05).toFixed(2)); });

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
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy values";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(look, null, 2));
      flash(copy, "Copied");
    } catch {
      flash(copy, "Failed");
    }
  });
  action(output, copy);

  // Show only the controls that apply to the current mode (others are hidden).
  function refreshNA(): void {
    setNA(levelsCtl, !look.colorDither); // Levels: full-colour only
    setNA(cloudCtl, look.fadeMode !== 2); // Cloud: cloud fade only
    setNA(edgeCtl, look.cursorMode !== 4); // Edge: Negative only
    setNA(detailCtl, look.cursorMode !== 5); // Detail: Develop only
    setNA(colorizeCtl, look.cursorMode !== 5); // Colorize: Develop only
  }
  refreshNA();

  document.body.appendChild(bar);

  let startCollapsed = false;
  try { startCollapsed = localStorage.getItem(STORE) === "1"; } catch { /* ignore */ }
  bar.classList.add("no-anim"); // no slide on first paint
  setCollapsed(startCollapsed, false);
  requestAnimationFrame(() => bar.classList.remove("no-anim"));
}

if (params.has("dev")) buildDevBar();

if (import.meta.env.DEV) {
  Object.assign(window, { scene, look });
}
