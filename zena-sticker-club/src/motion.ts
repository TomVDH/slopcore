/**
 * Pack Motion Lab (/motion.html) — a dev-only rig for dialling the foil-pack
 * motion: the WebGL shimmer (sweep, sparkle, tint), the idle float, the rip
 * tear, and the burst. NOT part of the shipped toy. "Copy settings" dumps the
 * shimmer values for baking into SHIMMER_DEFAULTS.
 */
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/space-mono/400.css';

import { gsap } from 'gsap';

import '@/styles/tokens.css';
import '@/styles/holo.css';
import '@/styles/packs.css';
import '@/styles/motion.css';

import { MotionPrefs } from '@/ui/motionPrefs';
import { PackView } from '@/ui/pack';
import { el } from '@/render/face/CardFace';
import { glReady } from '@/webgl/glReady';
import { FoilScene, SHIMMER_DEFAULTS } from '@/webgl/FoilScene';
import type { ShimmerParams } from '@/webgl/FoilScene';

const root = document.getElementById('motion')!;
const fxLayer = document.getElementById('fx-layer')!;
const motion = new MotionPrefs();
const foil: FoilScene | null = glReady() && !motion.reduced ? new FoilScene(fxLayer) : null;
if (foil) document.body.classList.add('gl-on');

const PACK_STYLES = [
  'memphis', 'prism', 'gold', 'tournament', 'flux', 'sash', 'split', 'seal', 'mono', 'riso',
  'neon', 'comic', 'chrome', 'vapor', 'candy', 'acid', 'baroque', 'optical', 'lava', 'holo',
  'gallery', 'classic', 'kraft', 'pitch',
];

const shimmer: ShimmerParams = { ...SHIMMER_DEFAULTS };
let floatAmp = 7;
let floatRot = 1.4;
let floatDur = 2.8;
let energy = 0.6;
let packStyle = 'memphis';

// ---- Stage ----
const stage = el('div', 'motion-stage');
const host = el('div', 'motion-pack-host');
stage.append(host);
const panel = el('aside', 'motion-panel');
root.append(stage, panel);

// ---- Pack ----
const pack = new PackView(
  {
    onArm: () => {},
    onProgress: (p) => foil?.setTear(p),
    onComplete: () => {
      window.setTimeout(() => {
        foil?.setTear(0);
        pack.enable();
        if (foil) foil.attachPack(pack.el, '#c9d2de', '#8a93a1');
        runFloat();
      }, 600);
    },
    onHover: (e) => foil?.setEnergy(e ? 1 : energy),
  },
  motion,
);
pack.el.dataset.pack = packStyle;
pack.el.style.zIndex = '1';
host.append(pack.el);

let floatTl: gsap.core.Timeline | null = null;
function runFloat(): void {
  if (floatTl) floatTl.kill();
  gsap.killTweensOf(pack.el);
  gsap.set(pack.el, { '--pack-float': 0, '--pack-rot': 0 });
  if (motion.reduced) return;
  floatTl = gsap.timeline({ repeat: -1, yoyo: true });
  floatTl.to(pack.el, { '--pack-float': -floatAmp, duration: floatDur, ease: 'sine.inOut' }, 0);
  floatTl.to(pack.el, { '--pack-rot': floatRot, duration: floatDur * 1.28, ease: 'sine.inOut' }, 0);
}

function replayRip(): void {
  gsap.killTweensOf(pack.el);
  gsap.set(pack.el, { '--pack-ty': 0, '--pack-s': 1, '--pack-rot': 0, '--pack-float': 0 });
  foil?.setTear(0);
  pack.enable();
  if (foil) foil.attachPack(pack.el, '#c9d2de', '#8a93a1');
  runFloat();
  requestAnimationFrame(() => pack.rip());
}

function fireBurst(): void {
  if (!foil) return;
  const r = host.getBoundingClientRect();
  foil.burst({
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    colorA: '#ffffff',
    colorB: '#ffd34d',
    count: 900,
  });
}

pack.enable();
runFloat();
if (foil) {
  foil.attachPack(pack.el, '#c9d2de', '#8a93a1');
  foil.setEnergy(energy);
}

// ---- Controls ----
const syncers: Array<() => void> = [];

function sec(title: string): void {
  const d = el('div', 'm-sec');
  d.textContent = title;
  panel.append(d);
}

function slider(
  label: string,
  min: number,
  max: number,
  step: number,
  get: () => number,
  set: (v: number) => void,
  unit = '',
): void {
  const row = el('div', 'm-row');
  const lab = el('label');
  const name = el('span');
  name.textContent = label;
  name.style.color = 'var(--ink)';
  const val = el('span');
  lab.append(name, val);
  const inp = el('input');
  inp.type = 'range';
  inp.min = String(min);
  inp.max = String(max);
  inp.step = String(step);
  const fmt = (): void => {
    val.textContent = (step < 1 ? get().toFixed(2) : get().toFixed(0)) + unit;
  };
  const sync = (): void => {
    inp.value = String(get());
    fmt();
  };
  inp.addEventListener('input', () => {
    set(parseFloat(inp.value));
    fmt();
  });
  sync();
  row.append(lab, inp);
  panel.append(row);
  syncers.push(sync);
}

// header
const h1 = el('h1');
h1.textContent = 'Pack Motion Lab';
const sub = el('p', 'sub');
sub.textContent = 'Foil shimmer · float · rip · burst — dev only';
panel.append(h1, sub);

// pack picker
sec('Pack skin');
const sel = el('select', 'm-select');
for (const s of PACK_STYLES) {
  const o = document.createElement('option');
  o.value = s;
  o.textContent = s;
  if (s === packStyle) o.selected = true;
  sel.append(o);
}
sel.addEventListener('change', () => {
  packStyle = sel.value;
  pack.el.dataset.pack = packStyle;
});
panel.append(sel);

// shimmer — sweep
sec('Shimmer · sweep');
slider('Speed', 0, 2, 0.05, () => shimmer.sweepSpeed, (v) => { shimmer.sweepSpeed = v; foil?.setShimmer({ sweepSpeed: v }); });
slider('Frequency', 2, 20, 0.5, () => shimmer.sweepFreq, (v) => { shimmer.sweepFreq = v; foil?.setShimmer({ sweepFreq: v }); });
slider('Sharpness', 1, 6, 0.1, () => shimmer.sweepSharp, (v) => { shimmer.sweepSharp = v; foil?.setShimmer({ sweepSharp: v }); });
slider('Highlight gain', 0, 2.5, 0.05, () => shimmer.sweepGain, (v) => { shimmer.sweepGain = v; foil?.setShimmer({ sweepGain: v }); });
slider('Cross band', 0, 1.5, 0.05, () => shimmer.band2, (v) => { shimmer.band2 = v; foil?.setShimmer({ band2: v }); });

// shimmer — surface
sec('Shimmer · surface');
slider('Base brightness', 0, 1, 0.02, () => shimmer.baseBright, (v) => { shimmer.baseBright = v; foil?.setShimmer({ baseBright: v }); });
slider('Sparkle', 0, 3, 0.05, () => shimmer.spark, (v) => { shimmer.spark = v; foil?.setShimmer({ spark: v }); });
slider('Sparkle speed', 0, 16, 0.5, () => shimmer.sparkleSpeed, (v) => { shimmer.sparkleSpeed = v; foil?.setShimmer({ sparkleSpeed: v }); });
slider('Thin-film tint', 0, 1, 0.02, () => shimmer.tint, (v) => { shimmer.tint = v; foil?.setShimmer({ tint: v }); });
slider('Brushed grain', 0, 1, 0.02, () => shimmer.grain, (v) => { shimmer.grain = v; foil?.setShimmer({ grain: v }); });
slider('Energy (hover)', 0, 1.5, 0.05, () => energy, (v) => { energy = v; foil?.setEnergy(v); });

// idle float
sec('Pack float');
slider('Amplitude', 0, 24, 1, () => floatAmp, (v) => { floatAmp = v; runFloat(); }, 'px');
slider('Rotation', 0, 6, 0.2, () => floatRot, (v) => { floatRot = v; runFloat(); }, '°');
slider('Period', 1, 6, 0.1, () => floatDur, (v) => { floatDur = v; runFloat(); }, 's');

// actions
sec('Play');
const btns = el('div', 'm-btns');
const ripBtn = el('button', 'm-btn m-btn--primary');
ripBtn.type = 'button';
ripBtn.textContent = 'Replay rip';
ripBtn.addEventListener('click', replayRip);
const burstBtn = el('button', 'm-btn');
burstBtn.type = 'button';
burstBtn.textContent = 'Burst';
burstBtn.addEventListener('click', fireBurst);
const resetBtn = el('button', 'm-btn');
resetBtn.type = 'button';
resetBtn.textContent = 'Reset';
resetBtn.addEventListener('click', () => {
  Object.assign(shimmer, SHIMMER_DEFAULTS);
  floatAmp = 7;
  floatRot = 1.4;
  floatDur = 2.8;
  energy = 0.6;
  foil?.setShimmer(shimmer);
  foil?.setEnergy(energy);
  runFloat();
  syncers.forEach((s) => s());
});
btns.append(ripBtn, burstBtn, resetBtn);
panel.append(btns);

// export
sec('Export');
const ta = el('textarea', 'm-export');
ta.readOnly = true;
const copyBtn = el('button', 'm-btn');
copyBtn.type = 'button';
copyBtn.textContent = 'Dump shimmer settings';
copyBtn.addEventListener('click', () => {
  ta.value = JSON.stringify({ shimmer, float: { floatAmp, floatRot, floatDur }, energy }, null, 2);
});
panel.append(copyBtn, ta);
