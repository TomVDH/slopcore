// SOOB — tester.js
// Sea-trials entry: boots the full game (via main.js), forces range mode,
// and generates the control panel. FD/TONK-style: controls mutate SOOB.CFG /
// call SOOB.api directly; the game reads everything live.
import './main.js';
import { SOOB, CFG, rt } from './config.js';
import { setLayerY } from './world.js';
import { cavitation } from './vfx.js';
import { startGame } from './game.js';

const api = SOOB.api;

// in the tester, every (re)start returns to range mode — death-click and [R] included
api.start = () => api.startRange();

// form fields must not drive the boat
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
  const show = (v) => (fmt ? fmt(v) : (step >= 1 ? String(Math.round(v)) : (+v).toFixed(step >= 0.1 ? 2 : 3)));
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
    const alert = ['UNDETECTED', 'SUSPICIOUS', 'HUNTED'][s.alert] || '?';
    pre.textContent =
      `STATE ${s.state}${s.noWaves ? ' (range)' : ''}   FPS ${s.fps}   ×${s.timeScale.toFixed(2)}\n` +
      `HULL ${Math.round(s.hp)}   DEPTH ${s.depth}m   ${s.telegraph}${s.silent ? ' · SILENT' : ''}${s.cav ? ' · CAV!' : ''}\n` +
      `NOISE ${s.noise}   EXPOSURE ${(s.exposure * 100).toFixed(0)}%   ${alert}${s.belowLayer ? ' · BELOW LAYER' : ''}\n` +
      `LAYER @${s.layerDepth}m   MERCH ${s.merchants}   ESCORT ${s.escorts}   SINKING ${s.sinking}\n` +
      `FISH ${s.torpedoes}   CHARGES ${s.charges}   TUBES ${s.tubesReady}   CONTACTS ${s.contacts}\n` +
      `TONNAGE ${s.tonnage.toLocaleString('en-US')}   SHIPS ${s.ships}   HEAT ${s.heat}\n` +
      `PARTICLES ${s.particles}   GOD ${s.god ? 'ON' : 'off'}` +
      (s.pos ? `   POS ${s.pos.x}, ${s.pos.z}` : '');
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

  let spawnDist = 500, spawnBrg = 0;
  slider(g, 'SPAWN DIST', { min: 100, max: 1400, step: 50, get: () => spawnDist, set: (v) => { spawnDist = v; } });
  slider(g, 'SPAWN BRG °', { min: 0, max: 360, step: 15, get: () => spawnBrg, set: (v) => { spawnBrg = v; } });
  const r2 = btnRow(g);
  btn(r2, 'FREIGHTER', () => api.spawn('freighter', spawnDist, spawnBrg));
  btn(r2, 'TANKER', () => api.spawn('tanker', spawnDist, spawnBrg));
  btn(r2, 'ESCORT', () => api.spawn('escort', spawnDist, spawnBrg), 'warn');
  btn(r2, 'HUNTER', () => api.spawn('hunter', spawnDist, spawnBrg), 'warn');
  const cr = document.createElement('div');
  cr.className = 'row';
  cr.innerHTML = `<label>CONVOY M / E</label><input type="number" min="1" max="6" value="3"><input type="number" min="0" max="5" value="2">`;
  const [mIn, eIn] = cr.querySelectorAll('input');
  g.append(cr);
  const r3 = btnRow(g);
  btn(r3, 'SPAWN CONVOY', () => api.spawnConvoy(+mIn.value, +eIn.value));
  btn(r3, 'HUNTER PACK', () => api.spawnHunters(), 'warn');
  btn(r3, 'START PATROL MODE', () => startGame(false), 'ghost');

  slider(g, 'TIME SCALE', { min: 0.1, max: 4, step: 0.05, get: () => rt.timeScaleTarget, set: (v) => api.setTimeScale(v), fmt: (v) => '×' + (+v).toFixed(2) });
  const dr = document.createElement('div');
  dr.className = 'row';
  dr.innerHTML = `<label>SET DEPTH m</label><input type="number" min="2" max="320" value="12">`;
  const dIn = dr.querySelector('input');
  g.append(dr);
  const r4 = btnRow(g);
  btn(r4, 'TELEPORT DEPTH', () => api.setDepth(+dIn.value), 'ghost');
  btn(r4, 'TELE −', () => api.telegraphStep(-1), 'ghost');
  btn(r4, 'TELE +', () => api.telegraphStep(1), 'ghost');
  const silentBtn = btn(r4, 'SILENT [C]', () => { silentBtn.classList.toggle('on', api.silent()); }, 'ghost');
  const r5 = btnRow(g);
  btn(r5, 'FIRE [LMB]', () => api.fire());
  btn(r5, 'AIM NEAREST', () => api.aimNearestMerchant(), 'ghost');
  btn(r5, 'CLEAR AIM', () => api.aimAt(null), 'ghost');
  btn(r5, 'PING [F]', () => api.ping());
  btn(r5, 'DECOY [X]', () => api.decoy());
  note(g, 'Range mode: no scheduled traffic. AIM NEAREST locks the TDC onto the closest merchant for hands-off firing.');
}

// ---------------------------------------------------------------- VFX
{
  const g = group('VFX', { open: true });
  cfgSlider(g, 'PARTICLE ×', CFG.vfx, 'particleMul', 0, 3, 0.1);
  cfgSlider(g, 'SIZE ×', CFG.vfx, 'sizeMul', 0.3, 3, 0.1);
  cfgSlider(g, 'TRAUMA ×', CFG.vfx, 'traumaMul', 0, 3, 0.1);
  cfgSlider(g, 'HITSTOP s', CFG.vfx, 'hitstopT', 0, 0.3, 0.01);
  const ahead = (d = 40) => {
    const p = rt.player;
    return [p.pos.x + Math.sin(p.heading) * d, p.pos.y, p.pos.z + Math.cos(p.heading) * d];
  };
  const r = btnRow(g);
  btn(r, 'BOOM S', () => { const [x, y, z] = ahead(); api.boom(x, y, z, 0.8); }, 'warn');
  btn(r, 'BOOM M', () => { const [x, y, z] = ahead(); api.boom(x, y, z, 1.6); }, 'warn');
  btn(r, 'BOOM L', () => { const [x, y, z] = ahead(50); api.boom(x, y, z, 2.8); }, 'warn');
  btn(r, 'BREACH', () => api.breachTest(), 'warn');
  const r2 = btnRow(g);
  btn(r2, 'MY PING', () => api.pingTest(true));
  btn(r2, 'ENEMY PING', () => api.pingTest(false), 'warn');
  btn(r2, 'CREAK', () => api.creakTest(), 'ghost');
  btn(r2, 'CAV BURST', () => {
    const p = rt.player;
    cavitation(p.pos.x - Math.sin(p.heading) * 16, p.pos.y, p.pos.z - Math.cos(p.heading) * 16, 1.2, 1);
  }, 'ghost');
}

// ---------------------------------------------------------------- DETECTION
{
  const g = group('DETECTION (live)', { open: true });
  cfgSlider(g, 'PASSIVE R', CFG.detection, 'passiveR', 200, 1400, 20);
  cfgSlider(g, 'ACTIVE R', CFG.detection, 'activeR', 150, 1100, 10);
  cfgSlider(g, 'SUS RATE', CFG.detection, 'susRate', 0.1, 2, 0.05);
  cfgSlider(g, 'SUS DECAY', CFG.detection, 'susDecay', 0.01, 0.3, 0.005);
  cfgSlider(g, 'SUS THRESH', CFG.detection, 'susThresh', 0.01, 0.2, 0.005);
  cfgSlider(g, 'INVESTIGATE @', CFG.detection, 'investigateAt', 0.1, 0.7, 0.02);
  cfgSlider(g, 'ATTACK @', CFG.detection, 'attackAt', 0.4, 1, 0.02);
  cfgSlider(g, 'LAYER ATTEN', CFG.detection, 'layerAtten', 0.05, 1, 0.05);
  cfgSlider(g, 'PING LAYER ATTEN', CFG.detection, 'pingLayerAtten', 0.05, 1, 0.05);
  cfgSlider(g, 'BOTTOM ATTEN', CFG.detection, 'bottomAtten', 0.1, 1, 0.05);
  cfgSlider(g, 'VIS R (SCOPE)', CFG.detection, 'visPeriscopeR', 100, 800, 20);
  cfgSlider(g, 'VIS R (SURF)', CFG.detection, 'visSurfacedR', 300, 1400, 20);
  cfgSlider(g, 'PING SPEED', CFG.detection, 'pingSpeed', 150, 900, 10);
  cfgSlider(g, 'DEAF s', CFG.detection, 'deafT', 0, 10, 0.5);
}

// ---------------------------------------------------------------- NOISE
{
  const g = group('NOISE SIGNATURE (live)');
  for (const k of ['stop', 'slow', 'half', 'full', 'flank', 'astern']) {
    cfgSlider(g, k.toUpperCase(), CFG.noise, k, 0, 120, 1);
  }
  cfgSlider(g, 'CAV EXTRA', CFG.noise, 'cavExtra', 0, 100, 2);
  cfgSlider(g, 'CAV BASE SPD', CFG.noise, 'cavBaseSpeed', 3, 12, 0.1);
  cfgSlider(g, 'CAV / METRE', CFG.noise, 'cavPerMeter', 0, 0.08, 0.002);
  cfgSlider(g, 'FIRE TRANSIENT', CFG.noise, 'fireTransient', 0, 120, 5);
  cfgSlider(g, 'SILENT MUL', CFG.player, 'silentNoiseMul', 0.1, 1, 0.02);
}

// ---------------------------------------------------------------- TORPEDOES
{
  const g = group('TORPEDOES (live)');
  cfgSlider(g, 'SPEED', CFG.torpedo, 'speed', 12, 60, 1);
  cfgSlider(g, 'RANGE', CFG.torpedo, 'range', 300, 2500, 50);
  cfgSlider(g, 'ARM DIST', CFG.torpedo, 'armDist', 0, 300, 10);
  cfgSlider(g, 'FUSE R', CFG.torpedo, 'fuseR', 2, 20, 0.5);
  cfgSlider(g, 'DAMAGE', CFG.torpedo, 'dmg', 20, 300, 5);
  cfgSlider(g, 'TURN RATE', CFG.torpedo, 'turnRate', 0.1, 2, 0.05);
  cfgSlider(g, 'RELOAD s', CFG.torpedo, 'reloadT', 1, 20, 0.5);
  cfgSlider(g, 'WAKE RATE', CFG.torpedo, 'wakeRate', 0, 200, 5);
}

// ---------------------------------------------------------------- DEPTH CHARGES
{
  const g = group('DEPTH CHARGES (live)');
  cfgSlider(g, 'DAMAGE', CFG.charges, 'dmg', 10, 200, 2);
  cfgSlider(g, 'LETHAL R', CFG.charges, 'lethalR', 2, 30, 1);
  cfgSlider(g, 'BLAST R', CFG.charges, 'blastR', 10, 80, 1);
  cfgSlider(g, 'SINK RATE', CFG.charges, 'sinkRate', 1, 12, 0.2);
  cfgSlider(g, 'PER RUN', CFG.charges, 'perRun', 1, 12, 1);
  cfgSlider(g, 'INTERVAL s', CFG.charges, 'interval', 0.2, 2, 0.05);
  cfgSlider(g, 'RUN COOLDOWN', CFG.charges, 'runCooldown', 2, 20, 0.5);
  cfgSlider(g, 'FUSE JITTER m', CFG.charges, 'fuseJitter', 0, 40, 1);
}

// ---------------------------------------------------------------- CONVOYS
{
  const g = group('CONVOYS / HEAT');
  cfgSlider(g, 'FIRST DELAY', CFG.convoys, 'firstDelay', 2, 60, 1);
  cfgSlider(g, 'PERIOD s', CFG.convoys, 'period', 20, 140, 2);
  cfgSlider(g, 'PERIOD MIN', CFG.convoys, 'periodMin', 15, 80, 1);
  cfgSlider(g, 'MERCH LO', CFG.convoys, 'merchLo', 1, 5, 1);
  cfgSlider(g, 'MERCH HI', CFG.convoys, 'merchHi', 2, 7, 1);
  cfgSlider(g, 'ESCORTS BASE', CFG.convoys, 'escortsBase', 0, 4, 1);
  cfgSlider(g, 'ESCORTS MAX', CFG.convoys, 'escortsMax', 1, 6, 1);
  cfgSlider(g, 'HUNTER PACK @HEAT', CFG.convoys, 'hunterPackHeat', 0.5, 5, 0.1);
}

// ---------------------------------------------------------------- PLAYER
{
  const g = group('PLAYER BOAT (live)');
  cfgSlider(g, 'FLANK SPD', CFG.player.telegraph, 'flank', 8, 26, 0.5);
  cfgSlider(g, 'FULL SPD', CFG.player.telegraph, 'full', 6, 20, 0.5);
  cfgSlider(g, 'HALF SPD', CFG.player.telegraph, 'half', 4, 14, 0.5);
  cfgSlider(g, 'SLOW SPD', CFG.player.telegraph, 'slow', 2, 8, 0.2);
  cfgSlider(g, 'YAW RATE', CFG.player, 'yawRate', 0.1, 1.2, 0.02);
  cfgSlider(g, 'VERT RATE', CFG.player, 'vertRate', 2, 14, 0.2);
  cfgSlider(g, 'MAX HP', CFG.player, 'maxHp', 25, 400, 25);
  cfgSlider(g, 'CRUSH DPS', CFG.player, 'crushDps', 1, 30, 1);
}

// ---------------------------------------------------------------- WORLD
{
  const g = group('WORLD / WATER (live)');
  const apply = () => api.applyWorld();
  cfgSlider(g, 'FOG SHALLOW', CFG.world, 'fogShallow', 0.001, 0.012, 0.0002, apply);
  cfgSlider(g, 'FOG DEEP', CFG.world, 'fogDeep', 0.002, 0.02, 0.0002, apply);
  cfgSlider(g, 'SUN', CFG.world, 'sunIntensity', 0, 5, 0.1, apply);
  cfgSlider(g, 'HEMI', CFG.world, 'hemiIntensity', 0, 2, 0.05, apply);
  cfgSlider(g, 'EXPOSURE', CFG.world, 'exposure', 0.4, 2.2, 0.02, apply);
  cfgSlider(g, 'SNOW RATE', CFG.world, 'snowRate', 0, 60, 2);
  cfgSlider(g, 'SHAFT ×', CFG.world, 'shaftOpacity', 0, 3, 0.1);
  slider(g, 'LAYER DEPTH', {
    min: 60, max: 200, step: 2,
    get: () => Math.round(-rt.layerY),
    set: (v) => { CFG.world.layerDepth = v; setLayerY(-v); },
  });
  cfgSlider(g, 'CRUSH DEPTH', CFG.world, 'crushDepth', 120, 320, 4);
  cfgSlider(g, 'PERISCOPE D', CFG.world, 'periscopeDepth', 6, 25, 1);
}

// ---------------------------------------------------------------- CAMERA
{
  const g = group('CAMERA (live)');
  cfgSlider(g, 'DISTANCE', CFG.camera, 'dist', 12, 90, 1, (v) => { rt.camDist = v; });
  cfgSlider(g, 'HEIGHT K', CFG.camera, 'heightK', 0.05, 1, 0.02);
  cfgSlider(g, 'POS DAMP', CFG.camera, 'posDamp', 1, 12, 0.5);
  cfgSlider(g, 'LOOK DAMP', CFG.camera, 'lookDamp', 1, 15, 0.5);
  cfgSlider(g, 'SHAKE ×', CFG.camera, 'shakeMag', 0, 3, 0.1);
  cfgSlider(g, 'TRAUMA DECAY', CFG.camera, 'traumaDecay', 0.3, 4, 0.1);
}

// ---------------------------------------------------------------- AUDIO
{
  const g = group('AUDIO');
  const apply = () => api.applyAudio();
  cfgSlider(g, 'MASTER', CFG.audio, 'master', 0, 1, 0.02, apply);
  cfgSlider(g, 'SFX ×', CFG.audio, 'sfx', 0, 2, 0.05);
  cfgSlider(g, 'ENGINE ×', CFG.audio, 'engine', 0, 2, 0.05);
  cfgSlider(g, 'AMBIENCE ×', CFG.audio, 'ambience', 0, 2, 0.05, apply);
  const r0 = btnRow(g);
  const muteBtn = btn(r0, 'MUTE [M]', () => { muteBtn.classList.toggle('on', api.toggleMute()); }, 'ghost');
  const r = btnRow(g);
  for (const name of ['ping', 'enemyPing', 'echoHit', 'torpedoLaunch', 'explosion', 'charge', 'creak', 'groan', 'klaxon', 'splash', 'gunReport', 'decoy', 'telegraph', 'record']) {
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
  btn(r, 'CLEAR RECORDS', () => api.clearRecords(), 'warn');
  const out = document.createElement('pre');
  out.id = 'cfgOut';
  g.append(out);
  note(g, 'COPY puts the non-default values on the clipboard as JSON — paste into <b>js/config.js</b> to bake them in.');
}

// ---------------------------------------------------------------- LEGEND
{
  const g = group('LEGEND');
  note(g,
    'Stage is the live game: <b>W/S</b> telegraph · <b>A/D</b> rudder · <b>Q/E</b> dive/rise · mouse + <b>LMB</b> torpedoes · wheel zooms (over stage).<br>' +
    'SHIP rows are copied at spawn — respawn or spawn fresh hulls to apply. DETECTION/NOISE read live every frame.<br>' +
    'The SIG bar is your raw signature; the white tick is how much the nearest escort actually hears (layer + bottom + silent applied).<br>' +
    'Dying + click returns to range mode. <b>[P]</b> pause · <b>[M]</b> mute.');
}

// ---------------------------------------------------------------- boot
api.startRange();
