// SOOB — camera.js
// Underwater chase cam: hangs behind and above the boat, pulled toward the
// fire solution, clamped inside the water column. Trauma shake, wheel zoom
// (canvas only), slow title/death orbits.
import * as THREE from 'three';
import { CFG, rt, clamp, damp, _v3 } from './config.js';
import { renderer, camera } from './scene.js';
import { seabedH } from './world.js';

const camPos = new THREE.Vector3(30, -20, -50);
const camLook = new THREE.Vector3();

// wheel zoom on the canvas only — never hijacks tester panel scrolling
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  rt.camDist = clamp(rt.camDist + Math.sign(e.deltaY) * CFG.camera.wheelStep, CFG.camera.distMin, CFG.camera.distMax);
}, { passive: false });

export function updateCamera(dt, realT) {
  const p = rt.player;
  if (!p) return;
  let tx, ty, tz, lx, ly, lz;
  if (rt.state === 'TITLE') {
    const a = realT * 0.09;
    tx = p.pos.x + Math.cos(a) * 46;
    tz = p.pos.z + Math.sin(a) * 46;
    ty = p.pos.y + 10;
    lx = p.pos.x; ly = p.pos.y + 2; lz = p.pos.z;
  } else if (rt.state === 'GAMEOVER' || rt.state === 'DYING') {
    const a = realT * 0.06;
    tx = p.pos.x + Math.cos(a) * 55;
    tz = p.pos.z + Math.sin(a) * 55;
    ty = p.pos.y + 16;
    lx = p.pos.x; ly = p.pos.y; lz = p.pos.z;
  } else {
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const sol = rt.solution;
    _v3.set(0, 0, 0);
    if (sol) { _v3.set(sol.x - p.pos.x, 0, sol.z - p.pos.z).normalize(); }
    tx = p.pos.x - fx * rt.camDist + _v3.x * CFG.camera.aimPull;
    tz = p.pos.z - fz * rt.camDist + _v3.z * CFG.camera.aimPull;
    ty = p.pos.y + rt.camDist * CFG.camera.heightK;
    const ahead = Math.min(rt.camDist * 1.6, 60);
    lx = p.pos.x + fx * 10 + _v3.x * ahead * CFG.camera.lookAhead;
    ly = p.pos.y + 2;
    lz = p.pos.z + fz * 10 + _v3.z * ahead * CFG.camera.lookAhead;
  }
  const k = rt.state === 'PLAYING' ? CFG.camera.posDamp : CFG.camera.idleDamp;
  camPos.x = damp(camPos.x, tx, k, dt);
  camPos.y = damp(camPos.y, ty, k, dt);
  camPos.z = damp(camPos.z, tz, k, dt);
  // stay inside the water column
  camPos.y = Math.min(camPos.y, -1.6);
  camPos.y = Math.max(camPos.y, seabedH(camPos.x, camPos.z) + 3);
  camLook.x = damp(camLook.x, lx, CFG.camera.lookDamp, dt);
  camLook.y = damp(camLook.y, ly, CFG.camera.lookDamp, dt);
  camLook.z = damp(camLook.z, lz, CFG.camera.lookDamp, dt);

  // trauma shake
  rt.trauma = Math.max(0, rt.trauma - dt * CFG.camera.traumaDecay);
  const sh = rt.trauma * rt.trauma * CFG.camera.shakeMag;
  const t37 = realT * 37, t43 = realT * 41;
  camera.position.set(
    camPos.x + Math.sin(t37) * sh * 0.8,
    camPos.y + Math.sin(t43 + 1.3) * sh * 0.6,
    camPos.z + Math.cos(t37 * 0.9) * sh * 0.8
  );
  camera.lookAt(camLook.x, camLook.y + Math.sin(realT * 53) * sh * 0.5, camLook.z);
}
