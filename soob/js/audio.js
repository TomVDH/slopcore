// SOOB — audio.js
// 100% procedural WebAudio. Everything passes through a master lowpass that
// closes as you dive — the whole world muffles with depth. Bank: pings (yours
// and theirs), muffled explosions, depth-charge cracks, hull creaks, prop
// loop with cavitation hiss, sinking-ship groans, klaxon.
import { CFG, rand, randSpread, clamp, dist2D, _v1, _v2 } from './config.js';
import { camera } from './scene.js';

let AC = null, master = null, muffle = null, engine = null, muted = false, noiseBuf = null;
let pingDelay = null; // shared feedback delay — the sonar "riiing" tail

export function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = CFG.audio.master;
    muffle = AC.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 2600; muffle.Q.value = 0.4;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5;
    master.connect(muffle); muffle.connect(comp); comp.connect(AC.destination);

    const len = AC.sampleRate * 2;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b = 0; // brown-ish: integrate white noise
    for (let i = 0; i < len; i++) { b = (b + (Math.random() * 2 - 1) * 0.18) * 0.985; d[i] = b * 3.2; }

    // abyssal ambience: deep rumble bed
    const amb = AC.createBufferSource(); amb.buffer = noiseBuf; amb.loop = true;
    const af = AC.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 110;
    const ag = AC.createGain(); ag.gain.value = 0.05 * CFG.audio.ambience;
    const lfo = AC.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = AC.createGain(); lfoG.gain.value = 0.018;
    lfo.connect(lfoG); lfoG.connect(ag.gain);
    amb.connect(af); af.connect(ag); ag.connect(master);
    amb.start(); lfo.start();
    engineAmbGain = ag;

    // ping tail: shared feedback delay line
    pingDelay = AC.createDelay(0.5); pingDelay.delayTime.value = 0.21;
    const fb = AC.createGain(); fb.gain.value = 0.42;
    const wet = AC.createGain(); wet.gain.value = 0.5;
    pingDelay.connect(fb); fb.connect(pingDelay);
    pingDelay.connect(wet); wet.connect(master);

    // own boat: prop thrum + AM chug + cavitation hiss
    const osc = AC.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 38;
    const sub = AC.createOscillator(); sub.type = 'sine'; sub.frequency.value = 19;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 1.6;
    const am = AC.createGain(); am.gain.value = 0.6;
    const amOsc = AC.createOscillator(); amOsc.type = 'sine'; amOsc.frequency.value = 5;
    const amDepth = AC.createGain(); amDepth.gain.value = 0.34;
    amOsc.connect(amDepth); amDepth.connect(am.gain);
    const eg = AC.createGain(); eg.gain.value = 0;
    osc.connect(lp); sub.connect(lp); lp.connect(am); am.connect(eg); eg.connect(master);
    const hiss = AC.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true; hiss.playbackRate.value = 1.7;
    const hf = AC.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 2400; hf.Q.value = 0.6;
    const hg = AC.createGain(); hg.gain.value = 0;
    hiss.connect(hf); hf.connect(hg); hg.connect(master);
    osc.start(); sub.start(); amOsc.start(); hiss.start();
    engine = { osc, amOsc, lp, eg, hg };
  } catch (e) { AC = null; }
}
let engineAmbGain = null;
export function audioResume() { if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); }
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : CFG.audio.master;
  return muted;
}
export function applyAudioCfg() {
  if (master && !muted) master.gain.value = CFG.audio.master;
  if (engineAmbGain) engineAmbGain.gain.value = 0.05 * CFG.audio.ambience;
}

function panGainFor(x, z) {
  const d = dist2D(x, z, camera.position.x, camera.position.z);
  const g = clamp(1.3 / (1 + d * 0.012), 0.05, 1); // water carries sound far
  _v1.set(x, 0, z).sub(camera.position);
  _v2.setFromMatrixColumn(camera.matrixWorld, 0);
  const pan = clamp(_v1.normalize().dot(_v2) * 0.8, -0.9, 0.9);
  return { g, pan };
}
function sfxChain(pan, toPing = false) {
  const g = AC.createGain(); g.gain.value = 0.0001;
  const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  if (p) { p.pan.value = pan; g.connect(p); p.connect(master); if (toPing) p.connect(pingDelay); }
  else { g.connect(master); if (toPing) g.connect(pingDelay); }
  return g;
}
function playNoise(dur, f0, f1, vol, pan = 0, type = 'lowpass', Q = 0.8, rate = null) {
  if (!AC) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = rate || rand(0.85, 1.2);
  const f = AC.createBiquadFilter(); f.type = type; f.Q.value = Q;
  f.frequency.setValueAtTime(Math.max(25, f0), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(25, f1), t + dur);
  const g = sfxChain(pan);
  g.gain.setValueAtTime(vol * CFG.audio.sfx, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g);
  src.start(t); src.stop(t + dur + 0.05);
}
function playTone(type, f0, f1, dur, vol, pan = 0, { delay = 0, toPing = false, attack = 0.004 } = {}) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = sfxChain(pan, toPing);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * CFG.audio.sfx), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  // your own active ping — bright, clean, with the riiing tail
  ping() {
    playTone('sine', 2350, 2150, 0.30, 0.5, 0, { toPing: true, attack: 0.002 });
    playTone('sine', 4700, 4300, 0.10, 0.10, 0, { toPing: true });
  },
  // an echo coming back from a contact, delayed by range
  echo(delay, strength, pan = 0) {
    playTone('sine', 2280, 2120, 0.22, 0.22 * strength, pan, { delay, toPing: true });
  },
  // their ping — lower, heavier, the sound of being hunted
  enemyPing(x, z, delay = 0) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playTone('sine', 1280, 1130, 0.42, 0.62 * g, pan, { delay, toPing: true, attack: 0.003 });
    playTone('sine', 2560, 2260, 0.12, 0.10 * g, pan, { delay, toPing: true });
  },
  // the hard tink of their echo coming off YOUR hull
  echoHit() { playTone('triangle', 3300, 2900, 0.09, 0.30, 0, { toPing: true }); },
  torpedoLaunch(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.5, 700, 120, 0.8 * g, pan);                     // compressed-air thump
    playTone('sine', 90, 40, 0.3, 0.6 * g, pan);
    playNoise(1.1, 1900, 2600, 0.16 * g, pan, 'bandpass', 2);   // bubble rush
  },
  torpedoWhine(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playTone('sawtooth', 480, 560, 0.5, 0.045 * g, pan);
  },
  // underwater explosion: lowpassed crump + deep thump + bubble crackle tail
  explosion(x, z, scale = 1) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.8 + 0.3 * scale, 420, 50, 1.1 * g, pan);
    playTone('sine', 52, 22, 0.9 + 0.2 * scale, 0.95 * g, pan);
    for (let i = 0; i < 5; i++)
      setTimeout(() => playNoise(0.08, 1500, 600, 0.12 * g, pan, 'bandpass', 3), 120 + Math.random() * 700);
  },
  // depth charge: sharper crack — pressure spike then rumble
  charge(x, z, near = false) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.12, 2400, 300, (near ? 1.1 : 0.7) * g, pan, 'lowpass', 0.6, 1.6);
    playNoise(1.1, 380, 45, 1.0 * g, pan);
    playTone('sine', 60, 20, 1.2, 1.0 * g, pan);
  },
  splash(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.25, 1200, 2400, 0.16 * g, pan, 'highpass');
  },
  // hull creak — resonant squeal, the deep saying hello
  creak() {
    const f = rand(420, 980);
    playNoise(rand(0.5, 1.1), f, f * rand(0.32, 0.5), 0.30, randSpread(0.5), 'bandpass', 16, 0.8);
  },
  // breakup groans of a dying ship — detuned saws sliding down
  groan(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    const f = rand(150, 240);
    playTone('sawtooth', f, f * 0.32, rand(1.6, 2.6), 0.16 * g, pan, { attack: 0.3 });
    playTone('sawtooth', f * 1.013, f * 0.30, rand(1.6, 2.6), 0.14 * g, pan, { attack: 0.4 });
    if (Math.random() < 0.6) setTimeout(() => playTone('triangle', rand(900, 1500), 500, 0.1, 0.10 * g, pan), rand(300, 1300));
  },
  gunReport(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.3, 500, 80, 0.4 * g, pan);
  },
  shellSplash(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.35, 900, 2000, 0.3 * g, pan, 'highpass');
    playTone('sine', 130, 60, 0.2, 0.2 * g, pan);
  },
  klaxon() {
    for (let i = 0; i < 2; i++)
      setTimeout(() => { playTone('square', 620, 470, 0.34, 0.16); }, i * 420);
  },
  silentOn() { playTone('sine', 880, 620, 0.12, 0.14); playTone('sine', 440, 310, 0.18, 0.10, 0, { delay: 0.1 }); },
  silentOff() { playTone('sine', 620, 880, 0.12, 0.14); },
  telegraph() { playTone('square', 1400, 1250, 0.04, 0.10); playTone('square', 1500, 1400, 0.04, 0.08, 0, { delay: 0.07 }); },
  decoy(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.4, 900, 1800, 0.4 * g, pan, 'bandpass', 1.5);
  },
  tubeReady() { playTone('triangle', 1050, 1050, 0.05, 0.12); },
  contact() { playTone('sine', 1750, 1750, 0.07, 0.10); },
  record() {
    [523, 659, 784, 1046].forEach((f, i) => playTone('sine', f, f, 0.3, 0.16, 0, { delay: i * 0.13 }));
  },
  gameover() { playTone('sawtooth', 130, 33, 2.4, 0.4); playNoise(2.2, 300, 50, 0.4); },
};

// per-frame: engine loop follows speed/cavitation; world muffles with depth
export function updateEngine(speed, cavitating, active, depth) {
  if (!AC || !engine) return;
  if (muffle) muffle.frequency.setTargetAtTime(clamp(3400 - depth * 9, 700, 3400), AC.currentTime, 0.3);
  if (!active) {
    engine.eg.gain.setTargetAtTime(0, AC.currentTime, 0.3);
    engine.hg.gain.setTargetAtTime(0, AC.currentTime, 0.2);
    return;
  }
  const sp = Math.abs(speed);
  engine.eg.gain.setTargetAtTime(muted ? 0 : (0.05 + sp * 0.012) * CFG.audio.engine, AC.currentTime, 0.15);
  engine.osc.frequency.setTargetAtTime(34 + sp * 3.4, AC.currentTime, 0.2);
  engine.amOsc.frequency.setTargetAtTime(2.5 + sp * 1.1, AC.currentTime, 0.2);
  engine.lp.frequency.setTargetAtTime(150 + sp * 22, AC.currentTime, 0.2);
  engine.hg.gain.setTargetAtTime(cavitating && !muted ? 0.10 * CFG.audio.engine : 0, AC.currentTime, 0.12);
}
