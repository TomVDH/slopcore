/**
 * Foil Lab (/lab.html) — a dev-only tuning shelf. Renders one real card with
 * every reference foil parameter as a live slider, a foil-scope switch, and
 * animation replay, so the holo + animations can be dialled in by eye. NOT part
 * of the shipped toy. "Copy settings" dumps the current values for baking into
 * HOLO_DEFAULTS.
 */
import '@fontsource/anton';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/space-mono/400.css';

import '@/styles/tokens.css';
import '@/styles/holo.css';
import '@/styles/lab.css';

import type { CountryCode, RarityTier } from '@/domain/types';
import { allNations, getNation } from '@/domain/nations';
import { getImages } from '@/assets/images';
import { makeCard } from '@/domain/card';
import { RARITY, RARITY_ORDER } from '@/domain/rarity';
import { MotionPrefs } from '@/ui/motionPrefs';
import { HoloController } from '@/render/holo';
import { RevealController } from '@/render/reveal';
import { createFace } from '@/render/face/faceFactory';
import type { CardFace } from '@/render/face/CardFace';
import { applyRarityVars, el } from '@/render/face/CardFace';
import {
  HOLO_BLEND_OPTIONS,
  GLOW_COLOR_OPTIONS,
  HOLO_DEFAULTS,
} from '@/render/holoConfig';
import type { FoilScope, HoloParams } from '@/render/holoConfig';
import { glReady } from '@/webgl/glReady';
import { FoilScene } from '@/webgl/FoilScene';

const labRoot = document.getElementById('lab')!;
const fxLayer = document.getElementById('fx-layer')!;

const motion = new MotionPrefs();
const holo = new HoloController(motion, { ...HOLO_DEFAULTS });
const reveal = new RevealController(motion);
const foil: FoilScene | null = glReady() && !motion.reduced ? new FoilScene(fxLayer) : null;
if (foil) document.body.classList.add('gl-on');

const nations = [...allNations()];
let nationIndex = Math.max(0, nations.findIndex((n) => n.code === 'ARG'));
let tier: RarityTier = 'final';
let isNew = true;
let currentFace: CardFace | null = null;

// ---- Stage ----
const stage = el('div', 'lab-stage');
const host = el('div', 'lab-card-host');
const flash = el('div', 'lab-flash');
const caption = el('div', 'lab-caption');
caption.textContent = 'Move your cursor across the card';
stage.append(host, flash, caption);

const panel = el('aside', 'lab-panel');
labRoot.append(stage, panel);

function code(): CountryCode {
  return nations[nationIndex]!.code;
}

function mountCard(): void {
  holo.detach();
  if (currentFace) currentFace.destroy();
  host.replaceChildren();
  const card = makeCard(getNation(code()), getImages(code()));
  const face = createFace('image');
  currentFace = face;
  face.el.dataset.new = String(isNew);
  void face.mount(card, host).then(() => {
    applyRarityVars(face.el, RARITY[tier]);
    holo.attach(face.el);
  });
}

function replayReveal(): void {
  if (!currentFace) return;
  const face = currentFace;
  face.el.dataset.new = String(isNew);
  holo.detach();
  void reveal
    .play(face, { drama: RARITY[tier].drama, isNew, flash, isActive: () => true })
    .then(() => holo.attach(face.el));
}

function fireBurst(): void {
  if (!foil) return;
  const r = host.getBoundingClientRect();
  foil.burst({
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    colorA: RARITY[tier].sheen,
    colorB: RARITY[tier].foil,
    count: window.innerWidth < 700 ? 300 : 700,
  });
}

// ---- Controls ----
function section(text: string): void {
  const s = el('div', 'lab-section');
  s.textContent = text;
  panel.append(s);
}

function slider(key: keyof HoloParams, label: string, min: number, max: number, step: number, unit = ''): void {
  const row = el('div', 'lab-row');
  const lab = el('label');
  const val = el('b');
  const input = el('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const cur = holo.getParams()[key] as number;
  input.value = String(cur);
  val.textContent = `${cur}${unit}`;
  lab.append(document.createTextNode(label), val);
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    holo.setParams({ [key]: v } as Partial<HoloParams>);
    val.textContent = `${v}${unit}`;
  });
  row.append(lab, input);
  panel.append(row);
}

function select(label: string, options: readonly string[], current: string, onChange: (v: string) => void): void {
  const row = el('div', 'lab-row');
  const lab = el('label');
  lab.textContent = label;
  const sel = el('select', 'lab-select');
  for (const o of options) {
    const opt = el('option');
    opt.value = o;
    opt.textContent = o;
    if (o === current) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  row.append(lab, sel);
  panel.append(row);
}

function toggle(label: string, current: boolean, onChange: (v: boolean) => void): void {
  const row = el('label', 'lab-toggle');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = current;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(document.createTextNode(label), input);
  panel.append(row);
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el('button', primary ? 'lab-btn lab-btn--primary' : 'lab-btn');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function buttonRow(...buttons: HTMLButtonElement[]): void {
  const row = el('div', 'lab-btns');
  row.append(...buttons);
  panel.append(row);
}

const title = el('div', 'lab-title');
title.textContent = 'Foil Lab';
panel.append(title);

const nationName = el('div', 'lab-row');
const nationLabel = el('label');
const nationVal = el('b');
nationLabel.append(document.createTextNode('Card'), nationVal);
nationName.append(nationLabel);
panel.append(nationName);
function refreshNation(): void {
  nationVal.textContent = `${getNation(code()).country}`;
}

buttonRow(
  button('‹ Prev', () => {
    nationIndex = (nationIndex - 1 + nations.length) % nations.length;
    refreshNation();
    mountCard();
  }),
  button('Next ›', () => {
    nationIndex = (nationIndex + 1) % nations.length;
    refreshNation();
    mountCard();
  }),
);

select('Rarity (rim/particles)', RARITY_ORDER, tier, (v) => {
  tier = v as RarityTier;
  if (currentFace) applyRarityVars(currentFace.el, RARITY[tier]);
});
select('Foil scope', ['spotlight', 'luminance', 'both'], HOLO_DEFAULTS.foilScope, (v) => {
  holo.setParams({ foilScope: v as FoilScope });
});
toggle('Show NEW badge', isNew, (v) => {
  isNew = v;
  if (currentFace) currentFace.el.dataset.new = String(isNew);
});

section('Motion & depth');
slider('tilt', 'Tilt', 0, 32, 1, '°');
slider('scaleHover', 'Hover scale', 1, 1.16, 0.01);
slider('depth', 'Parallax depth', 0, 100, 1);
slider('smoothing', 'Smoothing', 0.03, 0.4, 0.01);

section('Iridescence');
slider('iri', 'Foil intensity', 0, 1.6, 0.05);
slider('iriScale', 'Band scale', 25, 160, 1, '%');
slider('hueRange', 'Hue range', 0, 360, 1, '°');
slider('spot', 'Foil spread', 90, 520, 1, 'px');
slider('wash', 'Full-card wash', 0, 1.5, 0.05);
select('Blend mode', HOLO_BLEND_OPTIONS, HOLO_DEFAULTS.holoBlend, (v) => holo.setParams({ holoBlend: v }));

section('Specular');
slider('specSize', 'Glow size', 80, 600, 1, 'px');
slider('spec', 'Glow strength', 0, 1, 0.05);
toggle('Hot glint', HOLO_DEFAULTS.hotspot, (v) => holo.setParams({ hotspot: v }));

section('Edge & surface');
slider('glow', 'Edge glow', 0, 1.6, 0.05);
select('Glow colour', GLOW_COLOR_OPTIONS, HOLO_DEFAULTS.glowColor, (v) => holo.setParams({ glowColor: v }));
slider('noiseOp', 'Grain', 0, 0.6, 0.02);
slider('noiseScale', 'Grain scale', 20, 150, 1);

section('Animation');
buttonRow(button('Replay reveal', replayReveal, true), button('Burst', fireBurst));

section('Export');
buttonRow(
  button('Copy settings', () => {
    const out = JSON.stringify(holo.getParams(), null, 2);
    void navigator.clipboard?.writeText(out);
    console.info('[lab] current holo params:\n' + out);
  }),
  button('Reset to defaults', () => window.location.reload()),
);

refreshNation();
mountCard();
