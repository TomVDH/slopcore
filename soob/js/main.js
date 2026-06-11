// SOOB — main.js
// Entry point: boot calls, the frame loop, resize, SOOB.api assembly.
// All import-time side effects live in the modules; all boot *calls* live here.
import * as THREE from 'three';
import {
  SOOB, CFG, DEFAULTS, rt, clamp, lerp, damp, fmt, depthOf, belowLayer, TELEGRAPH_KEYS,
} from './config.js';
import { canvas, renderer, scene, camera, applyDepthGrade, applyWorldCfg } from './scene.js';
import { updateWorld, seabedH } from './world.js';
import { audioInit, sfx, updateEngine, applyAudioCfg, toggleMute } from './audio.js';
import { boom, breach, pingRing, updateVfx, setPixelUniform, particleCount, clearVfx } from './vfx.js';
import {
  vignetteEl, xhEl, xhInfo, updateHullHud, updateScoreHud, updateAlertHud, updateConnHud,
  drawScope, drawDepthGauge, feed,
} from './hud.js';
import { keys, updateAim } from './input.js';
import { updateCamera } from './camera.js';
import {
  startGame, togglePause, resetWorld, buildPlayer, tickTimers, loadRecords,
  updatePlayer, titleIdle, updateDying, updateShips, updateOrdnance, updateAcoustics,
  computeSolution, playerFire, playerPing, dropDecoy, telegraphStep, toggleSilent,
  damagePlayer, healPlayer, spawnShip, spawnConvoy, spawnHunters, damageShip, killShip,
} from './game.js';

// ---------------------------------------------------------------- SOOB.api
function deepRestore(cur, def) {
  for (const k of Object.keys(def)) {
    if (def[k] && typeof def[k] === 'object') deepRestore(cur[k], def[k]);
    else cur[k] = def[k];
  }
}
function deepDiff(cur, def) {
  const out = {};
  for (const k of Object.keys(cur)) {
    const c = cur[k], d = def[k];
    if (c && typeof c === 'object') {
      const sub = deepDiff(c, d || {});
      if (Object.keys(sub).length) out[k] = sub;
    } else if (c !== d) out[k] = c;
  }
  return out;
}

Object.assign(SOOB.api, {
  start: () => { if (rt.state !== 'PLAYING') startGame(false); },
  startRange: () => startGame(true),
  respawn: () => startGame(rt.noWaves),
  togglePause,
  state: () => {
    const p = rt.player;
    return {
      state: rt.state, paused: rt.paused,
      fps: Math.round(rt.fpsAvg),
      hp: p ? +p.hp.toFixed(1) : 0,
      depth: p ? Math.round(depthOf(p.pos.y)) : 0,
      telegraph: p ? TELEGRAPH_KEYS[p.telegraphIdx].toUpperCase() : '',
      silent: p ? p.silent : false,
      cav: p ? p.cav : false,
      noise: p ? Math.round(p.noise) : 0,
      exposure: +rt.exposure.toFixed(2),
      alert: rt.alert,
      belowLayer: p ? belowLayer(p.pos.y) : false,
      layerDepth: Math.round(depthOf(rt.layerY)),
      tonnage: rt.stats.tonnage, ships: rt.stats.ships,
      fired: rt.stats.fired, hits: rt.stats.hits,
      merchants: rt.ships.filter((s) => s.alive && s.role === 'merchant').length,
      escorts: rt.ships.filter((s) => s.alive && s.role === 'escort').length,
      sinking: rt.ships.filter((s) => !s.alive).length,
      torpedoes: rt.torpedoes.length,
      charges: rt.charges.length,
      decoysLeft: p ? p.decoys : 0,
      tubesReady: p ? p.tubes.filter((t) => t <= 0).length : 0,
      contacts: rt.contacts.length,
      particles: particleCount(),
      timeScale: +rt.timeScale.toFixed(2),
      heat: +rt.heat.toFixed(2),
      god: rt.godMode, noWaves: rt.noWaves,
      pos: p ? { x: +p.pos.x.toFixed(1), y: +p.pos.y.toFixed(1), z: +p.pos.z.toFixed(1) } : null,
      solution: rt.solution ? { locked: rt.solution.locked, range: Math.round(rt.solution.range), run: +(rt.solution.run || 0).toFixed(1) } : null,
      cause: rt.causeOfDeath,
      records: { ...rt.records },
    };
  },
  // combat verbs
  fire: playerFire,
  ping: playerPing,
  decoy: dropDecoy,
  telegraphStep,
  setTelegraph: (i) => { if (rt.player) rt.player.telegraphIdx = clamp(i | 0, 0, TELEGRAPH_KEYS.length - 1); },
  silent: (on) => {
    if (!rt.player) return false;
    if (on === undefined || on !== rt.player.silent) return toggleSilent();
    return rt.player.silent;
  },
  aimAt: (x, z) => { rt.aimOverride = (x === null || x === undefined) ? null : { x, z }; },
  aimNearestMerchant: () => {
    const p = rt.player; if (!p) return false;
    let best = null, bd = 1e9;
    for (const s of rt.ships) {
      if (!s.alive || s.role !== 'merchant') continue;
      const d = Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) rt.aimOverride = { x: best.pos.x, z: best.pos.z, ship: best };
    return !!best;
  },
  setDepth: (d) => {
    const p = rt.player; if (!p) return;
    p.pos.y = clamp(-Math.abs(d), seabedH(p.pos.x, p.pos.z) + 3, -2);
  },
  press: (code, down = true) => down ? keys.add(code) : keys.delete(code),
  // spawners
  spawn: (kind = 'freighter', dist = 500, bearingDeg) =>
    CFG.ships[kind] ? !!spawnShip(kind, { dist, bearing: bearingDeg === undefined ? undefined : bearingDeg * Math.PI / 180 }) : false,
  spawnConvoy: (m = 3, e = 2) => spawnConvoy(m, e),
  spawnHunters,
  killAll: () => rt.ships.filter((s) => s.alive).forEach((s) => killShip(s)),
  hurtShip: (n = 50) => { const s = rt.ships.find((s) => s.alive); if (s) damageShip(s, n); },
  // cheats / probes
  god: (on) => { rt.godMode = on === undefined ? !rt.godMode : !!on; return rt.godMode; },
  heal: (n = CFG.player.maxHp) => healPlayer(n),
  hurt: (n = 25, cause = 'TEST') => damagePlayer(n, cause),
  setTimeScale: (x) => { rt.timeScaleTarget = clamp(+x || 1, 0.05, 6); },
  boom: (x, y, z, s = 1.5) => {
    const p = rt.player;
    boom(x ?? (p ? p.pos.x + 30 : 0), y ?? (p ? p.pos.y : -30), z ?? (p ? p.pos.z + 30 : 0), s);
  },
  breachTest: () => { const p = rt.player; breach(p.pos.x + 60, -2, p.pos.z + 60, 1.5); },
  pingTest: (mine = false) => {
    const p = rt.player; if (!p) return;
    if (mine) playerPing();
    else {
      rt.pings.push({ x: p.pos.x + 300, y: -3, z: p.pos.z, r: 1, maxR: 600, mine: false, src: null, hitPlayer: false });
      pingRing(p.pos.x + 300, -4, p.pos.z, 600, false);
      sfx.enemyPing(p.pos.x + 300, p.pos.z, 0.2);
    }
  },
  creakTest: () => sfx.creak(),
  sfxTest: (name) => {
    const f = sfx[name]; if (!f) return;
    audioInit();
    const p = rt.player;
    if (['explosion', 'charge', 'torpedoLaunch', 'groan', 'splash', 'gunReport', 'shellSplash', 'decoy', 'enemyPing'].includes(name)) {
      f(p.pos.x + 60, p.pos.z + 60);
    } else f();
  },
  // plumbing
  applyWorld: applyWorldCfg,
  applyAudio: applyAudioCfg,
  toggleMute: () => { audioInit(); return toggleMute(); },
  copyCfg: () => {
    const json = JSON.stringify(deepDiff(CFG, DEFAULTS), null, 2);
    try { navigator.clipboard.writeText(json); } catch (e) {}
    return json;
  },
  resetCfg: () => {
    deepRestore(CFG, DEFAULTS);
    applyWorldCfg();
    applyAudioCfg();
  },
  clearRecords: () => {
    Object.assign(rt.records, { tonnage: 0, ships: 0, time: 0, deepest: 0 });
    try { localStorage.removeItem('soob.rec.v1'); } catch (e) {}
    updateScoreHud();
  },
  // deterministic headless fast-forward (verification / balance probes):
  // advances the full sim WITHOUT rendering, then draws one frame.
  step: (seconds = 1, dtStep = 1 / 30) => {
    let n = Math.min(Math.ceil(seconds / dtStep), 36000);
    while (n-- > 0) {
      const dt = dtStep;
      rt.simTime += dt;
      tickTimers();
      if (rt.state === 'PLAYING' && rt.player?.alive) {
        computeSolution();
        updatePlayer(dt);
        rt.stats.time += dt;
      } else if (rt.state === 'DYING') {
        updateDying(dt);
      }
      if (rt.state !== 'TITLE') {
        updateShips(dt);
        updateOrdnance(dt);
        updateAcoustics(dt);
      }
      updateVfx(dt, rt.simTime);
    }
    updateCamera(1 / 60, rt.simTime);
    applyDepthGrade(camera.position.y);
    if (rt.state !== 'TITLE') { updateConnHud(); updateAlertHud(); drawScope(1 / 30); drawDepthGauge(); }
    updateHullHud();
    updateScoreHud();
    renderer.render(scene, camera);
    return SOOB.api.state();
  },
});

// ---------------------------------------------------------------- boot
loadRecords();
{
  const titleHi = document.getElementById('titleHi');
  if (titleHi && rt.records.tonnage > 0) {
    titleHi.textContent = `RECORD PATROL — ${rt.records.tonnage.toLocaleString('en-US')} TONS`;
  }
}
buildPlayer();
updateHullHud();
updateScoreHud();
updateAlertHud();

// ---------------------------------------------------------------- resize
function sizeToCanvas() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  const px = h * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  setPixelUniform(px);
}
addEventListener('resize', sizeToCanvas);
sizeToCanvas();

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();

function loop() {
  const rawDt = Math.min(0.05, clock.getDelta());
  const realT = clock.elapsedTime;
  rt.fpsAvg = lerp(rt.fpsAvg, 1 / Math.max(rawDt, 1e-4), 0.04);

  // hitstop / slow-mo recovery
  if (rt.hitstopT > 0) rt.hitstopT -= rawDt;
  else if (rt.state === 'PLAYING') rt.timeScale = damp(rt.timeScale, rt.timeScaleTarget, 10, rawDt);
  const dt = rt.paused ? 0 : rawDt * rt.timeScale;
  if (!rt.paused) rt.simTime += dt;

  tickTimers();

  if (rt.state === 'PLAYING' && !rt.paused && rt.player?.alive) {
    updateAim();
    computeSolution();
    updatePlayer(dt);
    rt.stats.time += dt;
  } else if (rt.state === 'TITLE') {
    titleIdle(rawDt);
  } else if (rt.state === 'DYING' && !rt.paused) {
    updateDying(dt);
  }

  if (!rt.paused && rt.state !== 'TITLE') {
    updateShips(dt);
    updateOrdnance(dt);
    updateAcoustics(dt);
  }
  if (!rt.paused) {
    updateVfx(dt, rt.simTime);
  }
  updateWorld(rawDt, realT);

  // damage vignette
  rt.vignetteFlash = Math.max(0, rt.vignetteFlash - rawDt * 1.6);
  if (vignetteEl) vignetteEl.style.opacity = String(clamp(rt.vignetteFlash * 0.9, 0, 0.9));

  // crosshair: fire-solution readout
  if (rt.state === 'PLAYING' && rt.player?.alive && xhInfo) {
    const sol = rt.solution;
    if (sol) {
      const tubes = rt.player.tubes.filter((t) => t <= 0).length;
      xhInfo.textContent = sol.locked
        ? `SOLUTION · RNG ${fmt(sol.range, 4)} · RUN ${sol.run.toFixed(0)}s · TUBES ${tubes}`
        : `RNG ${fmt(sol.range, 4)} · TUBES ${tubes}`;
      xhEl.classList.toggle('locked', sol.locked);
    }
  }

  updateCamera(rawDt, realT);
  applyDepthGrade(camera.position.y);

  if (rt.state !== 'TITLE') {
    updateConnHud();
    updateAlertHud();
    drawScope(rawDt);
    drawDepthGauge();
  }

  // own engine sound (silent outside active play)
  const p = rt.player;
  if (rt.state === 'PLAYING' && !rt.paused && p?.alive) {
    updateEngine(p.speed * (p.silent ? 0.5 : 1), p.cav, true, depthOf(p.pos.y));
  } else {
    updateEngine(0, false, false, p ? depthOf(p.pos.y) : 0);
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(loop);
