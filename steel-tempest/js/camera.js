// TONK — camera.js
// Third-person follow cam, title/death orbits, trauma shake, wheel zoom,
// sun + shadow-box follow.
import * as THREE from 'three';
import { CFG, rt, clamp, damp, _v3 } from './config.js';
import { renderer, camera, sun } from './scene.js';
import { terrainH } from './world.js';
import { aimPoint } from './input.js';

const camPos = new THREE.Vector3(18, 10, -18);
const camLook = new THREE.Vector3();

// wheel zoom on the canvas only — never hijacks tester panel scrolling
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  rt.camDist = clamp(rt.camDist + Math.sign(e.deltaY) * CFG.camera.wheelStep, CFG.camera.distMin, CFG.camera.distMax);
}, { passive: false });

export function updateCamera(dt, realT) {
  const player = rt.player;
  if (!player) return;
  let tx, ty, tz, lx, ly, lz;
  if (rt.state === 'TITLE') {
    const a = realT * 0.12;
    tx = player.pos.x + Math.cos(a) * 17;
    tz = player.pos.z + Math.sin(a) * 17;
    ty = player.pos.y + 6.2;
    lx = player.pos.x; ly = player.pos.y + 1.6; lz = player.pos.z;
  } else if (rt.state === 'GAMEOVER' || rt.state === 'DYING') {
    const a = realT * 0.07;
    tx = player.pos.x + Math.cos(a) * 20;
    tz = player.pos.z + Math.sin(a) * 20;
    ty = player.pos.y + 8.5;
    lx = player.pos.x; ly = player.pos.y + 1.2; lz = player.pos.z;
  } else {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    _v3.copy(aimPoint).sub(player.pos); _v3.y = 0;
    const aimLen = Math.min(_v3.length(), 30);
    _v3.normalize();
    tx = player.pos.x - fx * rt.camDist + _v3.x * CFG.camera.aimPull;
    tz = player.pos.z - fz * rt.camDist + _v3.z * CFG.camera.aimPull;
    ty = player.pos.y + rt.camDist * CFG.camera.heightK + CFG.camera.heightBase;
    lx = player.pos.x + fx * 5 + _v3.x * aimLen * CFG.camera.lookAhead;
    ly = player.pos.y + 2.1;
    lz = player.pos.z + fz * 5 + _v3.z * aimLen * CFG.camera.lookAhead;
  }
  const k = rt.state === 'PLAYING' ? CFG.camera.posDamp : CFG.camera.idleDamp;
  camPos.x = damp(camPos.x, tx, k, dt);
  camPos.y = damp(camPos.y, ty, k, dt);
  camPos.z = damp(camPos.z, tz, k, dt);
  // keep above terrain
  camPos.y = Math.max(camPos.y, terrainH(camPos.x, camPos.z) + 2.2);
  camLook.x = damp(camLook.x, lx, CFG.camera.lookDamp, dt);
  camLook.y = damp(camLook.y, ly, CFG.camera.lookDamp, dt);
  camLook.z = damp(camLook.z, lz, CFG.camera.lookDamp, dt);

  // shake
  rt.trauma = Math.max(0, rt.trauma - dt * CFG.camera.traumaDecay);
  const sh = rt.trauma * rt.trauma * CFG.camera.shakeMag;
  const t37 = realT * 37, t43 = realT * 41;
  camera.position.set(
    camPos.x + Math.sin(t37) * sh * 0.55,
    camPos.y + Math.sin(t43 + 1.3) * sh * 0.45,
    camPos.z + Math.cos(t37 * 0.9) * sh * 0.55
  );
  camera.lookAt(camLook.x, camLook.y + Math.sin(realT * 53) * sh * 0.35, camLook.z);

  // sun + shadow box follow (snapped to reduce shimmer)
  const sx = Math.round(player.pos.x / 8) * 8, sz = Math.round(player.pos.z / 8) * 8;
  sun.position.set(sx + 60, 85, sz + 35);
  sun.target.position.set(sx, 0, sz);
}
