/**
 * Pack & Back Shelf (/shelf.html) — a dev-only design gallery for flipping
 * through unopened-pack designs and card-back designs side by side. NOT part of
 * the shipped toy; it just mounts a real pack and a real card (flipped to its
 * back) and swaps their `data-pack` / `data-back` variant attributes.
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
import '@/styles/backs.css';
import '@/styles/shelf.css';

import { getNation } from '@/domain/nations';
import { getImages } from '@/assets/images';
import { makeCard } from '@/domain/card';
import { RARITY } from '@/domain/rarity';
import { MotionPrefs } from '@/ui/motionPrefs';
import { PackView } from '@/ui/pack';
import { createFace } from '@/render/face/faceFactory';
import type { CardFace } from '@/render/face/CardFace';
import { applyRarityVars, el } from '@/render/face/CardFace';

const root = document.getElementById('shelf')!;
const motion = new MotionPrefs();

const PACK_STYLES = ['gallery', 'classic', 'holo', 'kraft', 'riso', 'neon', 'comic', 'chrome', 'vapor', 'candy'];
const BACK_STYLES = ['default', 'neon', 'comic', 'chrome', 'holo', 'vapor'];

function select(styles: string[], current: string, onChange: (v: string) => void): HTMLSelectElement {
  const s = el('select', 'shelf-select');
  for (const v of styles) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    if (v === current) o.selected = true;
    s.append(o);
  }
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

// ---- Header ----
const header = el('header', 'shelf-header');
const h1 = el('h1');
h1.textContent = 'Pack & Back Shelf';
const sub = el('p');
sub.textContent = 'Unopened-pack + card-back designs · dev-only';
header.append(h1, sub);

// ---- Pack bay ----
const packBay = el('div', 'shelf-bay');
const packStage = el('div', 'shelf-stage');
const pack = new PackView(
  { onArm: () => {}, onProgress: () => {}, onComplete: () => {}, onHover: () => {} },
  motion,
);
pack.el.dataset.pack = 'riso';
packStage.append(pack.el);
const packLabel = el('div', 'shelf-label');
packLabel.textContent = 'Unopened pack';
const packControls = el('div', 'shelf-controls');
const packSelect = select(PACK_STYLES, 'riso', (v) => {
  pack.el.dataset.pack = v;
});
const ripBtn = el('button', 'shelf-btn');
ripBtn.textContent = 'Rip';
ripBtn.addEventListener('click', () => {
  gsap.set(pack.el, { '--pack-ty': 0, '--pack-s': 1, '--pack-rot': 0 });
  pack.enable();
  pack.rip();
});
packControls.append(packSelect, ripBtn);
packBay.append(packStage, packLabel, packControls);

// ---- Back bay ----
const backBay = el('div', 'shelf-bay');
const backStage = el('div', 'shelf-stage');
const backLabel = el('div', 'shelf-label');
backLabel.textContent = 'Card back';
let face: CardFace | null = null;
let backEl: HTMLElement | null = null;
let flipped = true;

const card = makeCard(getNation('ARG'), getImages('ARG'));
face = createFace('image');
// mount() builds + appends the rotator (incl. the back) synchronously before it
// awaits the hero decode, so the back is queryable immediately — don't gate the
// flip on decode (which can lag in headless).
void face.mount(card, backStage);
applyRarityVars(face.el, RARITY.final);
backEl = face.el.querySelector<HTMLElement>('.card__back');
if (backEl) backEl.dataset.back = 'neon';
gsap.set(face.el, { '--ry': 180 }); // show the back at rest
const backControls = el('div', 'shelf-controls');
const backSelect = select(BACK_STYLES, 'neon', (v) => {
  if (backEl) backEl.dataset.back = v === 'default' ? '' : v;
});
const flipBtn = el('button', 'shelf-btn');
flipBtn.textContent = 'Flip';
flipBtn.addEventListener('click', () => {
  flipped = !flipped;
  if (face) gsap.to(face.el, { '--ry': flipped ? 180 : 0, duration: 0.7, ease: 'power3.out' });
});
backControls.append(backSelect, flipBtn);
backBay.append(backStage, backLabel, backControls);

// ---- Assemble ----
const bays = el('div', 'shelf-bays');
bays.append(packBay, backBay);
root.append(header, bays);

pack.enable();
