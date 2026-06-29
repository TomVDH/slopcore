/**
 * RIG sandbox runtime + shader controller.
 *
 * Mounts the Presswerk dither (pressFrag) as the dominant plate, then
 * builds a control panel that drives every editable shader parameter live
 * via the scene's setParam. `?still` / reduced motion render a static
 * frame (each edit re-renders); `?nogl` falls back to the dot texture and
 * leaves the controls inert. The native cursor is kept for precise editing.
 */

import "../system"; // token + component CSS side effects (no custom cursor here)
import "./rig.css";

import { initScene, type GlScene } from "../gl/scene";
import { pressFrag } from "../directions/press/art";
import { SAMPLES } from "../samples";

const params = new URLSearchParams(window.location.search);
const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("still");

let scene: GlScene | null = null;
const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
try {
  if (canvas && !params.has("nogl")) {
    scene = initScene(canvas, reduced, pressFrag);
    scene.setEnergy(1);
  } else {
    throw new Error("nogl");
  }
} catch {
  document.body.classList.add("no-gl");
  canvas?.remove();
}

/* ---- The controller: every editable parameter the shader exposes ---- */

type Param =
  | { key: string; label: string; kind: "range"; min: number; max: number; step: number; def: number }
  | { key: string; label: string; kind: "select"; options: string[]; def: number }
  | { key: string; label: string; kind: "toggle"; def: number }
  | {
      key: string;
      label: string;
      kind: "vec2";
      min: number;
      max: number;
      step: number;
      defX: number;
      defY: number;
      labelX: string;
      labelY: string;
    };

const PARAMS: Param[] = [
  { key: "uMotif", label: "Motif", kind: "select", options: ["Dots", "Disc", "X", "Plus", "Dash"], def: 0 },
  { key: "uColorway", label: "Colorway", kind: "select", options: ["Bone / Carbon", "Blueprint", "Sepia", "Acid Lime", "Cyanotype", "Riso Pink", "Riso Blue", "Steel", "Oxblood", "Mono Invert", "Heather", "Noir", "Newsprint", "Terminal", "Amber CRT", "Gameboy", "Ultraviolet", "Lagoon", "Marigold", "Mint Iron", "Plum", "Slate Ice", "Rust Sand", "Indigo Sun", "Emerald", "Ruby", "Sapphire", "Amethyst", "Topaz", "Jade", "Bubblegum", "Mint Cream", "Butter", "Periwinkle", "Peach", "Lilac", "Hot Pink", "Cyber", "Volt", "Laser", "Electric", "Moss", "Clay", "Saffron", "Fernway", "Dune", "Miami", "Vaporwave", "Chrome", "Dusk Grid", "Cobalt", "Forest Lemon", "Oxide", "Klein Pop"], def: 0 },
  { key: "uImageOn", label: "Dither image", kind: "toggle", def: 0 },
  { key: "uColorDither", label: "Full colour", kind: "toggle", def: 0 },
  { key: "uColorLevels", label: "Colour levels", kind: "range", min: 2, max: 8, step: 1, def: 4 },
  { key: "uInvert", label: "Invert", kind: "toggle", def: 0 },
  { key: "uFade", label: "Edge fade", kind: "range", min: 0, max: 1, step: 0.01, def: 0 },
  { key: "uMotifWeight", label: "Mark weight", kind: "range", min: 0.1, max: 1, step: 0.01, def: 0.5 },
  { key: "uMotifAngle", label: "Mark angle", kind: "range", min: 0, max: 1, step: 0.005, def: 0 },
  { key: "uMotifTone", label: "Tone link", kind: "range", min: 0, max: 1, step: 0.01, def: 0 },
  { key: "uCell", label: "Cell density", kind: "range", min: 60, max: 320, step: 1, def: 150 },
  { key: "uEnergy", label: "Pressure", kind: "range", min: 0, max: 2, step: 0.01, def: 1 },
  { key: "uToneBase", label: "Tone base", kind: "range", min: 0.2, max: 0.8, step: 0.01, def: 0.42 },
  { key: "uToneContrast", label: "Tone contrast", kind: "range", min: 0, max: 0.7, step: 0.01, def: 0.34 },
  { key: "uToneScale", label: "Field scale", kind: "range", min: 0.5, max: 4, step: 0.05, def: 1.7 },
  { key: "uDrift", label: "Drift speed", kind: "range", min: 0, max: 0.2, step: 0.005, def: 0.05 },
  { key: "uThreshold", label: "Threshold", kind: "range", min: -0.2, max: 0.3, step: 0.01, def: 0.03 },
  { key: "uCursorAmp", label: "Cursor press", kind: "range", min: 0, max: 1, step: 0.01, def: 0.4 },
  { key: "uCursorRadius", label: "Press falloff", kind: "range", min: 0.5, max: 6, step: 0.05, def: 2.2 },
  { key: "uCrossOn", label: "Reg cross", kind: "toggle", def: 1 },
  { key: "uCrossSize", label: "Reg size", kind: "range", min: 0, max: 0.2, step: 0.005, def: 0.075 },
  { key: "uCrossPos", label: "Reg position", kind: "vec2", min: -1.2, max: 1.2, step: 0.01, defX: 0.62, defY: 0.58, labelX: "Reg X", labelY: "Reg Y" },
];

const state = new Map<string, number | [number, number]>();

function apply(key: string, value: number | [number, number]): void {
  state.set(key, value);
  scene?.setParam(key, value);
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 1 ? 3 : 2);
}

const list = document.querySelector<HTMLElement>(".ctrl-list");
if (list) {
  for (const p of PARAMS) {
    const id = `c-${p.key}`;
    const row = document.createElement("div");

    if (p.kind === "vec2") {
      state.set(p.key, [p.defX, p.defY]);
      row.className = "ctrl-row is-vec2";
      row.innerHTML = `<div class="ctrl-top"><label class="ctrl-label">${p.label}</label><output class="ctrl-val" id="${id}-v">${fmt(p.defX)}, ${fmt(p.defY)}</output></div>
        <input class="ctrl-input" type="range" id="${id}-x" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.defX}" aria-label="${p.labelX}" />
        <input class="ctrl-input" type="range" id="${id}-y" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.defY}" aria-label="${p.labelY}" />`;
      const ex = row.querySelector<HTMLInputElement>(`#${id}-x`)!;
      const ey = row.querySelector<HTMLInputElement>(`#${id}-y`)!;
      const out = row.querySelector("output")!;
      const upd = (): void => {
        const v: [number, number] = [Number(ex.value), Number(ey.value)];
        out.textContent = `${fmt(v[0])}, ${fmt(v[1])}`;
        apply(p.key, v);
      };
      ex.addEventListener("input", upd);
      ey.addEventListener("input", upd);
      list.appendChild(row);
      continue;
    }

    state.set(p.key, p.def);

    if (p.kind === "select") {
      row.className = "ctrl-row is-toggle";
      row.innerHTML = `<label class="ctrl-label" for="${id}">${p.label}</label>
        <select class="ctrl-input" id="${id}" style="width:auto">${p.options
          .map((o, i) => `<option value="${i}">${o}</option>`)
          .join("")}</select>`;
      const el = row.querySelector("select")!;
      el.value = String(p.def);
      el.addEventListener("input", () => apply(p.key, Number(el.value)));
    } else if (p.kind === "toggle") {
      row.className = "ctrl-row is-toggle";
      row.innerHTML = `<label class="ctrl-label" for="${id}">${p.label}</label>
        <input class="ctrl-toggle" type="checkbox" id="${id}"${p.def ? " checked" : ""} />`;
      const el = row.querySelector("input")!;
      el.addEventListener("input", () => apply(p.key, el.checked ? 1 : 0));
    } else {
      row.className = "ctrl-row";
      row.innerHTML = `<div class="ctrl-top"><label class="ctrl-label" for="${id}">${p.label}</label><output class="ctrl-val" id="${id}-v">${fmt(p.def)}</output></div>
        <input class="ctrl-input" type="range" id="${id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.def}" />`;
      const el = row.querySelector("input")!;
      const out = row.querySelector("output")!;
      el.addEventListener("input", () => {
        const v = Number(el.value);
        out.textContent = fmt(v);
        apply(p.key, v);
      });
    }
    list.appendChild(row);
  }
}

document.getElementById("reset")?.addEventListener("click", () => {
  for (const p of PARAMS) {
    if (p.kind === "vec2") {
      apply(p.key, [p.defX, p.defY]);
      const ex = document.getElementById(`c-${p.key}-x`) as HTMLInputElement | null;
      const ey = document.getElementById(`c-${p.key}-y`) as HTMLInputElement | null;
      if (ex) ex.value = String(p.defX);
      if (ey) ey.value = String(p.defY);
      const out = document.getElementById(`c-${p.key}-v`);
      if (out) out.textContent = `${fmt(p.defX)}, ${fmt(p.defY)}`;
      continue;
    }
    apply(p.key, p.def);
    const el = document.getElementById(`c-${p.key}`) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (!el) continue;
    if (p.kind === "toggle") (el as HTMLInputElement).checked = !!p.def;
    else el.value = String(p.def);
    const out = document.getElementById(`c-${p.key}-v`);
    if (out) out.textContent = fmt(p.def);
  }
});

document.getElementById("copy")?.addEventListener("click", async () => {
  const obj: Record<string, number | [number, number]> = {};
  for (const [k, v] of state) obj[k] = v;
  const btn = document.getElementById("copy");
  try {
    await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    flash(btn, "Copied");
  } catch {
    flash(btn, "Failed");
  }
});

function flash(btn: HTMLElement | null, msg: string): void {
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = msg;
  window.setTimeout(() => {
    btn.textContent = prev;
  }, 1100);
}

/* ---- Image source: load a file (or drop one on the plate) to dither ---- */

function setImageOn(on: boolean): void {
  apply("uImageOn", on ? 1 : 0);
  const t = document.getElementById("c-uImageOn") as HTMLInputElement | null;
  if (t) t.checked = on;
}

function loadImageFile(file: File | null | undefined): void {
  if (!file || !file.type.startsWith("image/")) return;
  const s = scene;
  if (!s) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    s.setImage(img);
    setImageOn(true);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

const fileInput = document.getElementById("imgfile") as HTMLInputElement | null;
document.getElementById("open")?.addEventListener("click", () => fileInput?.click());
fileInput?.addEventListener("change", () => loadImageFile(fileInput.files?.[0]));

// Apply a value AND sync its control widget (used by the Sample preset).
function syncControl(key: string, value: number): void {
  apply(key, value);
  const param = PARAMS.find((p) => p.key === key);
  const el = document.getElementById(`c-${key}`) as HTMLInputElement | HTMLSelectElement | null;
  if (el) {
    if (param?.kind === "toggle") (el as HTMLInputElement).checked = !!value;
    else el.value = String(value);
  }
  const out = document.getElementById(`c-${key}-v`);
  if (out && param?.kind === "range") out.textContent = fmt(value);
}

// Sample: cycle the bundled dither test images (src/samples/, auto-discovered)
// in the artefact palette, so the rig previews/tunes the look on real photos.
let sampleIdx = 0;
document.getElementById("sample")?.addEventListener("click", () => {
  const s = scene;
  if (!s) return;
  const sample = SAMPLES[sampleIdx % SAMPLES.length];
  sampleIdx += 1;
  syncControl("uColorway", 10); // Heather (the artefact palette)
  syncControl("uMotif", 1); // disc
  syncControl("uCell", 150);
  syncControl("uMotifWeight", 0.62);
  syncControl("uMotifTone", 0.5);
  syncControl("uCrossOn", 0);
  const img = new Image();
  img.onload = () => {
    s.setImage(img);
    syncControl("uImageOn", 1);
    flash(document.getElementById("sample"), sample.label);
  };
  img.src = sample.src;
});

// Fullscreen the plate (the dither fills the screen); re-measure on change.
document.getElementById("full")?.addEventListener("click", () => {
  const el = document.getElementById("plate");
  if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {});
  else void document.exitFullscreen?.();
});
document.addEventListener("fullscreenchange", () => {
  window.setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
});

const plate = document.getElementById("plate");
if (plate) {
  for (const ev of ["dragenter", "dragover"]) {
    plate.addEventListener(ev, (e) => {
      e.preventDefault();
      plate.classList.add("is-drop");
    });
  }
  plate.addEventListener("dragleave", () => plate.classList.remove("is-drop"));
  plate.addEventListener("drop", (e) => {
    e.preventDefault();
    plate.classList.remove("is-drop");
    loadImageFile((e as DragEvent).dataTransfer?.files?.[0]);
  });
}

if (import.meta.env.DEV) {
  Object.assign(window, { scene, state });
}
