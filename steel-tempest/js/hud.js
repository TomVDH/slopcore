// TONK — hud.js
// DOM HUD: armor bar, score, wave, banner, kill feed, hit marker, minimap,
// crosshair element refs. Reads combat state from TONK.rt only — no game import.
import { CFG, rt, fmt, clamp, dist2D } from './config.js';

export const armorBar = document.getElementById('armorBar');
export const armorNum = document.getElementById('armorNum');
export const gunChip = document.getElementById('gunChip');
export const gunTxt = document.getElementById('gunTxt');
export const waveNumEl = document.getElementById('waveNum');
export const hostilesEl = document.getElementById('hostiles');
export const scoreNumEl = document.getElementById('scoreNum');
export const scoreSubEl = document.getElementById('scoreSub');
export const bannerEl = document.getElementById('banner');
export const feedEl = document.getElementById('feed');
export const vignetteEl = document.getElementById('vignette');
export const xhEl = document.getElementById('xh');
export const xhReload = document.getElementById('xhReload');
export const xhInfo = document.getElementById('xhInfo');
export const hmEl = document.getElementById('hm');
export const hintBar = document.getElementById('hintBar');

// crosshair starts centered until the mouse moves
xhEl.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight / 2}px)`;

export function updateArmorHud() {
  const hp = Math.max(0, Math.round(rt.player ? rt.player.hp : 0));
  armorNum.textContent = String(hp);
  armorBar.style.width = clamp(hp / CFG.player.maxHp * 100, 0, 100) + '%';
  armorBar.className = hp <= 35 ? 'crit' : hp <= 65 ? 'warn' : '';
}
export function updateScoreHud() {
  scoreNumEl.textContent = fmt(rt.stats.score, 6);
  scoreSubEl.innerHTML = `KILLS ${fmt(rt.stats.kills, 2)} &nbsp;·&nbsp; BEST ${fmt(Math.max(rt.hiScore, rt.stats.score), 6)}`;
}
export function updateWaveHud() {
  waveNumEl.textContent = `WAVE ${fmt(Math.max(1, rt.wave), 2)}`;
  const alive = rt.enemies.filter(e => e.alive).length;
  hostilesEl.textContent = `HOSTILES — ${alive}${rt.pendingSpawns > 0 ? ` (+${rt.pendingSpawns} INBOUND)` : ''}`;
}
export function banner(big, sub = '') {
  bannerEl.innerHTML = `${big}${sub ? `<div class="sub">${sub}</div>` : ''}`;
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}
export function feed(text, cls = '') {
  const div = document.createElement('div');
  div.className = 'feedItem ' + cls;
  div.textContent = text;
  feedEl.appendChild(div);
  while (feedEl.children.length > 4) feedEl.removeChild(feedEl.firstChild);
  setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 2900);
}
export function hitMarker(kill) {
  hmEl.classList.remove('show', 'kill');
  void hmEl.offsetWidth;
  if (kill) hmEl.classList.add('kill');
  hmEl.classList.add('show');
}

// ---------------------------------------------------------------- minimap
const mmCanvas = document.getElementById('minimap');
const mm = mmCanvas.getContext('2d');
export function drawMinimap() {
  const S = 168, half = S / 2, scale = S / (CFG.world.radius * 2.15);
  mm.clearRect(0, 0, S, S);
  mm.fillStyle = 'rgba(10,11,7,0.6)';
  mm.fillRect(0, 0, S, S);
  // arena ring
  mm.strokeStyle = 'rgba(255,177,77,0.35)';
  mm.lineWidth = 1;
  mm.beginPath(); mm.arc(half, half, CFG.world.radius * scale, 0, Math.PI * 2); mm.stroke();
  mm.strokeStyle = 'rgba(255,177,77,0.12)';
  mm.beginPath(); mm.moveTo(half, 4); mm.lineTo(half, S - 4); mm.moveTo(4, half); mm.lineTo(S - 4, half); mm.stroke();
  const px = (x) => half + x * scale, pz = (z) => half + z * scale;
  // wrecks
  mm.fillStyle = 'rgba(120,110,95,0.5)';
  for (const w of rt.wrecks) mm.fillRect(px(w.x) - 1.5, pz(w.z) - 1.5, 3, 3);
  // pickups
  mm.fillStyle = '#9ee06a';
  for (const p of rt.pickups) { mm.beginPath(); mm.arc(px(p.x), pz(p.z), 2.6, 0, Math.PI * 2); mm.fill(); }
  // enemies
  for (const e of rt.enemies) {
    if (!e.alive) continue;
    mm.fillStyle = e.variant === 'heavy' ? '#ff3b26' : e.variant === 'scout' ? '#ff9a4a' : '#ff5440';
    const r = e.variant === 'heavy' ? 3.4 : 2.4;
    mm.fillRect(px(e.pos.x) - r / 2, pz(e.pos.z) - r / 2, r, r);
  }
  // player
  if (rt.player) {
    const x = px(rt.player.pos.x), y = pz(rt.player.pos.z);
    // turret direction line
    const ta = rt.player.heading + rt.player.turretYaw;
    mm.strokeStyle = 'rgba(255,208,137,0.8)';
    mm.beginPath(); mm.moveTo(x, y); mm.lineTo(x + Math.sin(ta) * 13, y + Math.cos(ta) * 13); mm.stroke();
    mm.save();
    mm.translate(x, y);
    mm.rotate(Math.PI - rt.player.heading);
    mm.fillStyle = '#ffd089';
    mm.beginPath(); mm.moveTo(0, -5); mm.lineTo(3.6, 4); mm.lineTo(-3.6, 4); mm.closePath(); mm.fill();
    mm.restore();
  }
}
