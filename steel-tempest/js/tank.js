// TONK — tank.js
// Tank mesh factory (primitive assembly) + shared drive physics + turret aim.
import * as THREE from 'three';
import { CFG, rt, rand, randSpread, clamp, damp, wrapPI, angleTo, dist2D, _v1, _v2, _v3, _m1 } from './config.js';
import { terrainH, terrainN } from './world.js';
import { smokeP, COL } from './vfx.js';

export function mkMat(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.28 }); }

export function buildTank(pal, scale = 1) {
  const root = new THREE.Group();                  // physics transform
  const body = new THREE.Group(); root.add(body);  // visual lean / recoil kick
  body.scale.setScalar(scale);

  const hullM = mkMat(pal.hull), darkM = mkMat(pal.dark), accM = mkMat(pal.accent);
  const mats = [hullM, darkM, accM];

  const add = (parent, geo, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (opts.rx) m.rotation.x = opts.rx;
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rz) m.rotation.z = opts.rz;
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // hull
  add(body, new THREE.BoxGeometry(3.0, 0.95, 5.4), hullM, 0, 1.05, 0);
  add(body, new THREE.BoxGeometry(3.0, 0.8, 1.5), hullM, 0, 0.95, 3.0, { rx: -0.42 });    // glacis
  add(body, new THREE.BoxGeometry(3.0, 0.7, 1.0), hullM, 0, 0.95, -2.95, { rx: 0.5 });    // rear slope
  add(body, new THREE.BoxGeometry(3.55, 0.12, 5.9), darkM, 0, 1.58, 0);                   // fender deck
  add(body, new THREE.BoxGeometry(0.5, 0.28, 1.1), darkM, -1.0, 1.74, -2.1);              // stowage
  add(body, new THREE.BoxGeometry(0.6, 0.24, 0.8), darkM, 1.05, 1.72, -1.9);
  add(body, new THREE.CylinderGeometry(0.11, 0.11, 0.8, 6), darkM, -1.35, 1.7, -2.6, { rx: Math.PI / 2 }); // exhaust
  add(body, new THREE.CylinderGeometry(0.11, 0.11, 0.8, 6), darkM, -1.05, 1.7, -2.6, { rx: Math.PI / 2 });

  // tracks + skirts + wheels
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1.72, 1.72]) {
    add(body, new THREE.BoxGeometry(0.95, 0.62, 6.1), darkM, sx, 1.0, 0);                 // skirt
    for (let w = 0; w < 5; w++) {
      const wm = add(body, wheelGeo, darkM, sx, 0.46, -2.2 + w * 1.1);
      wheels.push(wm);
    }
  }

  // turret (yaw group sits on hull top)
  const turret = new THREE.Group();
  turret.position.set(0, 1.66, -0.15);
  body.add(turret);
  add(turret, new THREE.BoxGeometry(2.1, 0.62, 2.7), hullM, 0, 0.31, 0);
  add(turret, new THREE.BoxGeometry(2.1, 0.5, 0.9), hullM, 0, 0.27, 1.55, { rx: -0.5 });  // turret cheek
  add(turret, new THREE.CylinderGeometry(0.42, 0.46, 0.3, 10), darkM, -0.45, 0.75, -0.5); // cupola
  add(turret, new THREE.BoxGeometry(0.5, 0.2, 0.7), accM, 0.65, 0.7, -0.6);               // sight box
  add(turret, new THREE.BoxGeometry(1.9, 0.3, 0.5), accM, 0, 0.35, -1.5);                 // bustle stripe
  const ant = add(turret, new THREE.CylinderGeometry(0.018, 0.018, 1.5, 4), darkM, 0.85, 1.2, -1.2);
  ant.rotation.x = -0.12; ant.castShadow = false;

  // barrel on an elevation pivot
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.34, 1.15);
  turret.add(pivot);
  const barrelGeo = new THREE.CylinderGeometry(0.13, 0.16, 3.3, 10);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = add(pivot, barrelGeo, darkM, 0, 0, 1.65);
  add(barrel, new THREE.BoxGeometry(0.34, 0.34, 0.55), darkM, 0, 0, 1.62);                // muzzle brake
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 3.55);
  pivot.add(muzzle);

  // floating health bar (billboard, enemies only — hidden for player)
  const hb = new THREE.Group();
  const hbBg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.22), new THREE.MeshBasicMaterial({ color: 0x141210, transparent: true, opacity: 0.7, depthWrite: false }));
  const hbFg = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.13), new THREE.MeshBasicMaterial({ color: 0x9ee06a, depthWrite: false }));
  hbFg.position.z = 0.001;
  hb.add(hbBg, hbFg);
  hb.position.y = 3.6 * scale;
  hb.visible = false;
  root.add(hb);

  return { root, body, turret, pivot, barrel, muzzle, wheels, mats, hb, hbFg };
}

export const PAL = {
  player: { hull: 0x57663f, dark: 0x2c3326, accent: 0x76855a },
  std:    { hull: 0x77452f, dark: 0x3a2620, accent: 0x8f5c3c },
  scout:  { hull: 0x7c7257, dark: 0x3c382c, accent: 0x95896a },
  heavy:  { hull: 0x474c52, dark: 0x26282c, accent: 0x84352c },
};

export function makeBaseTank(mesh, x, z, radius) {
  return {
    mesh, pos: new THREE.Vector3(x, terrainH(x, z), z),
    heading: 0, speed: 0, prevSpeed: 0, turretYaw: 0,
    up: new THREE.Vector3(0, 1, 0), lean: new THREE.Vector3(),
    pitchKick: 0, radius, alive: true, dustAcc: 0,
  };
}

// ---------------------------------------------------------------- shared physics
export function moveTank(t, throttle, turn, dt, spec) {
  // throttle ∈ [-1,1], turn ∈ [-1,1]
  const targetSpeed = throttle >= 0 ? throttle * spec.maxFwd : throttle * spec.maxRev;
  t.speed = damp(t.speed, targetSpeed, spec.accel * 0.22, dt);
  t.heading += turn * spec.yawRate * dt * (t.speed < -0.5 ? -1 : 1); // reversing flips steering like a real tank feel
  const fx = Math.sin(t.heading), fz = Math.cos(t.heading);
  t.pos.x += fx * t.speed * dt;
  t.pos.z += fz * t.speed * dt;

  // world bound
  const r = Math.hypot(t.pos.x, t.pos.z);
  if (r > CFG.world.radius) {
    t.pos.x *= CFG.world.radius / r;
    t.pos.z *= CFG.world.radius / r;
    t.speed *= 0.4;
  }

  // obstacle pushout
  for (const o of rt.obstacles) {
    if (o.r < 0.45) continue;
    const d = dist2D(t.pos.x, t.pos.z, o.x, o.z);
    const min = o.r + t.radius;
    if (d < min && d > 0.001) {
      const push = (min - d);
      t.pos.x += (t.pos.x - o.x) / d * push;
      t.pos.z += (t.pos.z - o.z) / d * push;
      t.speed *= 0.92;
    }
  }
  t.pos.y = terrainH(t.pos.x, t.pos.z);

  // orient to terrain
  terrainN(t.pos.x, t.pos.z, _v1);
  t.up.lerp(_v1, 1 - Math.exp(-8 * dt)).normalize();
  _v2.set(fx, 0, fz);
  _v3.crossVectors(t.up, _v2).normalize();        // right = up × fwd
  _v2.crossVectors(_v3, t.up).normalize();        // fwd  = right × up
  _m1.makeBasis(_v3, t.up, _v2);
  t.mesh.root.quaternion.setFromRotationMatrix(_m1);
  t.mesh.root.position.copy(t.pos);

  // wheel spin + visual lean
  for (const w of t.mesh.wheels) w.rotation.x += t.speed * dt / 0.42;
  const targetPitch = clamp((t.prevSpeed - t.speed) * 0.05, -0.05, 0.05) + t.pitchKick;
  const targetRoll = clamp(turn * t.speed * 0.012, -0.08, 0.08);
  t.lean.x = damp(t.lean.x, targetPitch, 7, dt);
  t.lean.z = damp(t.lean.z, targetRoll, 7, dt);
  t.mesh.body.rotation.x = t.lean.x;
  t.mesh.body.rotation.z = t.lean.z;
  t.pitchKick = damp(t.pitchKick, 0, 9, dt);
  t.prevSpeed = t.speed;

  // drive dust
  if (Math.abs(t.speed) > 2.5) {
    t.dustAcc = (t.dustAcc || 0) + dt * Math.abs(t.speed) * 0.55;
    while (t.dustAcc > 1) {
      t.dustAcc -= 1;
      const back = t.speed > 0 ? -1 : 1;
      smokeP.spawn({
        x: t.pos.x + Math.sin(t.heading) * 2.4 * back + randSpread(1.2),
        y: t.pos.y + 0.3,
        z: t.pos.z + Math.cos(t.heading) * 2.4 * back + randSpread(1.2),
        vx: randSpread(0.8), vy: rand(0.5, 1.5), vz: randSpread(0.8),
        c0: COL.dust0, c1: COL.dust1, life: rand(0.8, 1.6), s0: rand(0.8, 1.4), s1: rand(2.6, 4), a: 0.34, drag: 1.2, curve: 1,
      });
    }
  }
}

export function aimTurret(t, targetX, targetZ, rate, dt) {
  const yawWorld = Math.atan2(targetX - t.pos.x, targetZ - t.pos.z);
  const localTarget = wrapPI(yawWorld - t.heading);
  t.turretYaw = angleTo(t.turretYaw, localTarget, rate * dt);
  t.mesh.turret.rotation.y = t.turretYaw;
  return Math.abs(wrapPI(localTarget - t.turretYaw)); // remaining error
}
