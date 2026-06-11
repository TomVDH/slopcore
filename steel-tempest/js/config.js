// TONK — config.js
// The TONK namespace: CFG (tunables), DEFAULTS (pristine snapshot), rt (shared
// runtime state), api (filled by main.js at boot). Plus math utils + scratch.
import * as THREE from 'three';

// ---------------------------------------------------------------- utils
export const rand = (a, b) => a + Math.random() * (b - a);
export const randSpread = (s) => (Math.random() * 2 - 1) * s;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const wrapPI = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
export const angleTo = (cur, target, maxStep) => cur + clamp(wrapPI(target - cur), -maxStep, maxStep);
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const fmt = (n, w) => String(n).padStart(w, '0');

// scratch (reused, never stored)
export const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
export const _q1 = new THREE.Quaternion();
export const _m1 = new THREE.Matrix4();

// ---------------------------------------------------------------- CFG
// Binding classes: live values are read at their use site every frame/call;
// enemy variant rows are copied into e.spec at spawn (respawn to apply);
// world geometry (terrain coefficients, prop scatter, pool sizes) is init-only
// and intentionally not here.
export const CFG = {
  world: {
    radius: 258,            // hard bound for tanks (teeth ring is fixed décor at 268)
    fogNear: 95, fogFar: 430,
    sunIntensity: 2.7, hemiIntensity: 0.55,
    exposure: 1.12,
    ambientDustRate: 2.2,
  },
  player: {
    maxFwd: 14.5, maxRev: 7.5, accel: 16, yawRate: 1.55,
    turretRate: 7.5,
    reloadT: 1.05,
    dmg: 50,
    shellSpeed: 85,
    maxHp: 100,
    radius: 2.6,            // respawn to apply
  },
  shells: {
    gravity: 9.5,
    trailDt: 0.016,
  },
  enemies: {
    // per-variant rows are spawn-bound (copied into e.spec)
    std:   { hp: 100, dmg: 10, speed: 9.5,  rev: 5, accel: 9,  yaw: 1.05, turret: 2.2, reloadLo: 3.0, reloadHi: 4.0, aimErr: 8.5, rangeLo: 38, rangeHi: 68, score: 150, shell: 60, scale: 1 },
    scout: { hp: 55,  dmg: 6,  speed: 14.5, rev: 7, accel: 13, yaw: 1.65, turret: 3.2, reloadLo: 1.7, reloadHi: 2.4, aimErr: 10,  rangeLo: 22, rangeHi: 46, score: 200, shell: 70, scale: 0.85 },
    heavy: { hp: 250, dmg: 22, speed: 6.2,  rev: 3, accel: 6,  yaw: 0.8,  turret: 1.5, reloadLo: 4.2, reloadHi: 5.2, aimErr: 6,   rangeLo: 42, rangeHi: 82, score: 350, shell: 62, scale: 1.28 },
    hpWaveFactor: 0.11, hpWaveCap: 1.9,
    dmgWaveFactor: 0.05, dmgWaveCap: 1.5,
    speedWaveFactor: 0.015,
    aimErrWaveDrop: 0.45, aimErrMin: 2.6,
    fireRangeMax: 95, fireRangeMin: 7, aimGate: 0.08,
    spawnRingLo: 120, spawnRingHi: 165,
  },
  waves: {
    baseCount: 2, maxCount: 12, maxConcurrent: 6,
    spawnStagger: 0.5, reinforceDelay: 1.4, nextWaveDelay: 4.5,
    clearBonusBase: 250, clearBonusPerWave: 50,
    scoutFromWave: 2, scoutChance: 0.5,
    heavyFromWave: 3, heavyChance: 0.22,
  },
  pickups: {
    heal: 35, magnetR: 7, collectR: 2.6, ttl: 26,
    dropChanceLowHp: 0.34, dropChanceCritHp: 0.6,
  },
  vfx: {
    particleMul: 1, sizeMul: 1, traumaMul: 1,
    explosionTrauma: 0.55, hitTrauma: 0.45, fireTrauma: 0.22,
  },
  camera: {
    dist: 15, distMin: 9, distMax: 26, wheelStep: 1.4,
    heightK: 0.52, heightBase: 2.2,
    aimPull: 2.2, lookAhead: 0.22,
    posDamp: 5, idleDamp: 2.2, lookDamp: 7,
    traumaDecay: 1.5, shakeMag: 1,
  },
  audio: {
    master: 0.8, sfx: 1, engine: 1,
  },
};
export const DEFAULTS = structuredClone(CFG);

// localStorage key for the sector record ('steelTempest.hi' is the legacy key)
export const HI_KEY = 'tonk.hi';
export const HI_KEY_LEGACY = 'steelTempest.hi';

// ---------------------------------------------------------------- rt
// All cross-module mutable state. Arrays are created once and only ever
// mutated in place — never reassigned (stale-alias hazard).
export const rt = {
  state: 'TITLE',           // TITLE | PLAYING | DYING | GAMEOVER
  paused: false,
  wave: 0,
  pendingSpawns: 0,
  simTime: 0,
  timeScale: 1,
  timeScaleTarget: 1,
  hitstopT: 0,
  trauma: 0,
  vignetteFlash: 0,
  hintFadeT: Infinity,
  camDist: CFG.camera.dist,
  fpsAvg: 60,
  stats: { kills: 0, shots: 0, hits: 0, score: 0, time: 0 },
  hiScore: 0,
  player: null,
  enemies: [],
  debris: [],
  wrecks: [],
  obstacles: [],
  pickups: [],
  godMode: false,
  noWaves: false,
};

export function addTrauma(n) {
  rt.trauma = clamp(rt.trauma + n * CFG.vfx.traumaMul, 0, 1);
}

export const TONK = { CFG, DEFAULTS, rt, api: {} };
window.TONK = TONK;
