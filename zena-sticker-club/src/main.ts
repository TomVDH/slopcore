import { gsap } from 'gsap';

import '@fontsource/anton';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';

import '@/styles/tokens.css';
import '@/styles/layout.css';
import '@/styles/holo.css';
import '@/styles/components.css';

import { AppMachine } from '@/app/machine';
import { CollectionState } from '@/collection/collection';
import { buildPullTable, classify, drawCode, tierOddsLabel } from '@/collection/pull';
import { createRng } from '@/assets/rng';
import { getImages, hasImages } from '@/assets/images';
import { Preloader } from '@/assets/preloader';
import { allNations, getNation, invariants } from '@/domain/nations';
import { makeCard } from '@/domain/card';
import { TOTAL_NATIONS } from '@/domain/types';
import type { Card, CountryCode } from '@/domain/types';

import { MotionPrefs } from '@/ui/motionPrefs';
import { PackView } from '@/ui/pack';
import { Announcer } from '@/ui/a11y';
import { createFace } from '@/render/face/faceFactory';
import type { CardFace } from '@/render/face/CardFace';
import { el } from '@/render/face/CardFace';
import { HoloController } from '@/render/holo';
import { RevealController } from '@/render/reveal';
import { PanelView } from '@/render/panel';
import { BinderView } from '@/render/binder';
import { HeaderView } from '@/render/header';
import { glReady } from '@/webgl/glReady';
import { FoilScene } from '@/webgl/FoilScene';

// --------------------------------------------------------------------------
// Wiring
// --------------------------------------------------------------------------
const app = document.getElementById('app')!;
const headerEl = document.getElementById('app-header')!;
const stageEl = document.getElementById('stage')!;
const panelEl = document.getElementById('panel')!;
const binderEl = document.getElementById('binder')!;
const liveEl = document.getElementById('live')!;
const fxLayer = document.getElementById('fx-layer')!;

const seed = new URLSearchParams(window.location.search).get('seed') ?? undefined;

const motion = new MotionPrefs();
const collection = new CollectionState();
const rng = createRng(seed);
const pullTable = buildPullTable(allNations());
const preloader = new Preloader();
const announcer = new Announcer(liveEl);
const machine = new AppMachine();

const useGl = glReady() && !motion.reduced;
const foil: FoilScene | null = useGl ? new FoilScene(fxLayer) : null;
if (foil) document.body.classList.add('gl-on');

if (import.meta.env.DEV) invariants(hasImages);

// ---- Stage DOM ----
const plinth = el('div', 'stage__plinth');
const cardHost = el('div', 'card-host');
const flash = el('div', 'stage__flash');

const pack = new PackView(
  {
    onArm: () => {
      if (machine.state === 'idle') machine.send({ type: 'RIP_START' });
    },
    onProgress: (p) => foil?.setTear(p),
    onComplete: () => {
      if (machine.state === 'ripping') machine.send({ type: 'RIP_COMPLETE' });
    },
    onHover: (energy) => foil?.setEnergy(energy),
  },
  motion,
);
plinth.append(pack.el, cardHost, flash);

const cta = el('div', 'stage__cta');
const btnRip = el('button', 'btn btn--primary');
btnRip.type = 'button';
btnRip.textContent = 'Rip Open Pack';
btnRip.addEventListener('click', () => pack.rip());
const btnReroll = el('button', 'btn btn--ghost');
btnReroll.type = 'button';
btnReroll.textContent = 'Rip Another';
btnReroll.hidden = true;
btnReroll.addEventListener('click', () => machine.send({ type: 'REROLL' }));
cta.append(btnRip, btnReroll);

const skip = el('button', 'stage__skip');
skip.type = 'button';
skip.textContent = 'Skip animation';
skip.addEventListener('click', () => reveal.finish());

stageEl.append(plinth, cta, skip);

// ---- Toast layer ----
const toastLayer = el('div');
toastLayer.id = 'toast-layer';
document.body.append(toastLayer);

// ---- Views ----
const header = new HeaderView(headerEl, () => binder.toggle());
const panel = new PanelView(panelEl);
const holo = new HoloController(motion);
const reveal = new RevealController(motion);
const binder = new BinderView(binderEl, collection, motion, (code) => reviewCard(code));

let currentFace: CardFace | null = null;
let firstLoad = true;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function particleCount(drama: number): number {
  const base = Math.round(150 + drama * 650);
  return window.innerWidth < 700 ? Math.round(base * 0.5) : base;
}

function clearCard(): void {
  holo.detach();
  if (currentFace) {
    currentFace.destroy();
    currentFace = null;
  }
  cardHost.replaceChildren();
}

function resetPack(animate: boolean): void {
  pack.enable();
  // Keep the pack fully opaque always (so it can never be stuck invisible if the
  // ticker stalls); the drop-in animates only the slide, not opacity.
  gsap.set(pack.el, { opacity: 1, '--pack-ty': 0, '--pack-s': 1, '--pack-rot': 0 });
  const attach = (): void => foil?.attachPack(pack.el, '#c9d2de', '#8a93a1');
  if (animate && !motion.reduced) {
    gsap.fromTo(
      pack.el,
      { '--pack-ty': -60 },
      { '--pack-ty': 0, duration: 0.42, ease: 'back.out(1.6)', onComplete: attach },
    );
  } else {
    attach();
  }
}

function showToast(text: string, isNew: boolean): void {
  const toast = el('div', isNew ? 'toast toast--new' : 'toast');
  toast.textContent = text;
  toastLayer.append(toast);
  if (motion.reduced) {
    window.setTimeout(() => toast.remove(), 1800);
    return;
  }
  gsap.fromTo(toast, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)' });
  gsap.to(toast, {
    opacity: 0,
    y: -8,
    duration: 0.3,
    delay: 1.7,
    ease: 'power2.in',
    onComplete: () => toast.remove(),
  });
}

interface RevealInfo {
  count: number;
  isNew: boolean;
}

function finalize(card: Card, info: RevealInfo, token: number, review: boolean): void {
  if (token !== machine.token) return;
  // Only measure the hero rect when the binder fly will actually use it.
  const heroRect = !review && !motion.reduced ? currentFace?.el.getBoundingClientRect() : undefined;
  if (currentFace) holo.attach(currentFace.el);

  const order = collection.acquisitionOrder();
  const squadNo = Math.max(1, order.indexOf(card.code) + 1);
  panel.render(card, {
    count: info.count,
    oddsLabel: tierOddsLabel(pullTable, card.def.rarity),
    owned: collection.uniqueOwned(),
    total: TOTAL_NATIONS,
    squadNo,
  });
  panel.open();
  app.dataset.panel = 'open';
  panel.playIn(motion.reduced);

  if (!review) {
    binder.fileCard(card.code, info.isNew, info.count, heroRect);
    header.setProgress(collection.uniqueOwned(), TOTAL_NATIONS);
    const label = card.rarity.label;
    if (info.isNew) {
      announcer.say(`New sticker: ${card.def.country}, ${label}. First copy.`);
      showToast(`NEW · ${card.def.country}`, true);
    } else {
      announcer.say(`Duplicate: ${card.def.country}, ${label}. You now have ${info.count} copies.`);
      showToast(`Got it already · copy ${info.count}`, false);
    }
  } else {
    announcer.say(`Viewing ${card.def.country}, ${card.rarity.label}.`);
  }

  btnRip.hidden = true;
  btnReroll.hidden = false;
  skip.classList.remove('is-shown');
}

async function reviewCard(code: CountryCode): Promise<void> {
  if (machine.state === 'ripping' || machine.state === 'revealing') return;
  const token = machine.beginReview();
  pack.disable();
  gsap.set(pack.el, { opacity: 0 });
  foil?.hidePack();
  clearCard();

  const card = makeCard(getNation(code), getImages(code));
  const face = createFace('image');
  currentFace = face;
  await face.mount(card, cardHost);
  if (token !== machine.token) {
    face.destroy();
    return;
  }
  await reveal.play(face, {
    drama: card.rarity.drama,
    isNew: false,
    flash,
    isActive: () => token === machine.token,
  });
  finalize(card, { count: collection.count(code), isNew: false }, token, true);
}

// --------------------------------------------------------------------------
// State machine hooks
// --------------------------------------------------------------------------
machine.onEnter.idle = (_ctx, prev) => {
  reveal.kill(); // cancel any reveal interrupted by a re-roll (clears flash + resolves)
  panel.close();
  app.dataset.panel = 'closed';
  binder.clearNew();

  const existing = cardHost.firstElementChild as HTMLElement | null;
  if (existing && prev !== 'idle' && !motion.reduced) {
    holo.detach();
    gsap.to(existing, {
      opacity: 0,
      scale: 0.9,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => clearCard(),
    });
  } else {
    clearCard();
  }

  resetPack(prev !== 'idle' || firstLoad);
  firstLoad = false;

  btnRip.hidden = false;
  btnReroll.hidden = true;
  skip.classList.remove('is-shown');
};

machine.onEnter.ripping = (ctx) => {
  const code = drawCode(pullTable, rng);
  const def = getNation(code);
  const status = classify(collection.count(code));
  const { isNew, count } = collection.record(code);
  const card = makeCard(def, getImages(code));
  ctx.card = card;
  ctx.status = status;
  ctx.isNew = isNew;
  ctx.count = count;
  void preloader.decodeHero(card);
};

machine.onEnter.revealing = (ctx) => {
  void runReveal(ctx.card, ctx.isNew, ctx.count, ctx.token);
};

async function runReveal(
  card: Card | null,
  isNew: boolean,
  count: number,
  token: number,
): Promise<void> {
  if (!card) return;
  skip.classList.add('is-shown');

  const rect = plinth.getBoundingClientRect();
  if (foil) {
    foil.hidePack();
    foil.burst({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      colorA: card.rarity.sheen,
      colorB: card.rarity.foil,
      count: particleCount(card.rarity.drama),
    });
  }
  if (!motion.reduced) {
    gsap.to(pack.el, { opacity: 0, '--pack-s': 1.12, duration: 0.3, ease: 'power2.in' });
  } else {
    gsap.set(pack.el, { opacity: 0 });
  }

  const face = createFace('image');
  currentFace = face;
  await face.mount(card, cardHost);
  if (token !== machine.token) {
    face.destroy();
    return;
  }
  await reveal.play(face, {
    drama: card.rarity.drama,
    isNew,
    flash,
    isActive: () => token === machine.token,
  });
  if (token !== machine.token) return;
  finalize(card, { count, isNew }, token, false);
  machine.send({ type: 'REVEAL_DONE' });
}

// Prefetch a couple of likely-next commons during the resting showcase.
machine.onEnter.showcase = () => {
  const commons = allNations()
    .filter((n) => n.rarity === 'group')
    .slice(0, 2)
    .map((n) => makeCard(n, getImages(n.code)));
  preloader.prefetch(commons);
};

// --------------------------------------------------------------------------
// Global keys + boot
// --------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    panel.close();
    app.dataset.panel = 'closed';
  } else if ((e.key === 'r' || e.key === 'R') && machine.state === 'showcase') {
    machine.send({ type: 'REROLL' });
  }
});

machine.start();
