// TONK — main.js
// Entry point: boot calls, the frame loop, resize, TONK.api assembly.
// All import-time side effects live in the modules; all boot *calls* live here.
import * as THREE from 'three';
import {
  TONK, CFG, DEFAULTS, rt, HI_KEY, HI_KEY_LEGACY, clamp, lerp, damp, dist2D, fmt, _v1, _v2,
} from './config.js';
import { canvas, renderer, scene, camera, applyWorldCfg } from './scene.js';
import { terrainH } from './world.js';
import { audioInit, sfx, updateEngine, applyAudioCfg, toggleMute } from './audio.js';
import { explosion, muzzleFx, updateVfx, ambientDust, setPixelUniform, particleCount } from './vfx.js';
import { vignetteEl, xhReload, xhInfo, updateWaveHud, drawMinimap, updateScoreHud, updateArmorHud } from './hud.js';
import { keys, aimPoint } from './input.js';
import { updateCamera } from './camera.js';
import {
  startGame, togglePause, resetWorld, buildPlayer, tickTimers,
  updatePlayer, titleIdle, updateEnemies, updateShells, updatePickups, updateDebris,
  playerFire, damagePlayer, healPlayer, spawnEnemy, killEnemy, shellCount,
} from './game.js';

// ---------------------------------------------------------------- TONK.api
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

Object.assign(TONK.api, {
  start: () => { if (rt.state !== 'PLAYING') startGame(false); },
  startRange: () => startGame(true),
  respawn: () => startGame(rt.noWaves),     // fresh world, same mode — applies spawn-bound CFG
  togglePause,
  state: () => ({
    state: rt.state, paused: rt.paused, wave: rt.wave,
    hp: rt.player ? rt.player.hp : 0,
    enemies: rt.enemies.filter(e => e.alive).length,
    pending: rt.pendingSpawns,
    score: rt.stats.score, kills: rt.stats.kills,
    fps: Math.round(rt.fpsAvg),
    shells: shellCount(), particles: particleCount(),
    timeScale: +rt.timeScale.toFixed(2),
    god: rt.godMode, noWaves: rt.noWaves,
    pos: rt.player ? { x: +rt.player.pos.x.toFixed(1), z: +rt.player.pos.z.toFixed(1) } : null,
  }),
  boom: (x = 0, z = 0, s = 1.6, dirt = false) => explosion(x, terrainH(x, z) + 1.2, z, s, dirt),
  muzzleTest: () => {
    const p = rt.player; if (!p) return;
    p.mesh.muzzle.getWorldPosition(_v1);
    p.mesh.muzzle.getWorldDirection(_v2);
    muzzleFx(_v1, _v2);
  },
  sfxTest: (name) => {
    const f = sfx[name]; if (!f) return;
    audioInit();
    const p = rt.player;
    if (['shot', 'explosion', 'clank', 'dirt'].includes(name)) f(p.pos.x + 10, p.pos.z + 10);
    else f();
  },
  hurt: (n = 25) => damagePlayer(n),
  heal: (n = CFG.player.maxHp) => healPlayer(n),
  god: (on) => { rt.godMode = on === undefined ? !rt.godMode : !!on; return rt.godMode; },
  killAll: () => rt.enemies.filter(e => e.alive).forEach(e => killEnemy(e)),
  spawn: (variant = 'std', dist) => CFG.enemies[variant] ? spawnEnemy(variant, dist) : null,
  setWave: (n) => { rt.wave = Math.max(1, n | 0); updateWaveHud(); },
  setTimeScale: (x) => { rt.timeScaleTarget = clamp(+x || 1, 0.05, 3); },
  fire: () => playerFire(),
  press: (code, down = true) => down ? keys.add(code) : keys.delete(code),
  aim: (x, z) => { aimPoint.set(x, terrainH(x, z), z); },
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
});
window.__tank = TONK.api; // legacy debug alias

// ---------------------------------------------------------------- boot
try {
  rt.hiScore = parseInt(localStorage.getItem(HI_KEY) || '0', 10) || 0;
  if (!rt.hiScore) {
    // one-time migration from the Steel Tempest era
    const legacy = parseInt(localStorage.getItem(HI_KEY_LEGACY) || '0', 10) || 0;
    if (legacy > 0) {
      rt.hiScore = legacy;
      localStorage.setItem(HI_KEY, String(legacy));
    }
  }
} catch (e) {}
{
  const titleHi = document.getElementById('titleHi');
  if (titleHi && rt.hiScore > 0) titleHi.textContent = `SECTOR RECORD — ${fmt(rt.hiScore, 6)}`;
}
buildPlayer();
updateArmorHud();
updateScoreHud();

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

  // hitstop / slowmo recovery
  if (rt.hitstopT > 0) rt.hitstopT -= rawDt;
  else if (rt.state === 'PLAYING') rt.timeScale = damp(rt.timeScale, rt.timeScaleTarget, 10, rawDt);
  const dt = rt.paused ? 0 : rawDt * rt.timeScale;
  if (!rt.paused) rt.simTime += dt;

  tickTimers();

  if (rt.state === 'PLAYING' && !rt.paused && rt.player.alive) {
    updatePlayer(dt);
  } else if (rt.state === 'TITLE') {
    titleIdle(realT);
  }

  if (!rt.paused) {
    updateEnemies(dt);
    updateShells(dt);
    updatePickups(dt);
    updateVfx(dt, rt.simTime);
    ambientDust(dt, camera.position);
    updateDebris(dt);
  }

  // vignette
  rt.vignetteFlash = Math.max(0, rt.vignetteFlash - rawDt * 1.8);
  vignetteEl.style.opacity = String(clamp(rt.vignetteFlash * 0.85, 0, 0.85));

  // crosshair reload arc + distance
  if (rt.state === 'PLAYING' && rt.player.alive) {
    if (rt.player.reload > 0) {
      const pct = (1 - rt.player.reload / CFG.player.reloadT) * 100;
      xhReload.style.background = `conic-gradient(var(--amber) ${pct}%, transparent ${pct}%)`;
      xhReload.style.webkitMask = 'radial-gradient(circle, transparent 56%, black 58%, black 70%, transparent 72%)';
      xhReload.style.mask = 'radial-gradient(circle, transparent 56%, black 58%, black 70%, transparent 72%)';
      xhInfo.textContent = 'LOADING';
    } else {
      xhReload.style.background = 'none';
      const d = Math.round(dist2D(aimPoint.x, aimPoint.z, rt.player.pos.x, rt.player.pos.z));
      xhInfo.textContent = `${fmt(d, 3)}m`;
    }
  }

  updateCamera(rawDt, realT);
  if (rt.state === 'PLAYING' || rt.state === 'DYING') updateWaveHud();
  drawMinimap();

  // engine silent outside active gameplay
  if (rt.state !== 'PLAYING' || rt.paused) updateEngine(0, 0, false);

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(loop);
