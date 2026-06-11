// SOOB — hud.js
// The conn: DOM gauges + two CRT canvases (sonar scope with phosphor
// persistence, vertical depth gauge with layer/crush markers). Reads rt only.
import { CFG, rt, clamp, lerp, fmt, fmtTime, depthOf, belowLayer, TELEGRAPH_LABELS } from './config.js';
import { seabedH } from './world.js';

const $ = (id) => document.getElementById(id);
export const vignetteEl = $('vignette');
export const xhEl = $('xh');
export const xhInfo = $('xhInfo');
const hullNum = $('hullNum'), hullBar = $('hullBar');
const depthNum = $('depthNum');
const tonNum = $('tonNum'), tonSub = $('tonSub');
const alertChip = $('alertChip'), chargeWarn = $('chargeWarn');
const teleList = $('teleList');
const lampSilent = $('lampSilent'), lampCav = $('lampCav'), lampLayer = $('lampLayer');
const sigBar = $('sigBar'), sigTick = $('sigTick');
const tubesEl = $('tubes'), decoyNum = $('decoyNum');
const bannerEl = $('banner'), feedEl = $('feed');
const hintBar = $('hintBar');

// telegraph rows (built once)
const teleRows = [];
if (teleList) {
  TELEGRAPH_LABELS.forEach((label) => {
    const li = document.createElement('div');
    li.className = 'teleRow';
    li.textContent = label;
    teleList.prepend(li); // flank on top, astern at the bottom
    teleRows.push(li);
  });
}
// tube pips
const tubePips = [];
if (tubesEl) {
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'tube';
    tubesEl.append(p);
    tubePips.push(p);
  }
}

// ---------------------------------------------------------------- messages
let bannerT = null;
export function banner(title, sub = '') {
  if (!bannerEl) return;
  bannerEl.innerHTML = `${title}${sub ? `<div class="sub">${sub}</div>` : ''}`;
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => bannerEl.classList.remove('show'), 2700);
}
export function feed(msg, cls = '') {
  if (!feedEl) return;
  const d = document.createElement('div');
  d.className = 'feedItem ' + cls;
  d.textContent = msg;
  feedEl.append(d);
  while (feedEl.children.length > 5) feedEl.firstChild.remove();
  setTimeout(() => d.remove(), 3000);
}
export function fadeHints() { if (hintBar) hintBar.classList.add('faded'); }
export function showHints() { if (hintBar) hintBar.classList.remove('faded'); }

// ---------------------------------------------------------------- panels
export function updateHullHud() {
  const p = rt.player; if (!p || !hullNum) return;
  const pct = clamp(p.hp / CFG.player.maxHp, 0, 1);
  hullNum.textContent = Math.max(0, Math.round(p.hp));
  hullBar.style.width = (pct * 100).toFixed(1) + '%';
  hullBar.className = pct < 0.28 ? 'crit' : pct < 0.55 ? 'warn' : '';
  document.body.classList.toggle('crit', pct < 0.28 && rt.state === 'PLAYING');
}
export function updateScoreHud() {
  if (!tonNum) return;
  tonNum.textContent = rt.stats.tonnage.toLocaleString('en-US') + ' t';
  tonSub.textContent = `SHIPS ${fmt(rt.stats.ships, 2)} · BEST ${rt.records.tonnage.toLocaleString('en-US')} t`;
}
export function updateAlertHud() {
  if (!alertChip) return;
  const a = rt.alert;
  alertChip.textContent = a === 2 ? 'HUNTED' : a === 1 ? 'ESCORT SUSPICIOUS' : 'UNDETECTED';
  alertChip.className = a === 2 ? 'hunted' : a === 1 ? 'sus' : '';
  if (chargeWarn) chargeWarn.classList.toggle('show', rt.chargesNear === true);
}
export function updateConnHud() {
  const p = rt.player; if (!p) return;
  if (depthNum) {
    const d = depthOf(p.pos.y);
    depthNum.textContent = fmt(d, 3);
    depthNum.classList.toggle('danger', d > CFG.world.crushDepth);
  }
  teleRows.forEach((r, i) => {
    // teleRows[i] is TELEGRAPH_LABELS[i] (prepending only affects display order)
    r.classList.toggle('on', p.telegraphIdx === i);
    r.classList.toggle('capped', p.silent && i > CFG.player.silentCapIdx);
  });
  if (lampSilent) lampSilent.classList.toggle('on', p.silent);
  if (lampCav) lampCav.classList.toggle('on', p.cav);
  if (lampLayer) lampLayer.classList.toggle('on', belowLayer(p.pos.y));
  if (sigBar) {
    sigBar.style.height = clamp(p.noise / 120, 0, 1) * 100 + '%';
    sigBar.className = p.cav ? 'loud' : p.noise > 45 ? 'mid' : '';
  }
  if (sigTick) {
    sigTick.style.bottom = clamp(rt.exposure, 0, 1) * 100 + '%';
    sigTick.classList.toggle('hot', rt.exposure > 0.5);
  }
  tubePips.forEach((pip, i) => {
    if (i >= CFG.torpedo.tubes) { pip.style.display = 'none'; return; }
    pip.style.display = '';
    const t = p.tubes[i];
    if (t <= 0) { pip.className = 'tube ready'; pip.style.background = ''; }
    else {
      const pct = (1 - t / CFG.torpedo.reloadT) * 100;
      pip.className = 'tube loading';
      pip.style.background = `linear-gradient(0deg, var(--phos-dim) ${pct}%, transparent ${pct}%)`;
    }
  });
  if (decoyNum) decoyNum.textContent = `DECOY ×${p.decoys}`;
}

// ---------------------------------------------------------------- sonar scope
const scope = $('scope');
const sctx = scope ? scope.getContext('2d') : null;
let sweepA = 0;
const SCOPE_RANGE = 950;

export function drawScope(rawDt) {
  if (!sctx) return;
  const W = scope.width, H = scope.height, cx = W / 2, cy = H / 2, R = W / 2 - 6;
  // phosphor persistence: tint toward face colour instead of clearing
  sctx.fillStyle = 'rgba(3, 14, 11, 0.085)';
  sctx.fillRect(0, 0, W, H);

  const p = rt.player;
  sctx.save();
  sctx.beginPath(); sctx.arc(cx, cy, R, 0, Math.PI * 2); sctx.clip();

  // static furniture (faint, redrawn so persistence doesn't eat it)
  sctx.strokeStyle = 'rgba(73,255,174,0.14)';
  sctx.lineWidth = 1;
  for (const rr of [R / 3, (R * 2) / 3, R]) {
    sctx.beginPath(); sctx.arc(cx, cy, rr, 0, Math.PI * 2); sctx.stroke();
  }
  sctx.beginPath(); sctx.moveTo(cx - R, cy); sctx.lineTo(cx + R, cy);
  sctx.moveTo(cx, cy - R); sctx.lineTo(cx, cy + R); sctx.stroke();

  if (p) {
    const toXY = (wx, wz) => {
      const dx = wx - p.pos.x, dz = wz - p.pos.z;
      const d = Math.hypot(dx, dz);
      const r = Math.min(d / SCOPE_RANGE, 1) * R;
      // north-up: +z is up on the scope
      return [cx + (dx / (d || 1)) * r, cy - (dz / (d || 1)) * r, d];
    };

    // own heading line
    sctx.strokeStyle = 'rgba(73,255,174,0.5)';
    sctx.beginPath(); sctx.moveTo(cx, cy);
    sctx.lineTo(cx + Math.sin(p.heading) * 16, cy - Math.cos(p.heading) * 16);
    sctx.stroke();

    // sweep
    sweepA += rawDt * (Math.PI * 2 / 2.6);
    if (sweepA > Math.PI * 2) sweepA -= Math.PI * 2;
    const grad = sctx.createLinearGradient(
      cx, cy, cx + Math.cos(sweepA - Math.PI / 2) * R, cy + Math.sin(sweepA - Math.PI / 2) * R);
    grad.addColorStop(0, 'rgba(73,255,174,0.05)');
    grad.addColorStop(1, 'rgba(120,255,200,0.55)');
    sctx.strokeStyle = grad;
    sctx.lineWidth = 2;
    sctx.beginPath(); sctx.moveTo(cx, cy);
    sctx.lineTo(cx + Math.cos(sweepA - Math.PI / 2) * R, cy + Math.sin(sweepA - Math.PI / 2) * R);
    sctx.stroke();

    // contacts: lit when the sweep passes their bearing, then persistence fades them
    for (const c of rt.contacts) {
      const [x, y, d] = toXY(c.x, c.z);
      if (d > SCOPE_RANGE * 1.45) continue;
      const bearing = Math.atan2(x - cx, -(y - cy)); // screen bearing
      let da = Math.abs(((bearing - sweepA) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const lit = da < rawDt * (Math.PI * 2 / 2.6) + 0.05;
      const isTorp = c.kind === 'torpedo';
      const isDecoy = c.kind === 'decoy';
      if (lit || isTorp || c.flash > 0) {
        const a = clamp((isTorp ? 0.95 : c.strength) * (d > SCOPE_RANGE ? 0.4 : 1), 0.12, 1);
        sctx.fillStyle =
          c.kind === 'escort' ? `rgba(255,83,70,${a})` :
          isTorp ? 'rgba(180,255,220,0.95)' :
          isDecoy ? `rgba(120,235,210,${a})` : `rgba(73,255,174,${a})`;
        sctx.beginPath();
        if (c.kind === 'escort') { // hostile: triangle
          sctx.moveTo(x, y - 4); sctx.lineTo(x + 3.6, y + 3); sctx.lineTo(x - 3.6, y + 3); sctx.closePath();
        } else if (isTorp) {
          sctx.rect(x - 1.4, y - 1.4, 2.8, 2.8);
        } else {
          sctx.arc(x, y, c.kind === 'merchant' ? 3.2 : 2.4, 0, Math.PI * 2);
        }
        sctx.fill();
        if (c.flash > 0) c.flash -= rawDt;
      }
    }

    // active ping wavefronts (mirrored on the scope)
    for (const ping of rt.pings) {
      const [x, y] = toXY(ping.x, ping.z);
      const rr = (ping.r / SCOPE_RANGE) * R;
      if (rr > R * 2.2) continue;
      sctx.strokeStyle = ping.mine ? `rgba(73,255,174,${0.5 * (1 - ping.r / ping.maxR)})`
                                   : `rgba(255,83,70,${0.55 * (1 - ping.r / ping.maxR)})`;
      sctx.lineWidth = 1.6;
      sctx.beginPath(); sctx.arc(x, y, rr, 0, Math.PI * 2); sctx.stroke();
    }
  }
  sctx.restore();

  // being-pinged flash: the whole face blooms red
  if (rt.pingFlash > 0) {
    sctx.fillStyle = `rgba(255,83,70,${0.09 * rt.pingFlash})`;
    sctx.beginPath(); sctx.arc(cx, cy, R, 0, Math.PI * 2); sctx.fill();
    rt.pingFlash = Math.max(0, rt.pingFlash - rawDt * 1.4);
  }

  // bezel
  sctx.strokeStyle = 'rgba(73,255,174,0.55)';
  sctx.lineWidth = 2;
  sctx.beginPath(); sctx.arc(cx, cy, R + 2, 0, Math.PI * 2); sctx.stroke();
}

// ---------------------------------------------------------------- depth gauge
const gauge = $('depthGauge');
const gctx = gauge ? gauge.getContext('2d') : null;

export function drawDepthGauge() {
  if (!gctx) return;
  const p = rt.player; if (!p) return;
  const W = gauge.width, H = gauge.height;
  gctx.clearRect(0, 0, W, H);
  const pad = 12, span = H - pad * 2;
  const MAXD = 320; // gauge bottom
  const yOf = (depth) => pad + clamp(depth / MAXD, 0, 1) * span;

  // rail
  gctx.strokeStyle = 'rgba(73,255,174,0.4)';
  gctx.lineWidth = 2;
  gctx.beginPath(); gctx.moveTo(16, pad); gctx.lineTo(16, H - pad); gctx.stroke();
  gctx.font = '13px VT323, monospace';
  gctx.textBaseline = 'middle';

  // depth ticks every 50m
  for (let d = 0; d <= MAXD; d += 50) {
    const y = yOf(d);
    gctx.strokeStyle = 'rgba(73,255,174,0.3)';
    gctx.beginPath(); gctx.moveTo(12, y); gctx.lineTo(20, y); gctx.stroke();
    gctx.fillStyle = 'rgba(73,255,174,0.45)';
    gctx.fillText(String(d), 24, y);
  }
  let lastLabelY = -99;
  const mark = (depth, color, label) => {
    const y = yOf(depth);
    gctx.strokeStyle = color;
    gctx.beginPath(); gctx.moveTo(8, y); gctx.lineTo(24, y); gctx.stroke();
    gctx.fillStyle = color;
    const ly = y - lastLabelY < 13 ? lastLabelY + 13 : y; // dodge the label above
    gctx.fillText(label, 48, ly);
    lastLabelY = ly;
  };
  mark(CFG.world.periscopeDepth, 'rgba(120,235,210,0.8)', 'PD');
  mark(depthOf(rt.layerY), 'rgba(120,200,255,0.8)', 'LAYER');
  mark(CFG.world.crushDepth, 'rgba(255,83,70,0.9)', 'CRUSH');
  const floorD = depthOf(seabedH(p.pos.x, p.pos.z));
  mark(Math.min(floorD, MAXD), 'rgba(160,140,90,0.8)', 'BTM');

  // own boat marker
  const py = yOf(depthOf(p.pos.y));
  gctx.fillStyle = '#49ffae';
  gctx.beginPath();
  gctx.moveTo(16, py); gctx.lineTo(8, py - 5); gctx.lineTo(8, py + 5); gctx.closePath();
  gctx.fill();
  gctx.shadowColor = '#49ffae'; gctx.shadowBlur = 6;
  gctx.fill();
  gctx.shadowBlur = 0;
}
