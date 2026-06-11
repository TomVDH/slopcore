// TONK — tester.js
// Field-tester entry: boots the full game (via main.js), forces range mode,
// and generates the control panel. FD-style: controls mutate TONK.CFG / call
// TONK.api directly; the game reads everything live.
import './main.js';
import { TONK, CFG, rt } from './config.js';
import { startGame } from './game.js';

const api = TONK.api;

// in the tester, every (re)start returns to range mode — death-click and [R] included
api.start = () => api.startRange();

// form fields must not drive the tank
addEventListener('keydown', (e) => {
  if (e.target && e.target.matches && e.target.matches('input, select, textarea')) e.stopPropagation();
}, true);

// crosshair only over the stage (it tracks the real mouse, fixed-position)
const stage = document.getElementById('stage');
const xh = document.getElementById('xh');
xh.style.display = 'none';
stage.addEventListener('mouseenter', () => { xh.style.display = ''; });
stage.addEventListener('mouseleave', () => { xh.style.display = 'none'; });

// ---------------------------------------------------------------- panel kit
const panel = document.getElementById('tester-panel');
const syncs = []; // slider re-sync fns, run after RESET CFG

function group(title, { badge = '', open = false } = {}) {
  const d = document.createElement('details');
  if (open) d.open = true;
  const s = document.createElement('summary');
  s.innerHTML = `${title}${badge ? `<span class="badge">${badge}</span>` : ''}`;
  const body = document.createElement('div');
  body.className = 'grp';
  d.append(s, body);
  panel.append(d);
  return body;
}
function slider(parent, label, { min, max, step, get, set, fmt }) {
  const r = document.createElement('div');
  r.className = 'row';
  const show = (v) => (fmt ? fmt(v) : (step >= 1 ? String(Math.round(v)) : v.toFixed(2)));
  r.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span>`;
  const input = r.querySelector('input'), val = r.querySelector('.val');
  const sync = () => { input.value = get(); val.textContent = show(+get()); };
  input.addEventListener('input', () => { set(+input.value); val.textContent = show(+input.value); });
  sync();
  syncs.push(sync);
  parent.append(r);
  return sync;
}
function cfgSlider(parent, label, obj, key, min, max, step, onChange) {
  return slider(parent, label, {
    min, max, step,
    get: () => obj[key],
    set: (v) => { obj[key] = v; if (onChange) onChange(v); },
  });
}
function btnRow(parent) {
  const r = document.createElement('div');
  r.className = 'btnrow';
  parent.append(r);
  return r;
}
function btn(parent, label, fn, cls = '') {
  const b = document.createElement('button');
  b.className = 'tbtn ' + cls;
  b.textContent = label;
  b.addEventListener('click', fn);
  parent.append(b);
  return b;
}
function note(parent, html) {
  const n = document.createElement('div');
  n.className = 'legend';
  n.innerHTML = html;
  parent.append(n);
}

// ---------------------------------------------------------------- TELEMETRY
{
  const g = group('TELEMETRY', { open: true });
  const pre = document.createElement('pre');
  pre.id = 'telemetry';
  g.append(pre);
  setInterval(() => {
    const s = api.state();
    pre.textContent =
      `STATE ${s.state}${s.noWaves ? ' (range)' : ''}   FPS ${s.fps}\n` +
      `HP ${Math.round(s.hp)}   WAVE ${String(s.wave).padStart(2, '0')}   HOSTILES ${s.enemies}${s.pending ? `(+${s.pending})` : ''}\n` +
      `SHELLS ${s.shells}   PARTICLES ${s.particles}   TIME ×${s.timeScale.toFixed(2)}\n` +
      `SCORE ${String(s.score).padStart(6, '0')}   KILLS ${s.kills}   GOD ${s.god ? 'ON' : 'off'}\n` +
      (s.pos ? `POS ${s.pos.x}, ${s.pos.z}` : '');
  }, 200);
}

// ---------------------------------------------------------------- RANGE
{
  const g = group('RANGE CONTROL', { open: true });
  const r1 = btnRow(g);
  btn(r1, 'RESPAWN', () => api.respawn(), 'ghost');
  btn(r1, 'KILL ALL', () => api.killAll(), 'warn');
  btn(r1, 'HEAL', () => api.heal());
  const godBtn = btn(r1, 'GOD', () => { godBtn.classList.toggle('on', api.god()); }, 'ghost');
  btn(r1, 'PAUSE [P]', () => api.togglePause(), 'ghost');

  let spawnDist = 45;
  slider(g, 'SPAWN DIST', { min: 15, max: 150, step: 5, get: () => spawnDist, set: (v) => { spawnDist = v; } });
  const r2 = btnRow(g);
  btn(r2, 'SPAWN STD', () => api.spawn('std', spawnDist));
  btn(r2, 'SPAWN SCOUT', () => api.spawn('scout', spawnDist));
  btn(r2, 'SPAWN HEAVY', () => api.spawn('heavy', spawnDist));

  const wr = document.createElement('div');
  wr.className = 'row';
  wr.innerHTML = `<label>WAVE LEVEL</label><input type="number" min="1" max="40" value="1"><span class="val"></span>`;
  const wIn = wr.querySelector('input');
  g.append(wr);
  const r3 = btnRow(g);
  btn(r3, 'SET WAVE', () => api.setWave(+wIn.value), 'ghost');
  btn(r3, 'START WAVE MODE', () => startGame(false), 'warn');

  slider(g, 'TIME SCALE', { min: 0.1, max: 2, step: 0.05, get: () => rt.timeScaleTarget, set: (v) => api.setTimeScale(v), fmt: (v) => '×' + v.toFixed(2) });
  note(g, 'Range mode: no auto-waves. WAVE LEVEL drives spawn scaling. START WAVE MODE runs the real game in the stage.');
}

// ---------------------------------------------------------------- VFX
{
  const g = group('VFX', { open: true });
  cfgSlider(g, 'PARTICLE ×', CFG.vfx, 'particleMul', 0, 3, 0.1);
  cfgSlider(g, 'SIZE ×', CFG.vfx, 'sizeMul', 0.3, 3, 0.1);
  cfgSlider(g, 'TRAUMA ×', CFG.vfx, 'traumaMul', 0, 3, 0.1);
  const boomAhead = (scale, dirt = false) => {
    const p = rt.player; if (!p) return;
    const a = p.heading + p.turretYaw;
    api.boom(p.pos.x + Math.sin(a) * 20, p.pos.z + Math.cos(a) * 20, scale, dirt);
  };
  const r = btnRow(g);
  btn(r, 'BOOM S', () => boomAhead(0.8), 'warn');
  btn(r, 'BOOM M', () => boomAhead(1.6), 'warn');
  btn(r, 'BOOM L', () => boomAhead(2.6), 'warn');
  btn(r, 'DIRT GEYSER', () => boomAhead(1.4, true));
  btn(r, 'MUZZLE FLASH', () => api.muzzleTest());
}

// ---------------------------------------------------------------- PLAYER
{
  const g = group('PLAYER (live)');
  cfgSlider(g, 'MAX FWD', CFG.player, 'maxFwd', 4, 40, 0.5);
  cfgSlider(g, 'MAX REV', CFG.player, 'maxRev', 2, 20, 0.5);
  cfgSlider(g, 'ACCEL', CFG.player, 'accel', 4, 40, 1);
  cfgSlider(g, 'YAW RATE', CFG.player, 'yawRate', 0.4, 4, 0.05);
  cfgSlider(g, 'TURRET RATE', CFG.player, 'turretRate', 1, 15, 0.5);
  cfgSlider(g, 'RELOAD s', CFG.player, 'reloadT', 0.15, 3, 0.05);
  cfgSlider(g, 'SHELL DMG', CFG.player, 'dmg', 10, 200, 5);
  cfgSlider(g, 'SHELL SPEED', CFG.player, 'shellSpeed', 30, 160, 5);
  cfgSlider(g, 'MAX HP', CFG.player, 'maxHp', 25, 400, 25);
}

// ---------------------------------------------------------------- ENEMIES
{
  const g = group('ENEMIES', { badge: 'APPLIES TO NEW SPAWNS' });
  for (const v of ['std', 'scout', 'heavy']) {
    const d = document.createElement('details');
    const s = document.createElement('summary');
    s.textContent = v.toUpperCase();
    const body = document.createElement('div');
    body.className = 'grp';
    d.append(s, body);
    g.append(d);
    const row = CFG.enemies[v];
    cfgSlider(body, 'HP', row, 'hp', 20, 600, 5);
    cfgSlider(body, 'DMG', row, 'dmg', 2, 60, 1);
    cfgSlider(body, 'SPEED', row, 'speed', 3, 24, 0.5);
    cfgSlider(body, 'ACCEL', row, 'accel', 3, 24, 1);
    cfgSlider(body, 'YAW RATE', row, 'yaw', 0.2, 3, 0.05);
    cfgSlider(body, 'TURRET RATE', row, 'turret', 0.5, 6, 0.1);
    cfgSlider(body, 'RELOAD LO', row, 'reloadLo', 0.5, 8, 0.1);
    cfgSlider(body, 'RELOAD HI', row, 'reloadHi', 0.5, 10, 0.1);
    cfgSlider(body, 'AIM ERR °', row, 'aimErr', 1, 16, 0.5);
    cfgSlider(body, 'RANGE LO', row, 'rangeLo', 8, 90, 2);
    cfgSlider(body, 'RANGE HI', row, 'rangeHi', 20, 120, 2);
    cfgSlider(body, 'SHELL SPEED', row, 'shell', 30, 120, 5);
    cfgSlider(body, 'SCALE', row, 'scale', 0.5, 2, 0.05);
  }
}

// ---------------------------------------------------------------- SHELLS
{
  const g = group('SHELLS (live)');
  cfgSlider(g, 'GRAVITY', CFG.shells, 'gravity', 0, 30, 0.5);
  cfgSlider(g, 'TRAIL dt', CFG.shells, 'trailDt', 0.004, 0.06, 0.002);
}

// ---------------------------------------------------------------- WAVES
{
  const g = group('WAVES');
  cfgSlider(g, 'BASE COUNT', CFG.waves, 'baseCount', 1, 6, 1);
  cfgSlider(g, 'CONCURRENT', CFG.waves, 'maxConcurrent', 2, 10, 1);
  cfgSlider(g, 'NEXT DELAY s', CFG.waves, 'nextWaveDelay', 1, 10, 0.5);
  cfgSlider(g, 'SCOUT CHANCE', CFG.waves, 'scoutChance', 0, 1, 0.05);
  cfgSlider(g, 'HEAVY CHANCE', CFG.waves, 'heavyChance', 0, 1, 0.05);
}

// ---------------------------------------------------------------- CAMERA
{
  const g = group('CAMERA (live)');
  cfgSlider(g, 'DISTANCE', CFG.camera, 'dist', 8, 30, 0.5, (v) => { rt.camDist = v; });
  cfgSlider(g, 'HEIGHT K', CFG.camera, 'heightK', 0.2, 1, 0.02);
  cfgSlider(g, 'POS DAMP', CFG.camera, 'posDamp', 1, 12, 0.5);
  cfgSlider(g, 'LOOK DAMP', CFG.camera, 'lookDamp', 1, 15, 0.5);
  cfgSlider(g, 'SHAKE ×', CFG.camera, 'shakeMag', 0, 3, 0.1);
  cfgSlider(g, 'TRAUMA DECAY', CFG.camera, 'traumaDecay', 0.3, 4, 0.1);
}

// ---------------------------------------------------------------- WORLD
{
  const g = group('WORLD (live)');
  const apply = () => api.applyWorld();
  cfgSlider(g, 'FOG NEAR', CFG.world, 'fogNear', 20, 200, 5, apply);
  cfgSlider(g, 'FOG FAR', CFG.world, 'fogFar', 120, 900, 10, apply);
  cfgSlider(g, 'SUN', CFG.world, 'sunIntensity', 0, 6, 0.1, apply);
  cfgSlider(g, 'HEMI', CFG.world, 'hemiIntensity', 0, 2, 0.05, apply);
  cfgSlider(g, 'EXPOSURE', CFG.world, 'exposure', 0.4, 2.2, 0.02, apply);
  cfgSlider(g, 'AMBIENT DUST', CFG.world, 'ambientDustRate', 0, 10, 0.5);
}

// ---------------------------------------------------------------- AUDIO
{
  const g = group('AUDIO');
  const apply = () => api.applyAudio();
  cfgSlider(g, 'MASTER', CFG.audio, 'master', 0, 1, 0.02, apply);
  cfgSlider(g, 'SFX ×', CFG.audio, 'sfx', 0, 2, 0.05);
  cfgSlider(g, 'ENGINE ×', CFG.audio, 'engine', 0, 2, 0.05);
  const r0 = btnRow(g);
  const muteBtn = btn(r0, 'MUTE [M]', () => { muteBtn.classList.toggle('on', api.toggleMute()); }, 'ghost');
  const r = btnRow(g);
  for (const name of ['shot', 'explosion', 'clank', 'dirt', 'whiz', 'reload', 'repair', 'horn', 'alarm']) {
    btn(r, name.toUpperCase(), () => api.sfxTest(name), 'ghost');
  }
}

// ---------------------------------------------------------------- CFG
{
  const g = group('CFG', { open: true });
  const r = btnRow(g);
  const copyBtn = btn(r, 'COPY CFG DIFF', () => {
    const json = api.copyCfg();
    out.textContent = json === '{}' ? '— all values at defaults —' : json;
    out.classList.add('show');
    copyBtn.textContent = 'COPIED ✓';
    setTimeout(() => { copyBtn.textContent = 'COPY CFG DIFF'; }, 1200);
  });
  btn(r, 'RESET CFG', () => {
    api.resetCfg();
    rt.camDist = CFG.camera.dist;
    syncs.forEach((f) => f());
    out.textContent = '— reset to defaults —';
    out.classList.add('show');
  }, 'ghost');
  const out = document.createElement('pre');
  out.id = 'cfgOut';
  g.append(out);
  note(g, 'COPY puts the non-default values on the clipboard as JSON — paste into <b>js/config.js</b> to bake them in.');
}

// ---------------------------------------------------------------- LEGEND
{
  const g = group('LEGEND');
  note(g,
    'Stage is the live game: <b>WASD</b> drive · mouse aims · <b>LMB/SPACE</b> fire · wheel zooms (over stage).<br>' +
    'ENEMY rows apply to the next spawn. RESPAWN rebuilds the world (applies player radius / clears wrecks).<br>' +
    'Dying + click redeploys back into range mode. <b>[P]</b> pause · <b>[M]</b> mute.');
}

// ---------------------------------------------------------------- boot
api.startRange();
