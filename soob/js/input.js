// SOOB — input.js
// Keyboard/mouse state + the aim ray (computed from the canvas rect, so the
// tester's scoped stage aims true). Upward calls (start/pause/fire) go
// through SOOB.api, which main.js fills at boot.
import * as THREE from 'three';
import { SOOB, rt } from './config.js';
import { canvas, camera } from './scene.js';
import { audioInit, audioResume, toggleMute } from './audio.js';
import { xhEl, feed } from './hud.js';

export const keys = new Set();
export let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
export let mouseDown = false;
// aim ray in world space, refreshed every frame from the canvas rect
export const aimOrigin = new THREE.Vector3();
export const aimDir = new THREE.Vector3(0, 0, 1);

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  const api = SOOB.api;
  if (e.code === 'KeyM') {
    audioInit();
    feed(toggleMute() ? 'SOUND OFF' : 'SOUND ON');
  }
  if (e.code === 'KeyP' && (rt.state === 'PLAYING' || rt.state === 'DYING')) api.togglePause?.();
  if (e.code === 'KeyR' && rt.state === 'GAMEOVER') api.start?.();
  if (rt.state === 'PLAYING' && !rt.paused && rt.player?.alive) {
    if (e.code === 'KeyW') api.telegraphStep?.(1);
    if (e.code === 'KeyS') api.telegraphStep?.(-1);
    if (e.code === 'KeyC') api.silent?.();
    if (e.code === 'KeyF') api.ping?.();
    if (e.code === 'KeyX') api.decoy?.();
    if (e.code === 'Space') api.fire?.();
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && rt.state === 'PLAYING' && !rt.paused) SOOB.api.togglePause?.();
});
addEventListener('mousemove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (xhEl) xhEl.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
});
addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  audioInit();
  audioResume();
  // tester control panel clicks must never fire torpedoes / start the game
  if (e.target.closest && e.target.closest('#tester-panel')) return;
  if (rt.state === 'TITLE') { SOOB.api.start?.(); return; }
  if (rt.state === 'GAMEOVER') { SOOB.api.start?.(); return; }
  if (rt.paused) { SOOB.api.togglePause?.(); return; }
  if (rt.state === 'PLAYING' && rt.player?.alive) SOOB.api.fire?.();
  mouseDown = true;
});
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('contextmenu', (e) => e.preventDefault());

export function updateAim() {
  const r = canvas.getBoundingClientRect();
  const nx = ((mouseX - r.left) / Math.max(1, r.width)) * 2 - 1;
  const ny = -((mouseY - r.top) / Math.max(1, r.height)) * 2 + 1;
  aimOrigin.copy(camera.position);
  aimDir.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
}
