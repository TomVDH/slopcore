// SOOB — config.js
// The SOOB namespace: CFG (live tunables), DEFAULTS (pristine snapshot), rt
// (shared runtime state), api (filled by main.js at boot). Plus math utils.
//
// Depth convention: y is metres, surface at 0, down is negative. UI shows
// positive "depth in metres" = -y. CFG depth fields are POSITIVE metres.
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
export const fmt = (n, w) => String(Math.max(0, Math.round(n))).padStart(w, '0');
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// compass bearing (deg, 0=N=+z) from a to b — sub fiction speaks in bearings
export const bearingTo = (ax, az, bx, bz) =>
  Math.round(((Math.atan2(bx - ax, bz - az) * 180 / Math.PI) + 360) % 360);

// scratch (reused, never stored)
export const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
export const _q1 = new THREE.Quaternion();

// ---------------------------------------------------------------- CFG
// Binding classes: most values are read live at their use site every frame;
// ship variant rows are copied into s.spec at spawn (respawn/new spawns apply);
// world geometry (seabed coefficients, pool sizes, shaft count) is init-only.
export const CFG = {
  world: {
    bound: 1500,             // hard play-area radius (m)
    surfaceY: 0,
    periscopeDepth: 12,      // shallower than this = scope out, visible
    surfacedDepth: 6,        // shallower = effectively surfaced (gun magnet)
    layerDepth: 118,         // thermal layer centre (per-run jitter applied)
    layerJitter: 16,
    layerBand: 11,           // half-thickness of the visual/acoustic band
    crushDepth: 224,         // hull damage ramps below this
    fogShallow: 0.0042,      // exp2 fog density at surface
    fogDeep: 0.0085,         // …at full depth
    sunIntensity: 2.1, hemiIntensity: 0.75, exposure: 1.06,
    snowRate: 16,            // marine snow spawns / s around the camera
    shaftOpacity: 1,         // light-shaft brightness multiplier
  },
  player: {
    maxHp: 100,
    // telegraph order: [ASTERN, ALL STOP, AHEAD SLOW, AHEAD HALF, AHEAD FULL, FLANK]
    telegraph: { astern: -4.2, stop: 0, slow: 4.2, half: 7.6, full: 11.2, flank: 14.5 },
    accel: 1.9,              // m/s² toward telegraph speed
    yawRate: 0.34,           // rad/s at full way
    yawMinWay: 0.25,         // fraction of rudder authority at zero speed
    vertRate: 6.2,           // ballast climb/dive m/s
    vertAccel: 5.5,
    silentCapIdx: 2,         // silent running caps telegraph at AHEAD SLOW
    silentNoiseMul: 0.34,
    radius: 17,              // collision half-length
    crushDps: 9,             // hull dmg/s per 10m below crush depth
    ramDmgMul: 2.4,          // collision damage scale (speed-based)
  },
  noise: {
    // signature points per telegraph step (index-aligned with player.telegraph)
    astern: 42, stop: 4, slow: 15, half: 31, full: 50, flank: 74,
    cavExtra: 42,            // added while cavitating
    cavBaseSpeed: 6.4,       // cavitation threshold at the surface (m/s)
    cavPerMeter: 0.027,      // threshold rises with depth — deep boats run faster quietly
    fireTransient: 55,       // torpedo launch transient
    decoyTransient: 18,
    transientDecay: 22,      // points/s the transient bleeds off
    creak: 14,               // hull groans below crush add noise too
  },
  torpedo: {
    speed: 26, range: 1150, armDist: 78, fuseR: 9.5,
    dmg: 100, turnRate: 0.5, // gyro steering limit rad/s
    tubes: 4, reloadT: 6.5,  // per-tube sequential reload (paused while silent)
    wakeRate: 70,            // bubble-wake particles/s
  },
  decoy: { count: 3, noise: 92, ttl: 15, pullR: 620 },
  ships: {
    // per-variant rows are spawn-bound (copied into s.spec)
    freighter: { hp: 100, speed: 4.4, accel: 0.5, yaw: 0.10, len: 58, beam: 9,  draft: 3.4, tonLo: 5400,  tonHi: 9400 },
    tanker:    { hp: 165, speed: 3.7, accel: 0.4, yaw: 0.08, len: 78, beam: 12, draft: 4.2, tonLo: 9800,  tonHi: 14800 },
    escort:    { hp: 120, speed: 8.6, sprint: 16.5, accel: 1.5, yaw: 0.30, len: 45, beam: 6, draft: 2.6, tonLo: 1900, tonHi: 1900,
                 acuity: 1, pingPeriod: 7.6, gunDmg: 7, gunPeriod: 2.4, gunRange: 760 },
    hunter:    { hp: 150, speed: 9.4, sprint: 18.5, accel: 1.8, yaw: 0.34, len: 49, beam: 6, draft: 2.6, tonLo: 2600, tonHi: 2600,
                 acuity: 1.55, pingPeriod: 5.4, gunDmg: 9, gunPeriod: 1.9, gunRange: 860 },
  },
  detection: {
    passiveR: 680,           // base passive sonar range (× acuity, × your noise/100)
    activeR: 540,            // active ping echo range (× acuity)
    susThresh: 0.045,        // signal under this never accumulates
    susRate: 0.55,           // suspicion gain/s at full signal
    susDecay: 0.055,         // suspicion bleed/s when signal lost
    investigateAt: 0.34,     // suspicion: start hunting the LKP
    attackAt: 0.78,          // suspicion: depth-charge runs
    layerAtten: 0.32,        // your signal × this when you + listener straddle the layer
    pingLayerAtten: 0.42,    // ping echo strength across the layer
    bottomAtten: 0.55,       // bottom clutter: signal × this when hugging the seabed
    bottomDist: 13,          // …within this many metres of it
    deafT: 4.5,              // explosions blind nearby sonars for this long
    deafR: 160, deafMul: 0.15,
    visPeriscopeR: 360,      // they SEE your scope feather inside this
    visSurfacedR: 880,       // they see a surfaced boat from here
    visRate: 1.1,            // suspicion gain/s when visually spotted
    pingSpeed: 380,          // stylised wavefront speed (m/s) — readable, not physical
    lkpErrBase: 150,         // their position error at first contact
    lkpErrMin: 16,           // …shrinks toward this as suspicion firms up
    depthErrBase: 55,        // charge fuse-depth error at low confidence
    wakeSpotR: 240,          // escorts inside this spot a launched torpedo's wake origin
  },
  charges: {
    dmg: 78, lethalR: 9, blastR: 31,
    sinkRate: 4.8, perRun: 5, interval: 0.7,
    runCooldown: 6,          // escort regroups between attack runs
    fuseJitter: 9,           // ± metres on the intended fuse depth
  },
  convoys: {
    firstDelay: 16,          // s until the first contact report
    period: 64,              // s between convoys (shrinks with heat)
    periodMin: 36,
    merchLo: 2, merchHi: 4,
    escortsBase: 1, escortsMax: 4,
    spacing: 92,             // column spacing
    heatPerTon: 1 / 22000,   // +1 escort & faster convoys per ~22k tonnage
    hunterPackHeat: 1.6,     // heat level where dedicated hunter pairs start
    hunterPackPeriod: 85,
    routeJitter: 0.35,       // rad of lane variation
  },
  score: {
    escortBonus: 800,        // flat bonus on top of escort tonnage
    convoyClearBonus: 2500,  // every merchant of a convoy sunk
  },
  vfx: {
    particleMul: 1, sizeMul: 1, traumaMul: 1,
    explosionTrauma: 0.5, chargeTraumaR: 120,
    hitstopT: 0.09,
  },
  camera: {
    dist: 38, distMin: 18, distMax: 80, wheelStep: 3.5,
    heightK: 0.34, aimPull: 7, lookAhead: 0.22,
    posDamp: 4.2, idleDamp: 2.0, lookDamp: 6.5,
    traumaDecay: 1.45, shakeMag: 1.15,
  },
  audio: { master: 0.8, sfx: 1, engine: 1, ambience: 1 },
};
export const DEFAULTS = structuredClone(CFG);

export const TELEGRAPH_KEYS = ['astern', 'stop', 'slow', 'half', 'full', 'flank'];
export const TELEGRAPH_LABELS = ['ASTERN', 'ALL STOP', 'AHEAD SLOW', 'AHEAD HALF', 'AHEAD FULL', 'FLANK'];

// localStorage key for the patrol record book
export const REC_KEY = 'soob.rec.v1';

// ---------------------------------------------------------------- rt
// All cross-module mutable state. Arrays are created once and only ever
// mutated in place — never reassigned (stale-alias hazard).
export const rt = {
  state: 'TITLE',            // TITLE | PLAYING | DYING | GAMEOVER
  paused: false,
  simTime: 0,
  timeScale: 1,
  timeScaleTarget: 1,
  hitstopT: 0,
  trauma: 0,
  vignetteFlash: 0,
  camDist: CFG.camera.dist,
  fpsAvg: 60,
  layerY: -CFG.world.layerDepth, // per-run jittered thermal layer centre (y, negative)
  heat: 0,                   // global aggression: rises with tonnage sunk
  alert: 0,                  // 0 undetected · 1 suspicious · 2 hunted (max over escorts)
  pingFlash: 0,              // HUD scope flash when an enemy ping echoes off you
  godMode: false,
  noWaves: false,            // range mode: no convoy scheduler
  stats: { tonnage: 0, ships: 0, time: 0, deepest: 0, fired: 0, hits: 0, convoys: 0 },
  records: { tonnage: 0, ships: 0, time: 0, deepest: 0 },
  newRecord: false,
  causeOfDeath: '',
  player: null,
  ships: [],                 // merchants + escorts (alive and sinking)
  torpedoes: [],
  charges: [],               // depth charges in the water
  shellsplashes: [],         // deck-gun shells (only vs shallow boats)
  decoys: [],
  pings: [],                 // expanding active-sonar wavefronts (enemy + player)
  contacts: [],              // sonar-scope contact memory (hud reads this)
  wrecks: [],
};

export function addTrauma(n) {
  rt.trauma = clamp(rt.trauma + n * CFG.vfx.traumaMul, 0, 1);
}

// player depth helpers (positive metres for UI / CFG comparisons)
export const depthOf = (y) => Math.max(0, -y);
export const belowLayer = (y) => y < rt.layerY - CFG.world.layerBand;
export const aboveLayer = (y) => y > rt.layerY + CFG.world.layerBand;
// acoustic attenuation between two depths across the thermal layer
export function layerAttenBetween(yA, yB) {
  return (belowLayer(yA) && aboveLayer(yB)) || (belowLayer(yB) && aboveLayer(yA))
    ? CFG.detection.layerAtten : 1;
}

export const SOOB = { CFG, DEFAULTS, rt, api: {} };
window.SOOB = SOOB;
