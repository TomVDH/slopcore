/**
 * Iteration shelf: renders every hero shader candidate side by side,
 * live and mouse-reactive, grouped by stylistic family. Clicking a
 * tile opens the real hero with that shader (?shader=<id>).
 *
 * Rendering shares ONE WebGL context across all tiles (browsers evict
 * contexts past ~16, and the shelf is past that): a single offscreen
 * quad renders each variant's material at a fixed buffer size, then
 * blits into that tile's plain 2D canvas. Offscreen tiles are skipped
 * (IntersectionObserver), hidden tabs pause entirely, and reduced
 * motion (`?still`) renders one frame per tile and stops.
 */

import "./styles/main.css";
import "./styles/shelf.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource/limelight/400.css";
import "@fontsource/poiret-one/400.css";
import "@fontsource/permanent-marker/400.css";

import * as THREE from "three";
import { vertexShader } from "./gl/shaders";
import { DEFAULT_VARIANT_ID, VARIANTS } from "./gl/variants";
import type { ShaderVariant } from "./gl/variants";

const reduced =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("still");
const grid = document.getElementById("shelf-grid");

/* ---- The one shared GL pipeline ---- */

const BUF_W = 560;
const BUF_H = 350;

const glCanvas = document.createElement("canvas");
let renderer: THREE.WebGLRenderer | null = null;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(BUF_W, BUF_H, false);
} catch {
  renderer = null;
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
scene.add(quad);

interface Tile {
  variant: ShaderVariant;
  material: THREE.ShaderMaterial;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  hovered: boolean;
  mouseTarget: THREE.Vector2;
  strengthTarget: number;
  timeOffset: number;
}

const tiles: Tile[] = [];

function makeMaterial(frag: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: frag,
    uniforms: {
      uRes: { value: new THREE.Vector2(BUF_W, BUF_H) },
      uTime: { value: 20.0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uMouseStrength: { value: 0 },
      uEnergy: { value: 1 },
      uScrollVel: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
}

function buildTile(variant: ShaderVariant): Tile | null {
  if (!grid) return null;

  const card = document.createElement("a");
  card.className = "shelf-card";
  card.href = `/?shader=${variant.id}`;
  card.setAttribute("aria-label", `Try the ${variant.name} shader in the hero`);

  const canvas = document.createElement("canvas");
  canvas.width = BUF_W;
  canvas.height = BUF_H;
  card.appendChild(canvas);

  const meta = document.createElement("div");
  meta.className = "shelf-card-meta";

  const name = document.createElement("span");
  name.className = "shelf-card-name";
  name.textContent = variant.name;
  meta.appendChild(name);

  if (variant.id === DEFAULT_VARIANT_ID) {
    const badge = document.createElement("span");
    badge.className = "shelf-card-current";
    badge.textContent = "Current";
    meta.appendChild(badge);
  }

  const id = document.createElement("span");
  id.className = "shelf-card-id";
  id.textContent = variant.id;
  meta.appendChild(id);

  card.appendChild(meta);

  const blurb = document.createElement("p");
  blurb.className = "shelf-card-blurb";
  blurb.textContent = variant.blurb;
  card.appendChild(blurb);

  grid.appendChild(card);

  const ctx = canvas.getContext("2d");
  if (!renderer || !ctx) {
    canvas.replaceWith(
      Object.assign(document.createElement("div"), {
        className: "shelf-card-blurb",
        textContent: "WebGL unavailable in this browser.",
      }),
    );
    return null;
  }

  const tile: Tile = {
    variant,
    material: makeMaterial(variant.frag),
    canvas,
    ctx,
    visible: true,
    hovered: false,
    mouseTarget: new THREE.Vector2(0, 0),
    strengthTarget: 0,
    timeOffset: tiles.length * 7.3,
  };

  card.addEventListener("pointerenter", () => {
    tile.hovered = true;
  });
  card.addEventListener("pointerleave", () => {
    tile.hovered = false;
    tile.mouseTarget.set(0, 0);
  });
  card.addEventListener(
    "pointermove",
    (e) => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const my = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const aspectFix = r.width / Math.min(r.width, r.height);
      tile.mouseTarget.set(mx * aspectFix, my);
      tile.strengthTarget = Math.min(tile.strengthTarget + 0.12, 1.2);
    },
    { passive: true },
  );

  return tile;
}

function renderTile(tile: Tile, time: number): void {
  if (!renderer) return;
  const u = tile.material.uniforms;
  u.uTime.value = reduced ? 20.0 : time + tile.timeOffset;
  quad.material = tile.material;
  renderer.render(scene, camera);
  tile.ctx.drawImage(glCanvas, 0, 0, BUF_W, BUF_H);
}

/* ---- Build the grid, grouped by family ---- */

const families: string[] = [];
for (const v of VARIANTS) {
  if (!families.includes(v.family)) families.push(v.family);
}
for (const family of families) {
  if (grid) {
    const heading = document.createElement("h2");
    heading.className = "shelf-group-title";
    heading.textContent = family;
    grid.appendChild(heading);
  }
  for (const variant of VARIANTS.filter((v) => v.family === family)) {
    const tile = buildTile(variant);
    if (tile) tiles.push(tile);
  }
}

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const tile = tiles.find((t) => t.canvas === entry.target);
      if (tile) tile.visible = entry.isIntersecting;
    }
  },
  { rootMargin: "80px" },
);
tiles.forEach((t) => io.observe(t.canvas));

if (import.meta.env.DEV) {
  // Contact sheet for visual verification: renders every requested tile
  // through the shared context and composites one labeled canvas.
  Object.assign(window, {
    __shelfSnapshot(time = 20.0, only?: string[]): string {
      const picked = only?.length
        ? tiles.filter((t) => only.includes(t.variant.id))
        : tiles;
      const cols = Math.min(3, Math.max(picked.length, 1));
      const rows = Math.ceil(picked.length / cols);
      const tw = 420;
      const th = 280;
      const pad = 8;
      const label = 24;
      const sheet = document.createElement("canvas");
      sheet.width = cols * (tw + pad) + pad;
      sheet.height = rows * (th + label + pad) + pad;
      const ctx = sheet.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = "#0b0b0d";
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      picked.forEach((tile, i) => {
        renderTile(tile, time);
        const x = pad + (i % cols) * (tw + pad);
        const y = pad + Math.floor(i / cols) * (th + label + pad);
        ctx.drawImage(tile.canvas, x, y, tw, th);
        ctx.fillStyle = "#f2f2ee";
        ctx.font = "13px monospace";
        ctx.fillText(tile.variant.id, x + 2, y + th + 16);
      });
      return sheet.toDataURL("image/jpeg", 0.85);
    },
  });
}

/* ---- First frames + the loop ---- */

// Every tile gets a synchronous first frame (hidden tabs included).
tiles.forEach((t) => renderTile(t, performance.now() / 1000));

if (!reduced) {
  let last = performance.now();
  function loop(now: number): void {
    requestAnimationFrame(loop);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(now - last, 100);
    last = now;
    const k = 1 - Math.exp(-dt * 0.006);
    for (const tile of tiles) {
      if (!tile.visible) continue;
      const u = tile.material.uniforms;
      (u.uMouse.value as THREE.Vector2).lerp(tile.mouseTarget, k);
      tile.strengthTarget *= Math.exp(-dt * 0.0022);
      u.uMouseStrength.value += (tile.strengthTarget - u.uMouseStrength.value) * k;
      u.uEnergy.value += ((tile.hovered ? 1.12 : 1.0) - u.uEnergy.value) * k;
      renderTile(tile, now / 1000);
    }
  }
  requestAnimationFrame(loop);
}
