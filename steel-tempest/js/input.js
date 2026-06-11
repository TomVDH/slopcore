// TONK — input.js
// Keyboard/mouse state + aim raycast. Upward calls (start/pause) go through
// TONK.api, which main.js fills at boot — handlers only fire after that.
import * as THREE from 'three';
import { TONK, rt, clamp, _v1, _v2, _v3 } from './config.js';
import { canvas, camera } from './scene.js';
import { terrainH } from './world.js';
import { audioInit, audioResume, toggleMute } from './audio.js';
import { xhEl, feed } from './hud.js';

export const keys = new Set();
export let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
export let mouseDown = false;
export const aimPoint = new THREE.Vector3(0, 0, 40);

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyM') {
    const muted = toggleMute();
    feed(muted ? 'SOUND OFF' : 'SOUND ON');
  }
  if (e.code === 'KeyP' && (rt.state === 'PLAYING' || rt.state === 'DYING')) TONK.api.togglePause();
  if (e.code === 'KeyR' && rt.state === 'GAMEOVER') TONK.api.start();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && rt.state === 'PLAYING' && !rt.paused) TONK.api.togglePause();
});
addEventListener('mousemove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  xhEl.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
});
addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  audioInit();
  audioResume();
  // tester control panel clicks must never fire the cannon / start the game
  if (e.target.closest && e.target.closest('#tester-panel')) return;
  if (rt.state === 'TITLE') { TONK.api.start(); return; }
  if (rt.state === 'GAMEOVER') { TONK.api.start(); return; }
  if (rt.paused) { TONK.api.togglePause(); return; }
  mouseDown = true;
});
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('contextmenu', (e) => e.preventDefault());

export function updateAim() {
  const r = canvas.getBoundingClientRect();
  const nx = ((mouseX - r.left) / Math.max(1, r.width)) * 2 - 1;
  const ny = -((mouseY - r.top) / Math.max(1, r.height)) * 2 + 1;
  _v1.set(nx, ny, 0.5).unproject(camera);
  _v2.copy(_v1).sub(camera.position).normalize();
  let t;
  if (_v2.y < -0.015) {
    t = (0 - camera.position.y) / _v2.y;
    // refine against actual terrain height once
    _v3.copy(camera.position).addScaledVector(_v2, t);
    const h = terrainH(_v3.x, _v3.z);
    t = (h - camera.position.y) / _v2.y;
  } else t = 120;
  t = clamp(t, 6, 700);
  aimPoint.copy(camera.position).addScaledVector(_v2, t);
  aimPoint.y = Math.max(aimPoint.y, terrainH(aimPoint.x, aimPoint.z));
}
