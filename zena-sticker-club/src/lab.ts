/**
 * Foil Lab (/lab.html) — a dev-only tuning shelf. Renders one real card with
 * every reference foil parameter as a live slider, a foil-scope switch, and
 * animation replay, so the holo + animations can be dialled in by eye. NOT part
 * of the shipped toy. "Copy settings" dumps the current values for baking into
 * HOLO_DEFAULTS.
 */
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
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
import { RevealController, REVEAL_DEFAULTS } from '@/render/reveal';
import type { RevealParams, RevealStyle } from '@/render/reveal';
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

// Entrance / open-pack tuning (lab-only; production uses REVEAL_DEFAULTS).
const revealParams: RevealParams = { ...REVEAL_DEFAULTS };
let burstCount = 900;

// ---- Stage ----
const stage = el('div', 'lab-stage');
const host = el('div', 'lab-card-host');
const flash = el('div', 'lab-flash');
const caption = el('div', 'lab-caption');
caption.textContent = 'Move your cursor across the card';
stage.append(host, flash, caption);

const panel = el('aside', 'lab-panel');
labRoot.append(stage, panel);

// The control group (a collapsible <details>) that the helpers append into.
// section() opens a new group; controls before the first section go on the panel.
let currentGroup: HTMLElement = panel;

// Entrance controls that only apply to certain reveal styles. Shown/hidden when
// the master "Reveal style" changes (scopeLast tags the row just appended).
const styleScoped: { el: HTMLElement; styles: RevealStyle[] }[] = [];

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
    .play(face, { drama: RARITY[tier].drama, isNew, flash, isActive: () => true, params: revealParams })
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
    count: burstCount,
  });
}

// ---- Controls ----
/** Open a collapsible control group; subsequent controls append into its body.
 *  The <details> stays a plain block (it mis-lays-out its revealed content as a
 *  flex container); a real .lab-group-body div owns the flex column + gap. */
function section(text: string, open = false): void {
  const details = el('details', 'lab-group');
  details.open = open;
  const summary = el('summary', 'lab-section');
  summary.textContent = text;
  const body = el('div', 'lab-group-body');
  details.append(summary, body);
  panel.append(details);
  currentGroup = body;
}

function slider(key: keyof HoloParams, label: string, min: number, max: number, step: number, unit = '', desc = ''): void {
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
  row.append(lab);
  if (desc) row.append(descEl(desc));
  row.append(input);
  currentGroup.append(row);
}

/** Like slider() but bound to arbitrary numeric state via get/set closures. */
function sliderVal(
  label: string,
  min: number,
  max: number,
  step: number,
  get: () => number,
  set: (v: number) => void,
  unit = '',
  desc = '',
): void {
  const row = el('div', 'lab-row');
  const lab = el('label');
  const val = el('b');
  const input = el('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const cur = get();
  input.value = String(cur);
  val.textContent = `${cur}${unit}`;
  lab.append(document.createTextNode(label), val);
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    set(v);
    val.textContent = `${v}${unit}`;
  });
  row.append(lab);
  if (desc) row.append(descEl(desc));
  row.append(input);
  currentGroup.append(row);
}

function select(label: string, options: readonly string[], current: string, onChange: (v: string) => void, desc = ''): void {
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
  row.append(lab);
  if (desc) row.append(descEl(desc));
  row.append(sel);
  currentGroup.append(row);
}

function toggle(label: string, current: boolean, onChange: (v: boolean) => void, desc = ''): void {
  const wrap = el('div', 'lab-row');
  const row = el('label', 'lab-toggle');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = current;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(document.createTextNode(label), input);
  wrap.append(row);
  if (desc) wrap.append(descEl(desc));
  currentGroup.append(wrap);
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
  currentGroup.append(row);
}

/** Tag the control row just appended as applying only to certain reveal styles. */
function scopeLast(styles: RevealStyle[]): void {
  const last = currentGroup.lastElementChild as HTMLElement | null;
  if (last) styleScoped.push({ el: last, styles });
}

/** Show only the entrance controls relevant to the selected reveal style. */
function refreshStyleControls(): void {
  for (const entry of styleScoped) {
    entry.el.style.display = entry.styles.includes(revealParams.style) ? '' : 'none';
  }
}

// Auto-replay so entrance-effect edits preview themselves (the holo controls
// already apply live; the reveal params only show during a reveal).
let replayTimer = 0;
function autoReplay(): void {
  window.clearTimeout(replayTimer);
  replayTimer = window.setTimeout(replayReveal, 110);
}
/** Replay the reveal when the just-appended control is committed. Fires on
 *  'change' (slider release / select pick), NOT 'input', so dragging a slider
 *  replays once on release rather than on every tick. */
function replayOnEdit(): void {
  const input = currentGroup.lastElementChild?.querySelector('input, select');
  input?.addEventListener('change', autoReplay);
}

// Re-fire the particle burst (debounced) when its count is committed, so the
// new density previews itself the same way reveal edits do.
let burstTimer = 0;
function burstOnEdit(): void {
  const input = currentGroup.lastElementChild?.querySelector('input, select');
  input?.addEventListener('change', () => {
    window.clearTimeout(burstTimer);
    burstTimer = window.setTimeout(fireBurst, 110);
  });
}

/** A small muted description line rendered under a control's label. */
function descEl(text: string): HTMLElement {
  const d = el('div', 'lab-desc');
  d.textContent = text;
  return d;
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

// ---- Card ----
section('Card', true);
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
select(
  'Rarity (rim/particles)',
  RARITY_ORDER,
  tier,
  (v) => {
    tier = v as RarityTier;
    if (currentFace) applyRarityVars(currentFace.el, RARITY[tier]);
  },
  'tier driving the rim-glow colour, reveal drama, and burst',
);
replayOnEdit();
buttonRow(button('Replay reveal', replayReveal, true));
toggle('Show NEW badge', isNew, (v) => {
  isNew = v;
  if (currentFace) currentFace.el.dataset.new = String(isNew);
}, 'show the NEW! flag and its pop on the reveal');
toggle('Show back (inspect)', false, (v) => {
  if (!currentFace) return;
  if (v) {
    holo.detach();
    currentFace.el.style.setProperty('--ry', '180');
  } else {
    currentFace.el.style.setProperty('--ry', '0');
    holo.attach(currentFace.el);
  }
}, 'flip the card to inspect its ZENA FC back');

// ---- Foil & iridescence ----
section('Foil & iridescence');
select('Foil scope', ['spotlight', 'luminance', 'both'], HOLO_DEFAULTS.foilScope, (v) => {
  holo.setParams({ foilScope: v as FoilScope });
}, 'where the foil shows: cursor spotlight, image highlights, or both');
slider('iri', 'Foil intensity', 0, 1.6, 0.05, '', 'overall strength of the iridescent foil');
slider('iriScale', 'Band scale', 25, 160, 1, '%', 'width of the rainbow bands');
slider('hueRange', 'Hue range', 0, 360, 1, '°', 'how far the colour shifts across the foil');
slider('spot', 'Foil spread', 90, 520, 1, 'px', 'radius of the foil spotlight around the cursor');
slider('wash', 'Full-card wash', 0, 1.5, 0.05, '', 'faint foil tint over the whole card at rest');
select('Blend mode', HOLO_BLEND_OPTIONS, HOLO_DEFAULTS.holoBlend, (v) => holo.setParams({ holoBlend: v }), 'how the foil blends onto the card art');

// ---- Specular & edge ----
section('Specular & edge');
slider('specSize', 'Glow size', 80, 600, 1, 'px', 'radius of the white specular highlight — shows on hover');
slider('spec', 'Glow strength', 0, 1, 0.05, '', 'brightness of the specular highlight — shows on hover');
toggle('Hot glint', HOLO_DEFAULTS.hotspot, (v) => holo.setParams({ hotspot: v }), 'a tight hot spark at the highlight centre — shows on hover');
slider('glow', 'Edge glow', 0, 1.6, 0.05, '', 'glow along the card edges — shows on hover');
select('Glow colour', GLOW_COLOR_OPTIONS, HOLO_DEFAULTS.glowColor, (v) => holo.setParams({ glowColor: v }), 'tint of the edge / hover glow');
slider('noiseOp', 'Grain', 0, 0.6, 0.02, '', 'amount of film grain over the card');
slider('noiseScale', 'Grain scale', 20, 150, 1, '', 'size of the film-grain speckles');

// ---- Motion & depth (cursor parallax) ----
section('Motion & depth');
slider('tilt', 'Tilt', 0, 32, 1, '°', 'how far the card tilts toward the cursor');
slider('scaleHover', 'Hover scale', 1, 1.16, 0.01, '', 'how much the card grows on hover');
slider('depth', 'Parallax depth', 0, 100, 1, '', 'depth of the layered parallax on tilt');
slider('smoothing', 'Smoothing', 0.03, 0.4, 0.01, '', 'how quickly the tilt eases toward the cursor');

// ---- Entrance / open-pack (the reveal + burst variations) ----
section('Entrance / open-pack', true);
select(
  'Reveal style',
  ['rise', 'spin', 'flip', 'drop', 'zoom', 'deal'],
  revealParams.style,
  (v) => {
    revealParams.style = v as RevealStyle;
    refreshStyleControls();
  },
  'the entrance animation the card plays when revealed',
);
replayOnEdit();
buttonRow(button('Replay reveal', replayReveal, true));
sliderVal('Spins', 1, 5, 1, () => revealParams.spins, (v) => {
  revealParams.spins = v;
}, '', 'full turns before the card faces forward');
scopeLast(['spin', 'flip']);
replayOnEdit();
select('Spin axis', ['y', 'x'], revealParams.spinAxis, (v) => {
  revealParams.spinAxis = v as 'y' | 'x';
}, 'spin axis — Y is a turntable, X is a tumble');
scopeLast(['spin']);
replayOnEdit();
sliderVal('Spin duration', 0.4, 1.5, 0.05, () => revealParams.spinDuration, (v) => {
  revealParams.spinDuration = v;
}, 's', 'time for the spin to decelerate to forward-facing');
scopeLast(['spin', 'flip']);
replayOnEdit();
sliderVal('Rise duration', 0.2, 1.5, 0.02, () => revealParams.riseDuration, (v) => {
  revealParams.riseDuration = v;
}, 's', 'time for the card to rise and settle into place');
replayOnEdit();
sliderVal('Rise overshoot', 1, 3, 0.1, () => revealParams.riseOvershoot, (v) => {
  revealParams.riseOvershoot = v;
}, '', 'springiness of the settle (1 = none)');
scopeLast(['rise', 'spin', 'flip', 'drop', 'zoom']);
replayOnEdit();
sliderVal('Rise distance', 0, 200, 4, () => revealParams.riseDistance, (v) => {
  revealParams.riseDistance = v;
}, 'px', 'how far below its resting spot the card starts');
scopeLast(['rise', 'spin', 'flip', 'drop']);
replayOnEdit();
sliderVal('Light-sweep', 0.2, 1.5, 0.05, () => revealParams.sweepDuration, (v) => {
  revealParams.sweepDuration = v;
}, 's', 'how long the holographic glint takes to cross the card');
replayOnEdit();
sliderVal('Flash peak', 0, 1, 0.02, () => revealParams.flashPeak, (v) => {
  revealParams.flashPeak = v;
}, '', 'brightness of the white bloom masking the pack→card swap');
replayOnEdit();
sliderVal('Rim glow base', 0, 30, 1, () => revealParams.glowBase, (v) => {
  revealParams.glowBase = v;
}, '', 'baseline rim-glow flare on every reveal');
replayOnEdit();
sliderVal('Rim glow ×drama', 0, 60, 1, () => revealParams.glowDramaScale, (v) => {
  revealParams.glowDramaScale = v;
}, '', 'extra rim-glow flare added for rarer cards');
replayOnEdit();
sliderVal('Burst count', 0, 900, 10, () => burstCount, (v) => {
  burstCount = v;
}, '', 'number of particles in the celebratory burst');
burstOnEdit();
buttonRow(button('Burst', fireBurst));

// ---- Export ----
section('Export');
let exportFormat: 'json' | 'yaml' = 'json';
const exportArea = el('textarea', 'lab-export');
exportArea.readOnly = true;
exportArea.spellcheck = false;

function settingsObject(): Record<string, unknown> {
  return { reveal: { ...revealParams }, burstCount, holo: holo.getParams() };
}
function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = '  '.repeat(indent);
  const leaf = (v: unknown): string => (typeof v === 'string' ? JSON.stringify(v) : String(v));
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${pad}${k}:`, toYaml(v as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${pad}${k}: ${leaf(v)}`);
    }
  }
  return lines.join('\n');
}
function regenExport(): void {
  const o = settingsObject();
  exportArea.value = exportFormat === 'yaml' ? toYaml(o) : JSON.stringify(o, null, 2);
}

select('Format', ['json', 'yaml'], exportFormat, (v) => {
  exportFormat = v as 'json' | 'yaml';
  regenExport();
}, 'copy the dialled-in settings as JSON or YAML');
currentGroup.append(exportArea);
buttonRow(
  button('Refresh', regenExport),
  button(
    'Copy',
    () => {
      regenExport();
      void navigator.clipboard?.writeText(exportArea.value);
    },
    true,
  ),
  button('Reset to defaults', () => window.location.reload()),
);
regenExport();

refreshStyleControls();
refreshNation();
mountCard();
