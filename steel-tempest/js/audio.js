// TONK — audio.js
// 100% procedural WebAudio: noise/tone helpers, SFX bank, engine loop.
import { CFG, rand, randSpread, clamp, dist2D, _v1, _v2 } from './config.js';
import { camera } from './scene.js';

let AC = null, master = null, engineNodes = null, muted = false, noiseBuf = null;

export function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = CFG.audio.master;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp); comp.connect(AC.destination);

    // cached noise buffer
    const len = AC.sampleRate * 2;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // ambient wind
    const wind = AC.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = AC.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 280;
    const wg = AC.createGain(); wg.gain.value = 0.045;
    wind.connect(wf); wf.connect(wg); wg.connect(master); wind.start();

    // engine: saw osc -> lowpass -> AM chug -> gain
    const osc = AC.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 52;
    const sub = AC.createOscillator(); sub.type = 'triangle'; sub.frequency.value = 26;
    const lp  = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 2;
    const am  = AC.createGain(); am.gain.value = 0.55;
    const amOsc = AC.createOscillator(); amOsc.type = 'square'; amOsc.frequency.value = 14;
    const amDepth = AC.createGain(); amDepth.gain.value = 0.3;
    amOsc.connect(amDepth); amDepth.connect(am.gain);
    const eg = AC.createGain(); eg.gain.value = 0.0;
    osc.connect(lp); sub.connect(lp); lp.connect(am); am.connect(eg); eg.connect(master);
    osc.start(); sub.start(); amOsc.start();
    engineNodes = { osc, sub, lp, amOsc, eg };
  } catch (e) { AC = null; }
}
export function audioResume() { if (AC && AC.state === 'suspended') AC.resume(); }
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : CFG.audio.master;
  return muted;
}
export function applyAudioCfg() {
  if (master && !muted) master.gain.value = CFG.audio.master;
}

function panGainFor(x, z) {
  // distance gain + stereo pan from camera space
  const d = dist2D(x, z, camera.position.x, camera.position.z);
  const g = clamp(1.25 / (1 + d * 0.022), 0.05, 1);
  _v1.set(x, 0, z).sub(camera.position);
  _v2.setFromMatrixColumn(camera.matrixWorld, 0); // camera right
  const pan = clamp(_v1.normalize().dot(_v2) * 0.8, -0.9, 0.9);
  return { g, pan };
}
function sfxChain(gain, pan) {
  const g = AC.createGain(); g.gain.value = gain;
  const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  if (p) { p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
  return g;
}
function playNoise(dur, f0, f1, vol, pan = 0, type = 'lowpass') {
  if (!AC) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = rand(0.85, 1.15);
  const f = AC.createBiquadFilter(); f.type = type; f.Q.value = 0.8;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = sfxChain(0.0001, pan);
  g.gain.setValueAtTime(vol * CFG.audio.sfx, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g);
  src.start(t); src.stop(t + dur + 0.05);
}
function playTone(type, f0, f1, dur, vol, pan = 0) {
  if (!AC) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = sfxChain(0.0001, pan);
  g.gain.setValueAtTime(vol * CFG.audio.sfx, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  shot(x, z, big = false) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.28, 900, 140, 0.85 * g, pan);
    playTone('sine', big ? 95 : 120, 42, 0.26, 0.7 * g, pan);
  },
  explosion(x, z, scale = 1) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.9 + scale * 0.3, 1100, 60, 1.0 * g, pan);
    playTone('sine', 64, 27, 0.8, 0.85 * g, pan);
    for (let i = 0; i < 3; i++)
      setTimeout(() => playNoise(0.1, 2400, 700, 0.2 * g, pan, 'bandpass'), 60 + Math.random() * 260);
  },
  clank(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playTone('triangle', 1250, 620, 0.09, 0.5 * g, pan);
    playNoise(0.06, 4200, 2400, 0.3 * g, pan, 'highpass');
  },
  dirt(x, z) {
    if (!AC) return; const { g, pan } = panGainFor(x, z);
    playNoise(0.4, 500, 90, 0.5 * g, pan);
  },
  whiz() { playNoise(0.22, 2100, 500, 0.22, randSpread(0.6), 'bandpass'); },
  reload() { playTone('square', 1900, 1500, 0.03, 0.12); },
  repair() { playTone('sine', 660, 660, 0.12, 0.25); setTimeout(() => playTone('sine', 990, 990, 0.2, 0.25), 110); },
  horn() {
    playTone('sawtooth', 98, 98, 0.26, 0.3); playTone('sawtooth', 99.5, 99.5, 0.26, 0.3);
    setTimeout(() => { playTone('sawtooth', 130.8, 130.8, 0.42, 0.34); playTone('sawtooth', 132, 132, 0.42, 0.34); }, 300);
  },
  alarm() { playTone('square', 880, 880, 0.07, 0.1); setTimeout(() => playTone('square', 880, 880, 0.07, 0.1), 140); },
  gameover() { playTone('sawtooth', 196, 49, 1.4, 0.4); },
};

// engine loop params — call every frame; active=false silences it
export function updateEngine(speed, throttle, active) {
  if (!engineNodes || !AC) return;
  if (!active) {
    engineNodes.eg.gain.setTargetAtTime(0, AC.currentTime, 0.2);
    return;
  }
  const sp = Math.abs(speed);
  engineNodes.eg.gain.setTargetAtTime(muted ? 0 : (0.16 + sp * 0.006) * CFG.audio.engine, AC.currentTime, 0.1);
  engineNodes.osc.frequency.setTargetAtTime(50 + sp * 4.2 + Math.abs(throttle) * 8, AC.currentTime, 0.15);
  engineNodes.amOsc.frequency.setTargetAtTime(12 + sp * 1.6, AC.currentTime, 0.15);
  engineNodes.lp.frequency.setTargetAtTime(230 + sp * 28, AC.currentTime, 0.15);
}
