// SOOB — game.js
// Combat core, co-located to avoid import cycles: player boat physics +
// noise signature, the acoustic detection model (passive listening, active
// pings, thermal layer, bottom clutter), torpedoes + fire solutions, escort
// AI with depth-charge runs and deck guns, convoy scheduler, decoys,
// scoring/records, sinking sequences, death.
import * as THREE from 'three';
import {
  CFG, rt, REC_KEY, TELEGRAPH_KEYS, rand, randSpread, clamp, lerp, damp, wrapPI, angleTo,
  dist2D, fmt, bearingTo, depthOf, belowLayer, layerAttenBetween, addTrauma, _v1, _v2,
} from './config.js';
import { scene } from './scene.js';
import { seabedH, setLayerY } from './world.js';
import { sfx } from './audio.js';
import {
  boom, breach, splashIn, shellSplash, pingRing, cavitation, wake,
  addEmitter, spawnFlash, spawnFoam, clearVfx, glowP, COL,
} from './vfx.js';
import { buildSub, buildShip, buildTorpedo, buildCharge, buildDecoy } from './boats.js';
import {
  feed, banner, updateHullHud, updateScoreHud, updateAlertHud, fadeHints, showHints,
} from './hud.js';
import { keys, aimOrigin, aimDir } from './input.js';

const MERCH_NAMES = [
  'EMPIRE GULL', 'CLAN DOUGLAS', 'PORT STANLEY', 'SILVER BIRCH', 'OCEAN VAGRANT',
  'CAPE COMORIN', 'STAR OF LEITH', 'EASTERN PRIDE', 'RIO VERDE', 'BALTIC ROSE',
  'CORMORANT', 'HIGHLAND LOCH', 'SANTA INES', 'GOLDEN FLEECE', 'KOWLOON BAY',
  'PETREL', 'ARGOSY', 'NORTH CAPE', 'TRADE WIND', 'BLUE FUNNEL', 'MORNING STAR',
  'TYNE PRINCESS', 'ALBACORE', 'WANDERER',
];

// ---------------------------------------------------------------- timers
const simTimers = [];
export function after(t, fn) { simTimers.push({ t: rt.simTime + t, fn }); }
export function tickTimers() {
  for (let i = simTimers.length - 1; i >= 0; i--) {
    if (rt.simTime >= simTimers[i].t) {
      const fn = simTimers[i].fn;
      simTimers.splice(i, 1);
      fn();
    }
  }
}

// ---------------------------------------------------------------- records
export function loadRecords() {
  try {
    const r = JSON.parse(localStorage.getItem(REC_KEY) || 'null');
    if (r) Object.assign(rt.records, r);
  } catch (e) {}
}
function saveRecords() {
  const s = rt.stats, r = rt.records;
  rt.newRecord = s.tonnage > r.tonnage && s.tonnage > 0;
  r.tonnage = Math.max(r.tonnage, s.tonnage);
  r.ships = Math.max(r.ships, s.ships);
  r.time = Math.max(r.time, Math.floor(s.time));
  r.deepest = Math.max(r.deepest, Math.floor(s.deepest));
  try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) {}
}

// ---------------------------------------------------------------- player
export function buildPlayer() {
  if (rt.player?.mesh) scene.remove(rt.player.mesh);
  const mesh = buildSub();
  scene.add(mesh);
  rt.player = {
    pos: new THREE.Vector3(0, -CFG.world.periscopeDepth, 0),
    heading: rand(0, Math.PI * 2),
    speed: 0, vSpeed: 0,
    telegraphIdx: 1,         // ALL STOP — quiet until the captain says otherwise
    silent: false, cav: false,
    noise: CFG.noise.stop, transient: 0,
    hp: CFG.player.maxHp, alive: true,
    tubes: [0, 0, 0, 0, 0, 0].slice(0, CFG.torpedo.tubes),
    decoys: CFG.decoy.count,
    pingCd: 0,
    pitch: 0, roll: 0,
    deathT: 0, fxAnchor: { x: 0, y: 0, z: 0, dead: false },
    mesh,
  };
  mesh.position.copy(rt.player.pos);
}

export function damagePlayer(dmg, cause = 'DEPTH CHARGE') {
  const p = rt.player;
  if (!p || !p.alive || rt.godMode || rt.state !== 'PLAYING') return;
  const wasAbove = p.hp > CFG.player.maxHp * 0.28;
  p.hp -= dmg;
  rt.vignetteFlash = Math.min(1, rt.vignetteFlash + dmg / 45);
  if (wasAbove && p.hp <= CFG.player.maxHp * 0.28 && p.hp > 0) {
    sfx.klaxon();
    feed('HULL CRITICAL — FLOODING IN THE BOAT', 'bad');
  }
  updateHullHud();
  if (p.hp <= 0) playerDeath(cause);
}
export function healPlayer(n = CFG.player.maxHp) {
  const p = rt.player; if (!p) return;
  p.hp = clamp(p.hp + n, 0, CFG.player.maxHp);
  updateHullHud();
}

export function telegraphStep(d) {
  const p = rt.player; if (!p || !p.alive) return;
  const cap = p.silent ? CFG.player.silentCapIdx : TELEGRAPH_KEYS.length - 1;
  p.telegraphIdx = clamp(p.telegraphIdx + d, 0, cap);
  sfx.telegraph();
}
export function toggleSilent() {
  const p = rt.player; if (!p || !p.alive) return p?.silent;
  p.silent = !p.silent;
  if (p.silent) {
    p.telegraphIdx = Math.min(p.telegraphIdx, CFG.player.silentCapIdx);
    sfx.silentOn();
    feed('RIG FOR SILENT RUNNING', 'good');
  } else {
    sfx.silentOff();
    feed('SECURE FROM SILENT RUNNING');
  }
  return p.silent;
}

export function playerPing() {
  const p = rt.player; if (!p || !p.alive || rt.state !== 'PLAYING') return;
  if (p.pingCd > 0) return;
  p.pingCd = 4;
  const maxR = 1000;
  rt.pings.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, r: 1, maxR, mine: true, echoed: new Set() });
  pingRing(p.pos.x, p.pos.y, p.pos.z, maxR, true);
  sfx.ping();
  p.transient += 60; // a ping is a shout
}

export function dropDecoy() {
  const p = rt.player; if (!p || !p.alive || rt.state !== 'PLAYING') return;
  if (p.decoys <= 0) { feed('NO DECOYS REMAINING', 'bad'); return; }
  p.decoys--;
  const x = p.pos.x - Math.sin(p.heading) * 20, z = p.pos.z - Math.cos(p.heading) * 20;
  const mesh = buildDecoy();
  mesh.position.set(x, p.pos.y, z);
  scene.add(mesh);
  rt.decoys.push({ x, y: p.pos.y, z, t: CFG.decoy.ttl, mesh });
  addEmitter({ x, y: p.pos.y, z, until: rt.simTime + CFG.decoy.ttl, rate: 26, kind: 'bubbles', spread: 1.5 });
  p.transient += CFG.noise.decoyTransient;
  sfx.decoy(x, z);
  feed('NOISEMAKER AWAY', 'good');
}

// ---------------------------------------------------------------- fire solution
// rt.solution = {x,y,z, ship, run, range, locked} — refreshed every frame
export function computeSolution() {
  const p = rt.player;
  if (!p || !p.alive) { rt.solution = null; return; }
  let best = null;
  if (rt.aimOverride) {
    // api-driven aim (headless play): a world point, ship snap by proximity
    _v1.set(rt.aimOverride.x, -2.5, rt.aimOverride.z);
    let bd = 70;
    for (const s of rt.ships) {
      if (!s.alive) continue;
      const d = dist2D(s.pos.x, s.pos.z, _v1.x, _v1.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (rt.aimOverride.ship?.alive) best = rt.aimOverride.ship;
  } else {
    // base point: aim ray ∩ shallow plane (where shipping lives)
    let t;
    if (Math.abs(aimDir.y) > 0.02) t = (-2.5 - aimOrigin.y) / aimDir.y;
    if (!t || t < 0 || t > 2400) t = 700;
    _v1.copy(aimOrigin).addScaledVector(aimDir, t);

    // soft lock: nearest surface ship close to the aim ray
    let bestD = 38;
    for (const s of rt.ships) {
      if (!s.alive) continue;
      _v2.set(s.pos.x, -s.spec.draft * 0.5, s.pos.z).sub(aimOrigin);
      const along = _v2.dot(aimDir);
      if (along < 20) continue;
      const perp = Math.sqrt(Math.max(0, _v2.lengthSq() - along * along));
      const slack = bestD + s.spec.len * 0.18;
      if (perp < slack) { best = s; bestD = perp - s.spec.len * 0.18; }
    }
  }
  const sol = { ship: best, locked: false, run: 0, range: 0, x: _v1.x, y: -2.5, z: _v1.z };
  if (best) {
    // constant-bearing intercept: |D + V·t| = w·t
    const w = CFG.torpedo.speed;
    const vx = Math.sin(best.heading) * best.speed, vz = Math.cos(best.heading) * best.speed;
    const dx = best.pos.x - p.pos.x, dz = best.pos.z - p.pos.z;
    const a = vx * vx + vz * vz - w * w;
    const b = 2 * (dx * vx + dz * vz);
    const c = dx * dx + dz * dz;
    let ti = -1;
    if (Math.abs(a) < 1e-4) ti = -c / b;
    else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const r0 = (-b - Math.sqrt(disc)) / (2 * a), r1 = (-b + Math.sqrt(disc)) / (2 * a);
        ti = r0 > 0 ? r0 : r1;
      }
    }
    if (ti > 0 && ti * w < CFG.torpedo.range) {
      sol.locked = true;
      sol.run = ti;
      sol.x = best.pos.x + vx * ti;
      sol.z = best.pos.z + vz * ti;
      sol.y = -best.spec.draft * 0.55;
    }
  }
  sol.range = dist2D(sol.x, sol.z, p.pos.x, p.pos.z);
  rt.solution = sol;
}

export function playerFire() {
  const p = rt.player;
  if (!p || !p.alive || rt.state !== 'PLAYING' || rt.paused) return false;
  const tube = p.tubes.findIndex((t) => t <= 0);
  if (tube === -1) { feed('ALL TUBES RELOADING', 'bad'); return false; }
  p.tubes[tube] = CFG.torpedo.reloadT;
  const sol = rt.solution;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const ox = p.pos.x + fx * 17, oz = p.pos.z + fz * 17, oy = p.pos.y;
  const mesh = buildTorpedo();
  mesh.position.set(ox, oy, oz);
  scene.add(mesh);
  const target = sol
    ? new THREE.Vector3(sol.x, Math.min(sol.y, -2), sol.z)
    : new THREE.Vector3(p.pos.x + fx * 800, -3, p.pos.z + fz * 800);
  rt.torpedoes.push({
    pos: new THREE.Vector3(ox, oy, oz),
    dir: new THREE.Vector3(fx, 0, fz),
    target, dist: 0, alive: true, mesh, wakeAcc: 0, whineT: 0.4,
  });
  // launch transient + bubble blast out of the tube
  p.transient += CFG.noise.fireTransient;
  sfx.torpedoLaunch(ox, oz);
  for (let i = 0; i < 16; i++) {
    glowP.spawn({
      x: ox, y: oy, z: oz,
      vx: fx * rand(4, 10) + randSpread(2), vy: rand(0, 2), vz: fz * rand(4, 10) + randSpread(2),
      c0: COL.bubble0, c1: COL.bubble1, life: rand(0.8, 1.8), s0: rand(0.3, 0.7), s1: rand(0.5, 1),
      a: 0.7, grav: -4, drag: 1.8, wob: 1.5, curve: 3,
    });
  }
  rt.stats.fired++;
  rt.lastLaunch = { x: ox, z: oz, t: rt.simTime };
  // a torpedo in the water is hard to miss — nearby escorts mark the origin
  for (const s of rt.ships) {
    if (!s.alive || s.role !== 'escort') continue;
    if (dist2D(s.pos.x, s.pos.z, ox, oz) < CFG.detection.wakeSpotR + (depthOf(oy) < 20 ? 160 : 0)) {
      s.sus = Math.max(s.sus, CFG.detection.investigateAt + 0.08);
      s.lkp.x = ox; s.lkp.z = oz; s.lkp.err = 90;
      s.depthEst = depthOf(oy);
    }
  }
  return true;
}

// ---------------------------------------------------------------- update: player
let creakT = 0, cavWas = false, edgeT = 0;
export function updatePlayer(dt) {
  const p = rt.player;
  const C = CFG.player;
  // telegraph → speed
  const targetSpeed = C.telegraph[TELEGRAPH_KEYS[p.telegraphIdx]] * (p.silent ? 1 : 1);
  p.speed = damp(p.speed, targetSpeed, C.accel / Math.max(1, Math.abs(targetSpeed - p.speed)), dt * 3);
  // rudder
  const way = clamp(Math.abs(p.speed) / C.telegraph.full, 0, 1);
  const yawAuth = C.yawRate * (C.yawMinWay + (1 - C.yawMinWay) * way) * (p.speed < -0.5 ? -1 : 1);
  let rudder = 0;
  if (keys.has('KeyA')) rudder = 1;
  if (keys.has('KeyD')) rudder = -1;
  p.heading += rudder * yawAuth * dt;
  // ballast
  let vTarget = 0;
  if (keys.has('KeyQ')) vTarget = -C.vertRate;
  if (keys.has('KeyE')) vTarget = C.vertRate;
  p.vSpeed = damp(p.vSpeed, vTarget, 4, dt);
  // integrate
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  p.pos.x += fx * p.speed * dt;
  p.pos.z += fz * p.speed * dt;
  p.pos.y += p.vSpeed * dt;

  // surface + floor
  if (p.pos.y > -2) { p.pos.y = -2; p.vSpeed = Math.min(0, p.vSpeed); }
  const floorY = seabedH(p.pos.x, p.pos.z);
  if (p.pos.y < floorY + 2.8) {
    const impact = Math.max(-p.vSpeed - 3, Math.abs(p.speed) - 4);
    if (impact > 0) {
      damagePlayer(impact * C.ramDmgMul, 'GROUNDING');
      addTrauma(0.3);
      sfx.creak();
      boom(p.pos.x, floorY + 2, p.pos.z, 0.5, { silent: true });
      feed('HULL SCRAPING BOTTOM', 'bad');
    } else if (Math.abs(p.speed) < 1.5 && p.vSpeed < 0) {
      // gentle landing: bottomed, hiding in the clutter
    }
    p.pos.y = floorY + 2.8;
    p.vSpeed = Math.max(0, p.vSpeed);
  }
  // patrol-grid edge
  const r = Math.hypot(p.pos.x, p.pos.z);
  if (r > CFG.world.bound) {
    p.pos.x *= CFG.world.bound / r;
    p.pos.z *= CFG.world.bound / r;
    edgeT -= dt;
    if (edgeT <= 0) { edgeT = 4; feed('EDGE OF PATROL GRID', 'bad'); }
  }

  // depth bookkeeping
  const pd = depthOf(p.pos.y);
  rt.stats.deepest = Math.max(rt.stats.deepest, pd);

  // crush depth: the deep squeezes
  if (pd > CFG.world.crushDepth) {
    const over = pd - CFG.world.crushDepth;
    damagePlayer(C.crushDps * (over / 10) * dt, 'HULL IMPLOSION');
    creakT -= dt * (1 + over / 18);
    if (creakT <= 0) {
      creakT = rand(0.5, 1.6);
      sfx.creak();
      p.transient += CFG.noise.creak;
      addTrauma(0.12);
    }
    if (over > 55 && p.alive) { // instant implosion
      damagePlayer(9999, 'HULL IMPLOSION');
    }
  } else if (pd > CFG.world.crushDepth - 30) {
    creakT -= dt * 0.4;
    if (creakT <= 0) { creakT = rand(1.5, 4); sfx.creak(); }
  }

  // cavitation: speed vs depth-raised threshold
  const cavThresh = CFG.noise.cavBaseSpeed + pd * CFG.noise.cavPerMeter;
  p.cav = Math.abs(p.speed) > cavThresh;
  if (p.cav) {
    cavitation(p.pos.x - fx * 16, p.pos.y, p.pos.z - fz * 16, dt, Math.abs(p.speed) / 10);
    if (!cavWas) feed('PROPELLER CAVITATING — WE ARE LOUD', 'bad');
  }
  cavWas = p.cav;

  // noise signature
  p.transient = Math.max(0, p.transient - CFG.noise.transientDecay * dt);
  let base = CFG.noise[TELEGRAPH_KEYS[p.telegraphIdx]];
  if (p.silent) base *= C.silentNoiseMul;
  p.noise = base + (p.cav ? CFG.noise.cavExtra : 0) + p.transient;

  // tubes: sequential reload, paused while rigged for silent
  if (!p.silent) {
    const loading = p.tubes.findIndex((t) => t > 0);
    if (loading !== -1) {
      p.tubes[loading] -= dt;
      if (p.tubes[loading] <= 0) { p.tubes[loading] = 0; sfx.tubeReady(); }
    }
  }
  p.pingCd = Math.max(0, p.pingCd - dt);

  // visuals: lean into the dive, heel into the turn, spin the prop
  p.pitch = damp(p.pitch, clamp(-p.vSpeed * 0.045, -0.3, 0.3), 5, dt);
  p.roll = damp(p.roll, rudder * way * -0.09, 5, dt);
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.set(p.pitch, p.heading, p.roll, 'YXZ');
  if (p.mesh.userData.prop) p.mesh.userData.prop.rotation.z += p.speed * dt * 2.4;
}

export function titleIdle(dt) {
  // slow ghost cruise on the title screen
  const p = rt.player; if (!p) return;
  p.heading += dt * 0.02;
  p.pos.x += Math.sin(p.heading) * 2.2 * dt;
  p.pos.z += Math.cos(p.heading) * 2.2 * dt;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.set(0, p.heading, 0);
  if (p.mesh.userData.prop) p.mesh.userData.prop.rotation.z += dt * 5;
}

// ---------------------------------------------------------------- ships
let convoySeq = 0;
const centroids = new Map(); // convoyId -> {x,z,n}

export function spawnShip(kind, opts = {}) {
  const spec = { ...CFG.ships[kind] };
  const role = (kind === 'escort' || kind === 'hunter') ? 'escort' : 'merchant';
  const p = rt.player;
  let x, z, heading;
  if (opts.x !== undefined) {
    x = opts.x; z = opts.z; heading = opts.heading ?? rand(0, Math.PI * 2);
  } else {
    const brg = opts.bearing ?? rand(0, Math.PI * 2);
    const d = opts.dist ?? 700;
    x = (p ? p.pos.x : 0) + Math.sin(brg) * d;
    z = (p ? p.pos.z : 0) + Math.cos(brg) * d;
    heading = opts.heading ?? rand(0, Math.PI * 2);
  }
  const mesh = buildShip(kind === 'hunter' ? 'escort' : kind);
  if (kind === 'hunter') mesh.scale.setScalar(1.08);
  scene.add(mesh);
  const s = {
    kind, role, spec,
    pos: new THREE.Vector3(x, 0, z),
    heading, speed: spec.speed * 0.6, targetSpeed: spec.speed,
    hp: spec.hp, alive: true,
    convoyId: opts.convoyId ?? -1,
    zigPhase: rand(0, 9), laneH: heading,
    name: role === 'merchant' ? MERCH_NAMES[Math.floor(rand(0, MERCH_NAMES.length))] : '',
    ton: Math.round(rand(spec.tonLo, spec.tonHi) / 10) * 10,
    mesh, fxAnchor: { x, y: 0, z, dead: false },
    sinking: null, groanT: 1,
    // escort brain
    sus: opts.sus ?? 0, state: 'patrol',
    lkp: { x: 0, z: 0, err: CFG.detection.lkpErrBase },
    depthEst: 30, pingT: rand(2, 6), deafT: 0,
    dropsLeft: 0, dropT: 0, runT: 0, gunT: 0,
    stationA: rand(0, Math.PI * 2), stationR: rand(130, 200),
    searchA: rand(0, Math.PI * 2), announced: false,
  };
  if (opts.lkp) { s.lkp.x = opts.lkp.x; s.lkp.z = opts.lkp.z; s.state = 'investigate'; s.sus = Math.max(s.sus, CFG.detection.investigateAt + 0.05); }
  rt.ships.push(s);
  return s;
}

export function spawnConvoy(merchN, escortN, announce = true) {
  const id = convoySeq++;
  const p = rt.player;
  const a = rand(0, Math.PI * 2);
  const off = randSpread(520);
  // lane: enters at the rim, passes within |off| of the centre
  const ex = Math.cos(a) * CFG.world.bound * 1.05, ez = Math.sin(a) * CFG.world.bound * 1.05;
  const heading = Math.atan2(-ex, -ez) + randSpread(CFG.convoys.routeJitter);
  const px = ex + Math.cos(a + Math.PI / 2) * off, pz = ez + Math.sin(a + Math.PI / 2) * off;
  const hx = Math.sin(heading), hz = Math.cos(heading);
  merchN = Math.round(merchN); escortN = Math.round(escortN);
  for (let i = 0; i < merchN; i++) {
    const kind = Math.random() < 0.3 ? 'tanker' : 'freighter';
    spawnShip(kind, {
      x: px - hx * i * CFG.convoys.spacing + randSpread(14),
      z: pz - hz * i * CFG.convoys.spacing + randSpread(14),
      heading, convoyId: id,
    });
  }
  const escortKind = rt.heat > CFG.convoys.hunterPackHeat ? 'hunter' : 'escort';
  for (let i = 0; i < escortN; i++) {
    spawnShip(i === 0 && escortN > 1 ? 'escort' : escortKind, {
      x: px + Math.cos((i / escortN) * Math.PI * 2) * 170 - hx * 40,
      z: pz + Math.sin((i / escortN) * Math.PI * 2) * 170 - hz * 40,
      heading, convoyId: id,
    });
  }
  rt.stats.convoys++;
  if (announce && p) {
    const brg = fmt(bearingTo(p.pos.x, p.pos.z, px, pz), 3);
    banner('CONVOY REPORTED', `BEARING ${brg} — ${merchN} MERCHANTS · ${escortN} ESCORTS`);
    feed(`CONTACT REPORT — CONVOY BEARING ${brg}`);
    sfx.contact();
  }
  return id;
}

export function spawnHunters() {
  const p = rt.player; if (!p) return;
  const brg = rand(0, Math.PI * 2);
  const n = rt.heat > 3 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    spawnShip('hunter', {
      bearing: brg + randSpread(0.3), dist: rand(1050, 1300),
      lkp: { x: p.pos.x + randSpread(280), z: p.pos.z + randSpread(280) },
    });
  }
  banner('HUNTER GROUP INBOUND', 'THEY KNOW A BOAT IS OUT HERE');
  feed('HIGH-SPEED SCREWS — HUNTER GROUP', 'bad');
}

export function damageShip(s, dmg) {
  if (!s.alive) return;
  s.hp -= dmg;
  if (s.hp <= 0) killShip(s);
}

export function killShip(s) {
  if (!s.alive) return;
  s.alive = false;
  s.groanT = rand(0.4, 1.2);
  const isTanker = s.kind === 'tanker';
  s.sinking = {
    t: 0, vy: 0, settled: false,
    pitchDir: Math.random() < 0.5 ? 1 : -1,
    pitch: 0, roll: 0,
    burnT: isTanker ? 11 : 0,
  };
  // score
  if (rt.state === 'PLAYING') {
    if (s.role === 'merchant') {
      rt.stats.tonnage += s.ton;
      rt.stats.ships++;
      feed(`${isTanker ? 'MV' : 'SS'} ${s.name} GOING DOWN — ${s.ton.toLocaleString('en-US')} t`, 'good');
      if (isTanker) banner('TANKER ABLAZE', `${s.ton.toLocaleString('en-US')} TONS BURNING`);
      // convoy annihilation bonus
      if (s.convoyId >= 0 && !rt.ships.some((o) => o !== s && o.alive && o.role === 'merchant' && o.convoyId === s.convoyId)) {
        rt.stats.tonnage += CFG.score.convoyClearBonus;
        banner('CONVOY ANNIHILATED', `+${CFG.score.convoyClearBonus.toLocaleString('en-US')} t BONUS`);
      }
    } else {
      rt.stats.tonnage += s.ton + CFG.score.escortBonus;
      rt.stats.ships++;
      feed(`ESCORT DESTROYED — +${(s.ton + CFG.score.escortBonus).toLocaleString('en-US')} t`, 'good');
    }
    rt.heat = rt.stats.tonnage * CFG.convoys.heatPerTon;
    updateScoreHud();
    // a kill wakes the screen: escorts in earshot run down the wake bearing
    const ll = rt.lastLaunch;
    if (ll && rt.simTime - ll.t < 70) {
      for (const e of rt.ships) {
        if (!e.alive || e.role !== 'escort') continue;
        if (dist2D(e.pos.x, e.pos.z, s.pos.x, s.pos.z) > 950) continue;
        if (e.sus < CFG.detection.investigateAt + 0.12) {
          e.sus = CFG.detection.investigateAt + 0.12;
          e.lkp.x = ll.x + randSpread(220);
          e.lkp.z = ll.z + randSpread(220);
          e.depthEst = 14;
        }
      }
    }
  }
  // pyrotechnics
  breach(s.pos.x, -s.spec.draft * 0.5, s.pos.z, s.role === 'merchant' ? 1.6 : 1.2);
  hitstop(CFG.vfx.hitstopT);
  s.fxAnchor.x = s.pos.x; s.fxAnchor.y = -2; s.fxAnchor.z = s.pos.z;
  addEmitter({ ref: s.fxAnchor, rate: 30, until: rt.simTime + 26, kind: 'bubbles', spread: s.spec.len * 0.3 });
  addEmitter({ ref: s.fxAnchor, rate: 9, until: rt.simTime + 20, kind: 'oil', spread: s.spec.len * 0.25, offY: 2 });
  if (isTanker) addEmitter({ ref: s.fxAnchor, rate: 34, until: rt.simTime + s.sinking.burnT, kind: 'fire', spread: s.spec.len * 0.3 });
}

function escortBrain(s, dt) {
  const p = rt.player;
  const D = CFG.detection;
  s.deafT = Math.max(0, s.deafT - dt);
  const acuity = s.spec.acuity * (1 + rt.heat * 0.05);

  // ---- listen for the player (and be fooled by decoys)
  let signal = 0, srcX = 0, srcZ = 0, srcDepth = 30;
  if (p && p.alive) {
    const d = dist2D(s.pos.x, s.pos.z, p.pos.x, p.pos.z);
    const pd = depthOf(p.pos.y);
    let eff = p.noise * layerAttenBetween(p.pos.y, -2);
    if (p.pos.y - seabedH(p.pos.x, p.pos.z) < D.bottomDist + 2.8) eff *= D.bottomAtten;
    if (s.deafT > 0) eff *= D.deafMul;
    signal = (eff / 100) * clamp(1 - d / (D.passiveR * acuity), 0, 1);
    // visual spotting: scope feather or surfaced hull
    if (pd < 14 && s.deafT <= 0) {
      const visFrac = (14 - pd) / 14;
      const visR = lerp(D.visPeriscopeR, D.visSurfacedR, visFrac);
      signal = Math.max(signal, D.visRate * visFrac * clamp(1 - d / visR, 0, 1));
    }
    srcX = p.pos.x; srcZ = p.pos.z; srcDepth = pd;
  }
  for (const dec of rt.decoys) {
    const d = dist2D(s.pos.x, s.pos.z, dec.x, dec.z);
    const sig = (CFG.decoy.noise / 100) * clamp(1 - d / (D.passiveR * acuity), 0, 1) * (s.deafT > 0 ? D.deafMul : 1);
    if (sig > signal) { signal = sig; srcX = dec.x; srcZ = dec.z; srcDepth = depthOf(dec.y); }
  }

  if (signal > D.susThresh) {
    s.sus = clamp(s.sus + D.susRate * signal * dt * acuity, 0, 1);
    const err = lerp(D.lkpErrBase, D.lkpErrMin, s.sus);
    s.lkp.x = srcX + randSpread(err);
    s.lkp.z = srcZ + randSpread(err);
    s.lkp.err = err;
    s.depthEst = srcDepth + randSpread(D.depthErrBase * (1 - s.sus));
  } else {
    s.sus = Math.max(0, s.sus - D.susDecay * dt);
  }

  // ---- state machine
  const prevState = s.state;
  if (s.sus >= D.attackAt) s.state = 'attack';
  else if (s.sus >= D.investigateAt) s.state = s.state === 'attack' ? 'attack' : 'investigate';
  else if (s.sus < D.investigateAt * 0.6) s.state = 'patrol';
  if (s.state !== prevState && s.state === 'attack' && rt.state === 'PLAYING') {
    feed('ESCORT TURNING IN — ATTACK RUN', 'bad');
  }

  // ---- active sonar
  if (s.state !== 'patrol' && s.deafT <= 0) {
    s.pingT -= dt;
    if (s.pingT <= 0) {
      s.pingT = s.spec.pingPeriod * (s.state === 'attack' ? 0.62 : 1) * rand(0.85, 1.15);
      const maxR = D.activeR * acuity;
      rt.pings.push({ x: s.pos.x, y: -3, z: s.pos.z, r: 1, maxR, mine: false, src: s, hitPlayer: false });
      pingRing(s.pos.x, -4, s.pos.z, maxR, false);
      if (p) sfx.enemyPing(s.pos.x, s.pos.z, dist2D(s.pos.x, s.pos.z, p.pos.x, p.pos.z) / 1500);
    }
  }

  // ---- movement target
  let tx, tz, spd = s.spec.speed;
  if (s.state === 'patrol') {
    const c = centroids.get(s.convoyId);
    if (c && c.n > 0) {
      s.stationA += dt * 0.07;
      tx = c.x + Math.cos(s.stationA) * s.stationR;
      tz = c.z + Math.sin(s.stationA) * s.stationR;
    } else {
      // orphaned escort: sweep around its own beat
      s.stationA += dt * 0.05;
      tx = s.pos.x + Math.cos(s.stationA) * 80;
      tz = s.pos.z + Math.sin(s.stationA) * 80;
    }
  } else {
    const dLkp = dist2D(s.pos.x, s.pos.z, s.lkp.x, s.lkp.z);
    if (s.state === 'attack') {
      spd = s.spec.sprint;
      if (s.runT > 0) { // opening back out after a run
        s.runT -= dt;
        tx = s.pos.x + Math.sin(s.heading) * 80;
        tz = s.pos.z + Math.cos(s.heading) * 80;
      } else {
        tx = s.lkp.x; tz = s.lkp.z;
        if (dLkp < 34 && s.dropsLeft <= 0 && s.runT <= 0) {
          s.dropsLeft = CFG.charges.perRun;
          s.dropT = 0;
          if (rt.state === 'PLAYING') feed('DEPTH CHARGES IN THE WATER', 'bad');
        }
      }
    } else { // investigate
      spd = s.spec.sprint * 0.78;
      if (dLkp > 70) { tx = s.lkp.x; tz = s.lkp.z; }
      else {
        s.searchA += dt * 0.32;
        tx = s.lkp.x + Math.cos(s.searchA) * 110;
        tz = s.lkp.z + Math.sin(s.searchA) * 110;
        spd = s.spec.speed;
      }
    }
  }

  // ---- depth charge drops
  if (s.dropsLeft > 0) {
    s.dropT -= dt;
    if (s.dropT <= 0) {
      s.dropT = CFG.charges.interval;
      s.dropsLeft--;
      dropCharge(s);
      if (s.dropsLeft <= 0) s.runT = CFG.charges.runCooldown;
    }
  }

  // ---- deck gun vs a shallow boat
  if (p && p.alive && s.state !== 'patrol') {
    const pd = depthOf(p.pos.y);
    const d = dist2D(s.pos.x, s.pos.z, p.pos.x, p.pos.z);
    if (pd < CFG.world.periscopeDepth && d < s.spec.gunRange && s.sus > 0.5) {
      s.gunT -= dt;
      if (s.gunT <= 0) {
        s.gunT = s.spec.gunPeriod * rand(0.85, 1.2);
        fireDeckGun(s);
      }
    }
  }

  return { tx, tz, spd };
}

function fireDeckGun(s) {
  const p = rt.player;
  sfx.gunReport(s.pos.x, s.pos.z);
  spawnFlash(s.pos.x, 5, s.pos.z, 180, 0.12, 0xffd9a0);
  const flight = 1.15;
  const scatter = 4 + dist2D(s.pos.x, s.pos.z, p.pos.x, p.pos.z) * 0.012;
  const tx = p.pos.x + Math.sin(p.heading) * p.speed * flight + randSpread(scatter);
  const tz = p.pos.z + Math.cos(p.heading) * p.speed * flight + randSpread(scatter);
  rt.shellsplashes.push({ tx, tz, t: flight, src: s });
}

function dropCharge(s) {
  const hx = Math.sin(s.heading), hz = Math.cos(s.heading);
  const x = s.pos.x - hx * 22 + randSpread(8);
  const z = s.pos.z - hz * 22 + randSpread(8);
  const mesh = buildCharge();
  mesh.position.set(x, -1, z);
  mesh.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  scene.add(mesh);
  const fuseDepth = clamp(s.depthEst + randSpread(CFG.charges.fuseJitter), 8, depthOf(seabedH(x, z)) - 2);
  rt.charges.push({ pos: new THREE.Vector3(x, -1, z), fuseY: -fuseDepth, alive: true, mesh, spin: randSpread(2) });
  splashIn(x, z);
}

export function updateShips(dt) {
  // convoy centroids (alive merchants only)
  centroids.clear();
  for (const s of rt.ships) {
    if (!s.alive || s.role !== 'merchant' || s.convoyId < 0) continue;
    let c = centroids.get(s.convoyId);
    if (!c) { c = { x: 0, z: 0, n: 0 }; centroids.set(s.convoyId, c); }
    c.x += s.pos.x; c.z += s.pos.z; c.n++;
  }
  for (const c of centroids.values()) { c.x /= c.n; c.z /= c.n; }

  for (let i = rt.ships.length - 1; i >= 0; i--) {
    const s = rt.ships[i];

    if (!s.alive) { // sinking ballet
      const k = s.sinking;
      k.t += dt;
      s.fxAnchor.x = s.pos.x; s.fxAnchor.z = s.pos.z; s.fxAnchor.y = Math.max(s.pos.y - 2, -40);
      s.groanT -= dt;
      if (s.groanT <= 0 && s.pos.y > -120) { s.groanT = rand(1.4, 3.2); sfx.groan(s.pos.x, s.pos.z); }
      if (k.burnT > 0) { k.burnT -= dt; }
      else {
        k.vy = Math.min(k.vy + dt * 0.55, 6.5);
        s.pos.y -= k.vy * dt;
        k.pitch = damp(k.pitch, 0.5 * k.pitchDir, 0.5, dt);
        k.roll = damp(k.roll, 0.35, 0.3, dt);
      }
      s.speed = damp(s.speed, 0, 0.8, dt);
      s.pos.x += Math.sin(s.heading) * s.speed * dt;
      s.pos.z += Math.cos(s.heading) * s.speed * dt;
      const floorY = seabedH(s.pos.x, s.pos.z);
      if (s.pos.y < floorY + 3 && !k.settled) {
        k.settled = true;
        s.fxAnchor.dead = true;
        boom(s.pos.x, floorY + 3, s.pos.z, 0.9, { silent: true });
        rt.wrecks.push(s.mesh);
        if (rt.wrecks.length > 12) scene.remove(rt.wrecks.shift());
        rt.ships.splice(i, 1);
        continue;
      }
      s.mesh.position.copy(s.pos);
      s.mesh.rotation.set(k.pitch, s.heading, k.roll, 'YXZ');
      continue;
    }

    // alive: brain + motion
    let tx, tz, spd;
    if (s.role === 'escort') {
      ({ tx, tz, spd } = escortBrain(s, dt));
    } else {
      // merchants plod the lane with a lazy zigzag
      const zig = Math.sin(rt.simTime * (Math.PI * 2 / 52) + s.zigPhase) * 0.15;
      s.heading = angleTo(s.heading, s.laneH + zig, s.spec.yaw * dt);
      spd = s.spec.speed;
      tx = null;
    }
    if (tx !== null && tx !== undefined) {
      const want = Math.atan2(tx - s.pos.x, tz - s.pos.z);
      s.heading = angleTo(s.heading, want, s.spec.yaw * dt);
    }
    s.speed = damp(s.speed, spd, s.spec.accel, dt);
    s.pos.x += Math.sin(s.heading) * s.speed * dt;
    s.pos.z += Math.cos(s.heading) * s.speed * dt;

    // escort separation (cheap pairwise nudge)
    if (s.role === 'escort') {
      for (const o of rt.ships) {
        if (o === s || !o.alive || o.role !== 'escort') continue;
        const d = dist2D(s.pos.x, s.pos.z, o.pos.x, o.pos.z);
        if (d < 30 && d > 0.1) {
          s.pos.x += (s.pos.x - o.pos.x) / d * 6 * dt;
          s.pos.z += (s.pos.z - o.pos.z) / d * 6 * dt;
        }
      }
    }

    // despawn far beyond the grid (merchants escape, calm escorts leave)
    const rr = Math.hypot(s.pos.x, s.pos.z);
    if (rr > CFG.world.bound * 1.45 && (s.role === 'merchant' || s.sus < CFG.detection.investigateAt)) {
      scene.remove(s.mesh);
      rt.ships.splice(i, 1);
      continue;
    }

    // visuals: heel into turns, slight bob
    s.mesh.position.copy(s.pos);
    s.mesh.rotation.set(
      Math.sin(rt.simTime * 0.6 + s.zigPhase) * 0.012,
      s.heading,
      Math.sin(rt.simTime * 0.5 + s.zigPhase) * 0.018,
      'YXZ');
    // sprinting escorts churn the surface
    if (s.role === 'escort' && s.speed > s.spec.speed * 1.1 && Math.random() < dt * 8) {
      spawnFoam(s.pos.x - Math.sin(s.heading) * 20, s.pos.z - Math.cos(s.heading) * 20, 5, 0.8);
    }
  }

  // ---- scheduler (patrol mode only)
  if (!rt.noWaves && rt.state === 'PLAYING') {
    convoyT -= dt;
    if (convoyT <= 0) {
      const period = Math.max(CFG.convoys.periodMin, CFG.convoys.period - rt.heat * 9);
      convoyT = period * rand(0.85, 1.2);
      const merchAlive = rt.ships.reduce((n, s) => n + (s.alive && s.role === 'merchant' ? 1 : 0), 0);
      if (merchAlive < 14) {
        const m = Math.round(rand(CFG.convoys.merchLo, CFG.convoys.merchHi));
        const e = Math.round(clamp(CFG.convoys.escortsBase + rt.heat, CFG.convoys.escortsBase, CFG.convoys.escortsMax));
        spawnConvoy(m, e);
      }
    }
    if (rt.heat >= CFG.convoys.hunterPackHeat) {
      hunterT -= dt;
      if (hunterT <= 0) {
        hunterT = CFG.convoys.hunterPackPeriod * rand(0.8, 1.25);
        spawnHunters();
      }
    }
  }
}
let convoyT = 0, hunterT = 0;

// ---------------------------------------------------------------- ordnance
export function updateOrdnance(dt) {
  const p = rt.player;

  // torpedoes
  for (let i = rt.torpedoes.length - 1; i >= 0; i--) {
    const t = rt.torpedoes[i];
    if (!t.alive) { scene.remove(t.mesh); rt.torpedoes.splice(i, 1); continue; }
    // gyro steer toward the solution point
    _v1.copy(t.target).sub(t.pos).normalize();
    const maxStep = CFG.torpedo.turnRate * dt;
    const dot = clamp(t.dir.dot(_v1), -1, 1);
    const ang = Math.acos(dot);
    if (ang > 1e-3) {
      const f = Math.min(1, maxStep / ang);
      t.dir.lerp(_v1, f).normalize();
    }
    t.pos.addScaledVector(t.dir, CFG.torpedo.speed * dt);
    t.dist += CFG.torpedo.speed * dt;
    t.mesh.position.copy(t.pos);
    t.mesh.rotation.y = Math.atan2(t.dir.x, t.dir.z);
    t.mesh.rotation.x = -Math.asin(clamp(t.dir.y, -1, 1));
    // bubble wake
    t.wakeAcc += dt * CFG.torpedo.wakeRate * CFG.vfx.particleMul;
    while (t.wakeAcc > 1) { t.wakeAcc -= 1; wake(t.pos.x, t.pos.y, t.pos.z, dt, 1); }
    t.whineT -= dt;
    if (t.whineT <= 0) { t.whineT = 0.5; sfx.torpedoWhine(t.pos.x, t.pos.z); }
    // out of fuel
    if (t.dist > CFG.torpedo.range) {
      t.alive = false;
      boom(t.pos.x, t.pos.y, t.pos.z, 0.25, { silent: true });
      if (rt.state === 'PLAYING') feed('TORPEDO — END OF RUN, NO HIT', 'bad');
      continue;
    }
    // seabed
    if (t.pos.y < seabedH(t.pos.x, t.pos.z) + 1) {
      t.alive = false;
      boom(t.pos.x, t.pos.y, t.pos.z, 0.8);
      continue;
    }
    // hulls
    if (t.dist > CFG.torpedo.armDist) {
      for (const s of rt.ships) {
        if (!s.alive) continue;
        const hx = Math.sin(s.heading), hz = Math.cos(s.heading);
        const half = s.spec.len * 0.5 - 2;
        const cy = -s.spec.draft * 0.55;
        _v1.set(t.pos.x - s.pos.x, t.pos.y - cy, t.pos.z - s.pos.z);
        const along = clamp(_v1.x * hx + _v1.z * hz, -half, half);
        const cxp = s.pos.x + hx * along, czp = s.pos.z + hz * along;
        const d = Math.sqrt((t.pos.x - cxp) ** 2 + (t.pos.y - cy) ** 2 + (t.pos.z - czp) ** 2);
        if (d < CFG.torpedo.fuseR + s.spec.beam * 0.45) {
          t.alive = false;
          rt.stats.hits++;
          damageShip(s, CFG.torpedo.dmg);
          if (s.alive) { // hit but afloat
            breach(t.pos.x, cy, t.pos.z, 1.1);
            feed(`TORPEDO IMPACT — ${s.name || 'ESCORT'} HOLDING`, 'good');
          }
          break;
        }
      }
    }
  }

  // depth charges
  let near = false;
  for (let i = rt.charges.length - 1; i >= 0; i--) {
    const c = rt.charges[i];
    c.pos.y -= CFG.charges.sinkRate * dt;
    c.mesh.position.copy(c.pos);
    c.mesh.rotation.x += c.spin * dt; c.mesh.rotation.z += c.spin * 0.7 * dt;
    if (p && dist2D(c.pos.x, c.pos.z, p.pos.x, p.pos.z) < 160) near = true;
    if (c.pos.y <= c.fuseY || c.pos.y < seabedH(c.pos.x, c.pos.z) + 1.5) {
      scene.remove(c.mesh);
      rt.charges.splice(i, 1);
      boom(c.pos.x, c.pos.y, c.pos.z, 1.5, { charge: true });
      // hurt the boat
      if (p && p.alive) {
        const d = _v1.set(c.pos.x - p.pos.x, c.pos.y - p.pos.y, c.pos.z - p.pos.z).length();
        if (d < CFG.charges.blastR) {
          const f = d < CFG.charges.lethalR ? 1 : 1 - (d - CFG.charges.lethalR) / (CFG.charges.blastR - CFG.charges.lethalR);
          damagePlayer(CFG.charges.dmg * f, 'DEPTH CHARGE');
          addTrauma(0.3 + f * 0.5);
          if (f > 0.35) hitstop(CFG.vfx.hitstopT);
        } else if (d < CFG.charges.blastR * 3) {
          addTrauma(0.18);
        }
      }
      // blast pops decoys, deafens every sonar nearby
      for (let j = rt.decoys.length - 1; j >= 0; j--) {
        if (dist2D(c.pos.x, c.pos.z, rt.decoys[j].x, rt.decoys[j].z) < CFG.charges.blastR) {
          scene.remove(rt.decoys[j].mesh);
          rt.decoys.splice(j, 1);
        }
      }
      for (const s of rt.ships) {
        if (s.alive && s.role === 'escort' && dist2D(c.pos.x, c.pos.z, s.pos.x, s.pos.z) < CFG.detection.deafR) {
          s.deafT = CFG.detection.deafT;
        }
      }
    }
  }
  rt.chargesNear = near;

  // deck-gun shells
  for (let i = rt.shellsplashes.length - 1; i >= 0; i--) {
    const sh = rt.shellsplashes[i];
    sh.t -= dt;
    if (sh.t > 0) continue;
    rt.shellsplashes.splice(i, 1);
    if (p && p.alive && depthOf(p.pos.y) < CFG.world.periscopeDepth + 3 && dist2D(sh.tx, sh.tz, p.pos.x, p.pos.z) < 8) {
      damagePlayer(sh.src.spec.gunDmg, 'GUNFIRE');
      boom(p.pos.x, p.pos.y + 1, p.pos.z, 0.5);
      addTrauma(0.3);
    } else {
      shellSplash(sh.tx, sh.tz);
    }
  }

  // decoys age out
  for (let i = rt.decoys.length - 1; i >= 0; i--) {
    const d = rt.decoys[i];
    d.t -= dt;
    if (d.t <= 0) { scene.remove(d.mesh); rt.decoys.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- acoustics
function upsertContact(ref, kind, x, z, strength, flash = 0) {
  let c = rt.contacts.find((c) => c.ref === ref);
  if (!c) {
    c = { ref, kind, x, z, strength, heard: true, flash, announced: false };
    rt.contacts.push(c);
  }
  c.kind = kind; c.x = x; c.z = z;
  c.strength = Math.max(c.strength, strength);
  c.heard = true;
  if (flash > 0) c.flash = flash;
  return c;
}

let announceT = 0;
export function updateAcoustics(dt) {
  const p = rt.player;
  const D = CFG.detection;
  announceT = Math.max(0, announceT - dt);

  for (const c of rt.contacts) c.heard = false;

  if (p && p.alive) {
    // passive listening: who do WE hear?
    const listenR = 1150;
    for (const s of rt.ships) {
      if (!s.alive) continue;
      let n = s.role === 'merchant' ? 62 : 26 + (s.speed / s.spec.speed) * 30 + (s.state !== 'patrol' ? 22 : 0);
      n *= layerAttenBetween(-2, p.pos.y);
      const d = dist2D(s.pos.x, s.pos.z, p.pos.x, p.pos.z);
      const sig = (n / 100) * clamp(1 - d / listenR, 0, 1);
      if (sig > 0.05) {
        const c = upsertContact(s, s.role, s.pos.x, s.pos.z, clamp(sig * 2.4, 0.2, 1));
        if (!c.announced && rt.state === 'PLAYING' && announceT <= 0) {
          c.announced = true;
          announceT = 1.6;
          feed(`SONAR CONTACT — ${s.role === 'escort' ? 'WARSHIP' : 'MERCHANT'} BEARING ${fmt(bearingTo(p.pos.x, p.pos.z, s.pos.x, s.pos.z), 3)}`);
          sfx.contact();
        }
      }
    }
    for (const t of rt.torpedoes) upsertContact(t, 'torpedo', t.pos.x, t.pos.z, 1);
    for (const d of rt.decoys) upsertContact(d, 'decoy', d.x, d.z, 0.8);
  }

  // contacts fade when unheard
  for (let i = rt.contacts.length - 1; i >= 0; i--) {
    const c = rt.contacts[i];
    if (!c.heard) c.strength -= dt * 0.12;
    if (c.strength <= 0.04 || (c.ref && c.ref.alive === false)) rt.contacts.splice(i, 1);
  }

  // ping wavefronts
  for (let i = rt.pings.length - 1; i >= 0; i--) {
    const ping = rt.pings[i];
    ping.r += D.pingSpeed * dt;
    if (ping.r >= ping.maxR) { rt.pings.splice(i, 1); continue; }
    if (ping.mine) {
      // my ping: reveal everything the front washes over
      for (const s of rt.ships) {
        if (!s.alive || ping.echoed.has(s)) continue;
        const d = dist2D(ping.x, ping.z, s.pos.x, s.pos.z);
        if (ping.r >= d) {
          ping.echoed.add(s);
          const strength = clamp(1 - d / ping.maxR, 0.2, 1);
          after(d / D.pingSpeed, () => {
            if (!s.alive) return;
            upsertContact(s, s.role, s.pos.x, s.pos.z, 1, 1.4);
            sfx.echo(0, strength, clamp((s.pos.x - (p ? p.pos.x : 0)) / 600, -0.8, 0.8));
          });
        }
      }
    } else if (p && p.alive && !ping.hitPlayer) {
      const d = dist2D(ping.x, ping.z, p.pos.x, p.pos.z);
      if (ping.r >= d) {
        ping.hitPlayer = true;
        const src = ping.src;
        let echo = clamp(1 - d / ping.maxR, 0, 1);
        echo *= layerAttenBetween(p.pos.y, -3) === 1 ? 1 : D.pingLayerAtten;
        if (p.pos.y - seabedH(p.pos.x, p.pos.z) < D.bottomDist) echo *= 0.3;
        if (echo > 0.16 && src && src.alive) {
          src.sus = Math.max(src.sus, D.attackAt + 0.08);
          src.lkp.x = p.pos.x + randSpread(D.lkpErrMin);
          src.lkp.z = p.pos.z + randSpread(D.lkpErrMin);
          src.depthEst = depthOf(p.pos.y) + randSpread(6);
          rt.pingFlash = 1;
          sfx.echoHit();
          if (rt.state === 'PLAYING') feed('ECHO RETURNED — THEY HOLD US', 'bad');
        } else if (echo > 0.05 && src && src.alive) {
          src.sus = clamp(src.sus + 0.18, 0, 1);
          rt.pingFlash = Math.max(rt.pingFlash, 0.45);
        }
      }
    }
  }

  // alert level + exposure meter
  let alert = 0, maxSig = 0;
  for (const s of rt.ships) {
    if (!s.alive || s.role !== 'escort') continue;
    if (s.state === 'attack') alert = 2;
    else if (s.state === 'investigate') alert = Math.max(alert, 1);
    if (p && p.alive) {
      const d = dist2D(s.pos.x, s.pos.z, p.pos.x, p.pos.z);
      let eff = p.noise * layerAttenBetween(p.pos.y, -2);
      if (p.pos.y - seabedH(p.pos.x, p.pos.z) < D.bottomDist + 2.8) eff *= D.bottomAtten;
      maxSig = Math.max(maxSig, (eff / 100) * clamp(1 - d / (D.passiveR * s.spec.acuity), 0, 1));
    }
  }
  rt.exposure = clamp(maxSig / (D.susThresh * 5), 0, 1);
  if (alert !== rt.alert) {
    rt.alert = alert;
    updateAlertHud();
    if (alert === 2 && rt.state === 'PLAYING') sfx.klaxon();
  }
}

// ---------------------------------------------------------------- state / death
export function hitstop(t) { rt.hitstopT = t; rt.timeScale = 0.12; }

function playerDeath(cause) {
  const p = rt.player;
  if (rt.state !== 'PLAYING') return;
  p.alive = false;
  p.hp = 0;
  rt.causeOfDeath = cause;
  rt.state = 'DYING';
  rt.timeScaleTarget = 0.45;
  sfx.gameover();
  if (cause === 'HULL IMPLOSION') {
    boom(p.pos.x, p.pos.y, p.pos.z, 2.6);
    boom(p.pos.x, p.pos.y - 4, p.pos.z, 1.8, { silent: true });
    addTrauma(1);
    hitstop(0.14);
  } else {
    boom(p.pos.x, p.pos.y + 2, p.pos.z, 1.4);
    addTrauma(0.8);
  }
  p.fxAnchor.x = p.pos.x; p.fxAnchor.y = p.pos.y; p.fxAnchor.z = p.pos.z; p.fxAnchor.dead = false;
  addEmitter({ ref: p.fxAnchor, rate: 36, until: rt.simTime + 8, kind: 'bubbles', spread: 8 });
  addEmitter({ ref: p.fxAnchor, rate: 8, until: rt.simTime + 6, kind: 'oil', spread: 5 });
  after(3.6, showGameOver);
}

export function updateDying(dt) {
  const p = rt.player; if (!p) return;
  p.speed = damp(p.speed, 0, 0.6, dt);
  p.vSpeed = damp(p.vSpeed, -4.5, 0.8, dt);
  p.pos.y += p.vSpeed * dt;
  p.pos.x += Math.sin(p.heading) * p.speed * dt;
  p.pos.z += Math.cos(p.heading) * p.speed * dt;
  const floorY = seabedH(p.pos.x, p.pos.z);
  if (p.pos.y < floorY + 2.6) { p.pos.y = floorY + 2.6; p.vSpeed = 0; }
  p.pitch = damp(p.pitch, -0.4, 0.7, dt);
  p.roll = damp(p.roll, 0.5, 0.4, dt);
  p.fxAnchor.x = p.pos.x; p.fxAnchor.y = p.pos.y; p.fxAnchor.z = p.pos.z;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.set(p.pitch, p.heading, p.roll, 'YXZ');
}

function showGameOver() {
  rt.state = 'GAMEOVER';
  saveRecords();
  const $ = (id) => document.getElementById(id);
  const s = rt.stats;
  if ($('stTon')) {
    $('stTon').textContent = s.tonnage.toLocaleString('en-US') + ' t';
    $('stShips').textContent = String(s.ships);
    $('stTime').textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`;
    $('stDeep').textContent = Math.floor(s.deepest) + ' m';
    $('stCause').textContent = rt.causeOfDeath;
    $('newRecord').style.display = rt.newRecord ? 'block' : 'none';
    if (rt.newRecord) sfx.record();
  }
  document.getElementById('goScreen')?.classList.remove('hidden');
  document.body.classList.remove('playing');
}

// ---------------------------------------------------------------- world reset
export function resetWorld() {
  for (const s of rt.ships) scene.remove(s.mesh);
  for (const t of rt.torpedoes) scene.remove(t.mesh);
  for (const c of rt.charges) scene.remove(c.mesh);
  for (const d of rt.decoys) scene.remove(d.mesh);
  for (const w of rt.wrecks) scene.remove(w);
  rt.ships.length = 0;
  rt.torpedoes.length = 0;
  rt.charges.length = 0;
  rt.decoys.length = 0;
  rt.shellsplashes.length = 0;
  rt.pings.length = 0;
  rt.contacts.length = 0;
  rt.wrecks.length = 0;
  simTimers.length = 0;
  clearVfx();
  Object.assign(rt.stats, { tonnage: 0, ships: 0, time: 0, deepest: 0, fired: 0, hits: 0, convoys: 0 });
  rt.heat = 0;
  rt.alert = 0;
  rt.exposure = 0;
  rt.pingFlash = 0;
  rt.trauma = 0;
  rt.hitstopT = 0;
  rt.timeScale = rt.timeScaleTarget = 1;
  rt.causeOfDeath = '';
  rt.newRecord = false;
  rt.chargesNear = false;
  rt.lastLaunch = null;
  rt.aimOverride = null;
  setLayerY(-(CFG.world.layerDepth + randSpread(CFG.world.layerJitter)));
  convoyT = CFG.convoys.firstDelay;
  hunterT = CFG.convoys.hunterPackPeriod;
  buildPlayer();
  updateHullHud();
  updateScoreHud();
  updateAlertHud();
}

export function startGame(range = false) {
  rt.noWaves = range;
  resetWorld();
  rt.state = 'PLAYING';
  rt.paused = false;
  rt.simTime = 0;
  document.getElementById('titleScreen')?.classList.add('hidden');
  document.getElementById('goScreen')?.classList.add('hidden');
  document.getElementById('pauseScreen')?.classList.add('hidden');
  document.body.classList.add('playing');
  showHints();
  after(7, fadeHints);
  banner(range ? 'WEAPONS RANGE' : 'DIVE — DIVE — DIVE', range ? 'NO SCHEDULED TRAFFIC' : 'HOSTILE SHIPPING LANES — SINK TONNAGE');
  feed('THE BOAT IS YOURS, CAPTAIN');
}

export function togglePause() {
  if (rt.state !== 'PLAYING' && rt.state !== 'DYING') return;
  rt.paused = !rt.paused;
  document.getElementById('pauseScreen')?.classList.toggle('hidden', !rt.paused);
}
