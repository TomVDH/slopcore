// TONK — game.js
// The combat core, deliberately co-located: shells ↔ player ↔ enemies ↔
// pickups ↔ waves all cross-call, so they live together. Shared state on
// TONK.rt; arrays aliased once and only mutated in place.
import * as THREE from 'three';
import {
  CFG, rt, HI_KEY, rand, randSpread, clamp, lerp, damp, wrapPI, dist2D, fmt,
  addTrauma, _v1, _v2, _v3, _q1,
} from './config.js';
import { scene, camera } from './scene.js';
import { terrainH, staticObstacles } from './world.js';
import { sfx, updateEngine } from './audio.js';
import { explosion, muzzleFx, smokeEmitters, smokeP, fireP, COL, clearVfx } from './vfx.js';
import { buildTank, makeBaseTank, moveTank, aimTurret, PAL } from './tank.js';
import {
  updateArmorHud, updateScoreHud, updateWaveHud, banner, feed, hitMarker,
  gunChip, gunTxt, hintBar,
} from './hud.js';
import { keys, mouseDown, aimPoint, updateAim } from './input.js';

const enemies = rt.enemies;
const debris = rt.debris;
const wrecks = rt.wrecks;
const pickups = rt.pickups;
const stats = rt.stats;

// ---------------------------------------------------------------- timers
const simTimers = [];
const realTimers = [];
export function after(t, fn) { simTimers.push({ t: rt.simTime + t, fn }); }
export function afterReal(t, fn) { realTimers.push({ t: performance.now() / 1000 + t, fn }); }
export function tickTimers() {
  for (let i = simTimers.length - 1; i >= 0; i--) {
    if (rt.simTime >= simTimers[i].t) { const f = simTimers[i].fn; simTimers.splice(i, 1); f(); }
  }
  const nowR = performance.now() / 1000;
  for (let i = realTimers.length - 1; i >= 0; i--) {
    if (nowR >= realTimers[i].t) { const f = realTimers[i].fn; realTimers.splice(i, 1); f(); }
  }
}

// ---------------------------------------------------------------- shells
const shells = [];
const shellGeo = new THREE.SphereGeometry(0.17, 8, 8);
for (let i = 0; i < 40; i++) {
  const mesh = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: 0xffd089 }));
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9030, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.add(glow);
  mesh.visible = false;
  scene.add(mesh);
  shells.push({ mesh, glow, pos: new THREE.Vector3(), vel: new THREE.Vector3(), alive: false, team: 0, dmg: 0, whizzed: false, trailAcc: 0 });
}
export function fireShell(fromPos, targetPos, speed, team, dmg, color) {
  const s = shells.find(s => !s.alive);
  if (!s) return;
  s.alive = true; s.team = team; s.dmg = dmg; s.whizzed = false; s.trailAcc = 0;
  s.pos.copy(fromPos);
  const dx = targetPos.x - fromPos.x, dz = targetPos.z - fromPos.z;
  const d = Math.max(2, Math.hypot(dx, dz));
  const tFly = d / speed;
  s.vel.set(dx / d * speed, (targetPos.y - fromPos.y) / tFly + 0.5 * CFG.shells.gravity * tFly, dz / d * speed);
  s.mesh.visible = true;
  s.mesh.material.color.set(color);
  s.glow.material.color.set(color);
  s.mesh.position.copy(s.pos);
}
function killShell(s) { s.alive = false; s.mesh.visible = false; }
export function shellCount() { return shells.reduce((n, s) => n + (s.alive ? 1 : 0), 0); }
export function updateShells(dt) {
  for (const s of shells) {
    if (!s.alive) continue;
    s.vel.y -= CFG.shells.gravity * dt;
    s.pos.addScaledVector(s.vel, dt);
    s.mesh.position.copy(s.pos);
    s.mesh.scale.setScalar(1);

    // tracer trail
    s.trailAcc += dt;
    if (s.trailAcc > CFG.shells.trailDt) {
      s.trailAcc = 0;
      fireP.spawn({ x: s.pos.x, y: s.pos.y, z: s.pos.z, c0: COL.trail, c1: COL.fire1, life: 0.22, s0: 0.55, s1: 0.1, a: 0.8 });
    }

    // whiz-by near player
    if (!s.whizzed && s.team !== 0 && rt.player.alive) {
      const d = s.pos.distanceTo(_v1.copy(rt.player.pos).setY(rt.player.pos.y + 1.5));
      if (d < 5) { s.whizzed = true; sfx.whiz(); }
    }

    // hit tanks
    let hit = false;
    if (s.team !== 0 && rt.player.alive) {
      if (dist2D(s.pos.x, s.pos.z, rt.player.pos.x, rt.player.pos.z) < 2.6 && Math.abs(s.pos.y - (rt.player.pos.y + 1.3)) < 2.2) {
        damagePlayer(s.dmg);
        explosion(s.pos.x, s.pos.y, s.pos.z, 0.8);
        hit = true;
      }
    }
    if (!hit && s.team === 0) {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (dist2D(s.pos.x, s.pos.z, e.pos.x, e.pos.z) < 2.6 * e.spec.scale && Math.abs(s.pos.y - (e.pos.y + 1.3)) < 2.4 * e.spec.scale) {
          damageEnemy(e, s.dmg);
          explosion(s.pos.x, s.pos.y, s.pos.z, 0.75);
          stats.hits++;
          hit = true;
          break;
        }
      }
    }
    // hit obstacles
    if (!hit) {
      for (const o of rt.obstacles) {
        if (!o.block || o.h < 0.5) continue;
        if (dist2D(s.pos.x, s.pos.z, o.x, o.z) < o.r * 0.9) {
          const gy = terrainH(o.x, o.z);
          if (s.pos.y < gy + o.h) {
            explosion(s.pos.x, s.pos.y, s.pos.z, 0.6, o.wreck !== true);
            hit = true;
            break;
          }
        }
      }
    }
    // hit ground
    if (!hit && s.pos.y < terrainH(s.pos.x, s.pos.z) + 0.15) {
      explosion(s.pos.x, s.pos.y, s.pos.z, 1, true);
      hit = true;
    }
    if (!hit && (Math.abs(s.pos.x) > 900 || Math.abs(s.pos.z) > 900 || s.pos.y < -50)) hit = true;
    if (hit) killShell(s);
  }
}

// ---------------------------------------------------------------- player
export function buildPlayer() {
  if (rt.player && rt.player.mesh) scene.remove(rt.player.mesh.root);
  const mesh = buildTank(PAL.player);
  scene.add(mesh.root);
  const p = makeBaseTank(mesh, 0, 0, CFG.player.radius);
  p.hp = CFG.player.maxHp;
  p.reload = 0;
  p.vel = new THREE.Vector3();
  p.lowHpAcc = 0;
  mesh.root.position.copy(p.pos);
  rt.player = p;
}
export function damagePlayer(dmg) {
  if (rt.godMode) return;
  if (!rt.player.alive || rt.state !== 'PLAYING') return;
  rt.player.hp -= dmg;
  rt.vignetteFlash = 1;
  addTrauma(CFG.vfx.hitTrauma);
  sfx.clank(rt.player.pos.x, rt.player.pos.z);
  if (rt.player.hp <= 35 && !document.body.classList.contains('crit')) document.body.classList.add('crit');
  if (rt.player.hp <= 0) {
    rt.player.hp = 0;
    playerDeath();
  }
  updateArmorHud();
}
export function healPlayer(n = CFG.player.maxHp) {
  if (!rt.player) return;
  rt.player.hp = Math.min(CFG.player.maxHp, rt.player.hp + n);
  if (rt.player.hp > 35) document.body.classList.remove('crit');
  updateArmorHud();
}
export function playerFire() {
  const p = rt.player;
  if (p.reload > 0 || !p.alive) return;
  p.reload = CFG.player.reloadT;
  stats.shots++;
  p.mesh.muzzle.getWorldPosition(_v1);
  const from = _v1.clone();
  fireShell(from, aimPoint, CFG.player.shellSpeed, 0, CFG.player.dmg, 0xffd089);
  _v2.copy(aimPoint).sub(from).normalize();
  muzzleFx(from, _v2);
  sfx.shot(p.pos.x, p.pos.z);
  addTrauma(CFG.vfx.fireTrauma);
  p.pitchKick -= 0.035;
  // barrel recoil
  p.mesh.barrel.position.z = 0.95;
  gunChip.classList.add('loading');
  gunTxt.textContent = 'LOADING SHELL';
}

// per-frame player update (input, physics, aim, fire, engine, damage smoke)
export function updatePlayer(dt) {
  const p = rt.player;
  stats.time += dt;
  const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0);
  const turn = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) + (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0);
  const prevX = p.pos.x, prevZ = p.pos.z;
  moveTank(p, throttle, turn, dt, CFG.player);
  // tank-vs-tank pushout
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist2D(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
    const min = p.radius + e.radius + 0.4;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = (p.pos.x - e.pos.x) / d, nz = (p.pos.z - e.pos.z) / d;
      p.pos.x += nx * push; p.pos.z += nz * push;
      e.pos.x -= nx * push; e.pos.z -= nz * push;
    }
  }
  p.vel.set((p.pos.x - prevX) / Math.max(dt, 1e-4), 0, (p.pos.z - prevZ) / Math.max(dt, 1e-4));

  updateAim();
  aimTurret(p, aimPoint.x, aimPoint.z, CFG.player.turretRate, dt);
  // barrel elevation to hit aimPoint ballistically
  p.mesh.muzzle.getWorldPosition(_v1);
  const dAim = Math.max(2, dist2D(aimPoint.x, aimPoint.z, _v1.x, _v1.z));
  const tFly = dAim / CFG.player.shellSpeed;
  const vy = (aimPoint.y - _v1.y) / tFly + 0.5 * CFG.shells.gravity * tFly;
  p.mesh.pivot.rotation.x = damp(p.mesh.pivot.rotation.x, clamp(-Math.atan2(vy, CFG.player.shellSpeed), -0.35, 0.1), 8, dt);
  p.mesh.barrel.position.z = damp(p.mesh.barrel.position.z, 1.65, 6, dt);

  // fire
  if (p.reload > 0) {
    p.reload -= dt;
    if (p.reload <= 0) { gunChip.classList.remove('loading'); gunTxt.textContent = 'CANNON READY'; sfx.reload(); }
  }
  if ((mouseDown || keys.has('Space')) && p.reload <= 0) playerFire();

  // engine audio
  updateEngine(p.speed, throttle, true);

  // low hp alarm
  if (p.hp <= 35) {
    p.lowHpAcc += dt;
    if (p.lowHpAcc > 2.2) { p.lowHpAcc = 0; sfx.alarm(); }
  }
  // damaged engine smoke
  if (p.hp <= 45) {
    p.dmgSmoke = (p.dmgSmoke || 0) + dt * (p.hp <= 22 ? 9 : 4);
    while (p.dmgSmoke > 1) {
      p.dmgSmoke -= 1;
      smokeP.spawn({
        x: p.pos.x + randSpread(0.6), y: p.pos.y + 1.9, z: p.pos.z - Math.cos(p.heading) * 1.6 + randSpread(0.6),
        vx: randSpread(0.6), vy: rand(1.5, 3), vz: randSpread(0.6),
        c0: COL.smoke0, c1: COL.smoke1, life: rand(1, 2), s0: 0.7, s1: rand(2.4, 3.6), a: 0.5, curve: 1,
      });
    }
  }
  if (rt.simTime > rt.hintFadeT) hintBar.classList.add('faded');
}

// title-screen idle: turret slowly scans
export function titleIdle(realT) {
  const p = rt.player;
  if (!p) return;
  p.mesh.turret.rotation.y = Math.sin(realT * 0.4) * 0.7;
  p.mesh.pivot.rotation.x = -0.06 + Math.sin(realT * 0.27) * 0.04;
}

// ---------------------------------------------------------------- enemies
export function spawnEnemy(variantKey, distOverride) {
  const v = CFG.enemies[variantKey];
  const mesh = buildTank(PAL[variantKey], v.scale);
  scene.add(mesh.root);
  // spawn on a ring around the player, inside bounds
  const p = rt.player;
  let x = 0, z = 0;
  for (let t = 0; t < 14; t++) {
    const a = rand(0, Math.PI * 2);
    const r = distOverride !== undefined ? distOverride : rand(CFG.enemies.spawnRingLo, CFG.enemies.spawnRingHi);
    x = clamp(p.pos.x + Math.cos(a) * r, -CFG.world.radius + 12, CFG.world.radius - 12);
    z = clamp(p.pos.z + Math.sin(a) * r, -CFG.world.radius + 12, CFG.world.radius - 12);
    const minD = distOverride !== undefined ? Math.min(distOverride * 0.6, 95) : 95;
    if (Math.hypot(x, z) < CFG.world.radius - 8 && dist2D(x, z, p.pos.x, p.pos.z) > minD
        && rt.obstacles.every(o => dist2D(x, z, o.x, o.z) > o.r + 4)) break;
  }
  const e = makeBaseTank(mesh, x, z, 2.6 * v.scale);
  e.heading = Math.atan2(p.pos.x - x, p.pos.z - z);
  const E = CFG.enemies;
  e.spec = {
    scale: v.scale, score: v.score,
    maxFwd: v.speed * (1 + rt.wave * E.speedWaveFactor), maxRev: v.rev, accel: v.accel, yawRate: v.yaw,
    turretRate: v.turret, shellSpeed: v.shell,
    dmg: Math.round(v.dmg * Math.min(E.dmgWaveCap, 1 + (rt.wave - 1) * E.dmgWaveFactor)),
    aimErr: Math.max(E.aimErrMin, v.aimErr - (rt.wave - 1) * E.aimErrWaveDrop) * Math.PI / 180,
    reload: [v.reloadLo, v.reloadHi], range: [v.rangeLo, v.rangeHi],
  };
  e.hp = e.maxHp = Math.round(v.hp * Math.min(E.hpWaveCap, 1 + (rt.wave - 1) * E.hpWaveFactor));
  e.fireCd = rand(2.2, 4);
  e.orbitDir = Math.random() < 0.5 ? -1 : 1;
  e.orbitTimer = rand(2, 5);
  e.stuckTimer = 0; e.reverseTimer = 0;
  e.lastPos = new THREE.Vector3().copy(e.pos);
  e.flash = 0;
  e.variant = variantKey;
  mesh.hb.visible = false;
  enemies.push(e);
  updateWaveHud();
  return e;
}
export function damageEnemy(e, dmg) {
  if (!e.alive) return;
  e.hp -= dmg;
  e.flash = 1;
  sfx.clank(e.pos.x, e.pos.z);
  hitMarker(e.hp <= 0);
  if (e.hp <= 0) killEnemy(e);
  else {
    e.mesh.hb.visible = true;
    e.mesh.hbFg.scale.x = Math.max(0.02, e.hp / e.maxHp);
    e.mesh.hbFg.material.color.setHSL(0.28 * (e.hp / e.maxHp), 0.75, 0.55);
  }
}
export function killEnemy(e) {
  e.alive = false;
  stats.kills++;
  addScore(e.spec.score);
  feed(`ENEMY ARMOR DESTROYED — +${e.spec.score}`, 'good');
  hitstop(0.09);
  explosion(e.pos.x, e.pos.y + 1.4, e.pos.z, 1.7);

  // turret pops
  const tr = e.mesh.turret;
  tr.getWorldPosition(_v1); tr.getWorldQuaternion(_q1);
  e.mesh.body.remove(tr);
  // keep visual scale of the detached turret
  tr.scale.setScalar(e.spec.scale);
  tr.position.copy(_v1); tr.quaternion.copy(_q1);
  scene.add(tr);
  debris.push({
    mesh: tr,
    vel: new THREE.Vector3(randSpread(5), rand(9, 14), randSpread(5)),
    angVel: new THREE.Vector3(randSpread(6), randSpread(6), randSpread(6)),
    settled: false, age: 0,
  });

  // char the hull
  for (const m of e.mesh.mats) { m.color.set(0x1c1915); m.metalness = 0.05; m.roughness = 1; }
  e.mesh.hb.visible = false;

  // wreck becomes battlefield cover
  const w = { x: e.pos.x, z: e.pos.z, r: 2.4 * e.spec.scale, h: 1.9 * e.spec.scale, block: true, wreck: true };
  wrecks.push(w);
  rt.obstacles.push(w);

  // burning
  smokeEmitters.push({ x: e.pos.x, y: e.pos.y + 1.6, z: e.pos.z, until: rt.simTime + rand(9, 14), rate: 9, acc: 0, big: false });

  // repair drop
  if ((rt.player.hp < 72 && Math.random() < CFG.pickups.dropChanceLowHp) || (rt.player.hp < 35 && Math.random() < CFG.pickups.dropChanceCritHp)) {
    spawnPickup(e.pos.x + randSpread(4), e.pos.z + randSpread(4));
  }
  checkWaveCleared();
}
function segBlocked(ax, az, bx, bz) {
  // does any blocking obstacle interrupt the line A→B?
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  for (const o of rt.obstacles) {
    if (!o.block || o.h < 1.4) continue;
    const t = clamp(((o.x - ax) * dx + (o.z - az) * dz) / len2, 0.05, 0.95);
    const px = ax + dx * t, pz = az + dz * t;
    if (dist2D(px, pz, o.x, o.z) < o.r * 0.8) return true;
  }
  return false;
}
function updateEnemy(e, dt) {
  if (!e.alive) return;
  const p = rt.player;
  const toP_x = p.pos.x - e.pos.x, toP_z = p.pos.z - e.pos.z;
  const d = Math.hypot(toP_x, toP_z);
  const s = e.spec;

  // hit flash
  if (e.flash > 0) {
    e.flash = Math.max(0, e.flash - dt * 5);
    for (const m of e.mesh.mats) { m.emissive.setRGB(e.flash * 0.9, e.flash * 0.18, e.flash * 0.08); }
  }

  // ---- movement decision
  e.orbitTimer -= dt;
  if (e.orbitTimer <= 0) { e.orbitTimer = rand(2.5, 6); if (Math.random() < 0.45) e.orbitDir *= -1; }
  let desX, desZ;
  if (d > s.range[1]) { desX = toP_x; desZ = toP_z; }                                  // close in
  else if (d < s.range[0]) { desX = -toP_x; desZ = -toP_z; }                            // back off
  else { desX = -toP_z * e.orbitDir; desZ = toP_x * e.orbitDir; }                       // orbit
  // obstacle avoidance probe
  const fx = Math.sin(e.heading), fz = Math.cos(e.heading);
  const probeX = e.pos.x + fx * 9, probeZ = e.pos.z + fz * 9;
  for (const o of rt.obstacles) {
    if (o.r < 0.8) continue;
    if (dist2D(probeX, probeZ, o.x, o.z) < o.r + 3.4) {
      const side = Math.sign((o.x - e.pos.x) * fz - (o.z - e.pos.z) * fx) || 1;
      desX = fx * 4 - side * fz * 8;
      desZ = fz * 4 + side * fx * 8;
      break;
    }
  }
  // keep inside arena
  if (Math.hypot(e.pos.x, e.pos.z) > CFG.world.radius - 14) { desX = -e.pos.x; desZ = -e.pos.z; }

  const desHeading = Math.atan2(desX, desZ);
  const headErr = wrapPI(desHeading - e.heading);
  let throttle = Math.abs(headErr) < 1.1 ? 1 : 0.22;
  let turn = clamp(headErr * 2.2, -1, 1);

  // stuck detection
  e.stuckTimer += dt;
  if (e.stuckTimer > 1.6) {
    if (e.lastPos.distanceTo(e.pos) < 1.2 && d > 12) e.reverseTimer = 1.1;
    e.lastPos.copy(e.pos);
    e.stuckTimer = 0;
  }
  if (e.reverseTimer > 0) { e.reverseTimer -= dt; throttle = -1; turn = e.orbitDir; }

  moveTank(e, throttle, turn, dt, s);

  // ---- turret + fire
  const lead = d / s.shellSpeed;
  const aimX = p.pos.x + p.vel.x * lead * rand(0.65, 1.0);
  const aimZ = p.pos.z + p.vel.z * lead * rand(0.65, 1.0);
  const err = aimTurret(e, aimX, aimZ, s.turretRate, dt);
  // barrel elevation toward player
  e.mesh.muzzle.getWorldPosition(_v1);
  const dy = (p.pos.y + 1.2) - _v1.y;
  const tFly = d / s.shellSpeed;
  const vyNeeded = dy / Math.max(0.1, tFly) + 0.5 * CFG.shells.gravity * tFly;
  e.mesh.pivot.rotation.x = damp(e.mesh.pivot.rotation.x, clamp(-Math.atan2(vyNeeded, s.shellSpeed), -0.3, 0.12), 5, dt);

  e.fireCd -= dt;
  if (e.fireCd <= 0 && p.alive && rt.state === 'PLAYING'
      && err < CFG.enemies.aimGate && d < CFG.enemies.fireRangeMax && d > CFG.enemies.fireRangeMin
      && !segBlocked(e.pos.x, e.pos.z, p.pos.x, p.pos.z)) {
    e.fireCd = rand(s.reload[0], s.reload[1]);
    e.mesh.muzzle.getWorldPosition(_v1);
    const errR = d * Math.tan(s.aimErr) * rand(0.15, 1);
    const errA = rand(0, Math.PI * 2);
    _v2.set(aimX + Math.cos(errA) * errR, p.pos.y + 1.1, aimZ + Math.sin(errA) * errR);
    fireShell(_v1.clone(), _v2, s.shellSpeed, 1, s.dmg, 0xff6a4a);
    _v3.copy(_v2).sub(_v1).normalize();
    muzzleFx(_v1, _v3, e.variant === 'heavy');
    sfx.shot(e.pos.x, e.pos.z, e.variant === 'heavy');
    e.pitchKick -= 0.03;
    e.mesh.barrel.position.z = 0.95;
  }
  e.mesh.barrel.position.z = damp(e.mesh.barrel.position.z, 1.65, 6, dt);

  // health bar billboard
  if (e.mesh.hb.visible) e.mesh.hb.quaternion.copy(camera.quaternion);
}
export function updateEnemies(dt) {
  for (const e of enemies) updateEnemy(e, dt);
  // enemy-vs-enemy separation
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (!a.alive) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (!b.alive) continue;
      const d = dist2D(a.pos.x, a.pos.z, b.pos.x, b.pos.z);
      const min = a.radius + b.radius + 0.6;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = (a.pos.x - b.pos.x) / d, nz = (a.pos.z - b.pos.z) / d;
        a.pos.x += nx * push; a.pos.z += nz * push;
        b.pos.x -= nx * push; b.pos.z -= nz * push;
      }
    }
  }
}
export function updateDebris(dt) {
  for (const d of debris) {
    if (d.settled) continue;
    d.age += dt;
    d.vel.y -= 22 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.rotation.x += d.angVel.x * dt;
    d.mesh.rotation.y += d.angVel.y * dt;
    d.mesh.rotation.z += d.angVel.z * dt;
    const gy = terrainH(d.mesh.position.x, d.mesh.position.z);
    if (d.mesh.position.y < gy + 0.45 && d.vel.y < 0) {
      if (Math.abs(d.vel.y) > 6) {
        d.vel.y *= -0.3; d.vel.x *= 0.6; d.vel.z *= 0.6;
        d.angVel.multiplyScalar(0.5);
        explosion(d.mesh.position.x, gy, d.mesh.position.z, 0.5, true);
      } else {
        d.settled = true;
        d.mesh.position.y = gy + 0.42;
      }
    }
  }
}

// ---------------------------------------------------------------- pickups
export function spawnPickup(x, z) {
  const g = new THREE.Group();
  const boxM = new THREE.MeshStandardMaterial({ color: 0x3f5236, roughness: 0.7, emissive: 0x16320e, emissiveIntensity: 0.7 });
  const crossM = new THREE.MeshStandardMaterial({ color: 0x9ee06a, emissive: 0x52a02c, emissiveIntensity: 1.4 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), boxM);
  box.castShadow = true;
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 0.3), crossM);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.9), crossM);
  c1.position.y = c2.position.y = 0.56;
  g.add(box, c1, c2);
  x = clamp(x, -CFG.world.radius + 6, CFG.world.radius - 6);
  z = clamp(z, -CFG.world.radius + 6, CFG.world.radius - 6);
  g.position.set(x, terrainH(x, z) + 0.7, z);
  scene.add(g);
  pickups.push({ mesh: g, x, z, age: 0, ttl: CFG.pickups.ttl });
}
export function updatePickups(dt) {
  const p = rt.player;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.age += dt;
    pk.mesh.rotation.y += dt * 1.4;
    pk.mesh.position.y = terrainH(pk.x, pk.z) + 0.85 + Math.sin(pk.age * 2.4) * 0.18;
    const d = dist2D(pk.x, pk.z, p.pos.x, p.pos.z);
    if (d < CFG.pickups.magnetR && p.alive) { // magnet
      pk.x = lerp(pk.x, p.pos.x, dt * 3.2);
      pk.z = lerp(pk.z, p.pos.z, dt * 3.2);
      pk.mesh.position.x = pk.x; pk.mesh.position.z = pk.z;
    }
    if (d < CFG.pickups.collectR && p.alive && p.hp < CFG.player.maxHp) {
      healPlayer(CFG.pickups.heal);
      feed(`FIELD REPAIRS +${CFG.pickups.heal} ARMOR`, 'good');
      sfx.repair();
      scene.remove(pk.mesh); pickups.splice(i, 1);
      continue;
    }
    if (pk.age > pk.ttl) { scene.remove(pk.mesh); pickups.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- waves / state / score
export function addScore(n) { stats.score += n; updateScoreHud(); }
export function hitstop(t) { rt.hitstopT = t; rt.timeScale = 0.12; }
function waveTotal(w) { return Math.min(CFG.waves.maxCount, CFG.waves.baseCount + w); }
export function startWave(w) {
  rt.wave = w;
  const total = waveTotal(w);
  const concurrent = Math.min(CFG.waves.maxConcurrent, total);
  rt.pendingSpawns = total - concurrent;
  for (let i = 0; i < concurrent; i++) after(i * CFG.waves.spawnStagger, () => { if (rt.state === 'PLAYING') spawnEnemy(pickVariant()); });
  banner(`WAVE ${fmt(w, 2)}`, `HOSTILE ARMOR × ${total}`);
  sfx.horn();
  updateWaveHud();
}
function pickVariant() {
  const r = Math.random();
  if (rt.wave >= CFG.waves.heavyFromWave && r < CFG.waves.heavyChance) return 'heavy';
  if (rt.wave >= CFG.waves.scoutFromWave && r < CFG.waves.scoutChance) return 'scout';
  return 'std';
}
export function checkWaveCleared() {
  if (rt.state !== 'PLAYING') return;
  if (rt.noWaves) { updateWaveHud(); return; }   // range mode: no reinforcements, no next wave
  if (rt.pendingSpawns > 0) {
    rt.pendingSpawns--;
    after(CFG.waves.reinforceDelay, () => { if (rt.state === 'PLAYING') { spawnEnemy(pickVariant()); updateWaveHud(); } });
    return;
  }
  if (enemies.every(e => !e.alive)) {
    const bonus = CFG.waves.clearBonusBase + rt.wave * CFG.waves.clearBonusPerWave;
    addScore(bonus);
    banner('WAVE CLEARED', `HOLD BONUS +${bonus}`);
    if (rt.player.hp < 55) after(1.5, () => spawnPickup(rt.player.pos.x + randSpread(20), rt.player.pos.z + randSpread(20)));
    after(CFG.waves.nextWaveDelay, () => { if (rt.state === 'PLAYING') startWave(rt.wave + 1); });
  }
  updateWaveHud();
}
function playerDeath() {
  const p = rt.player;
  p.alive = false;
  rt.state = 'DYING';
  document.body.classList.remove('playing');
  explosion(p.pos.x, p.pos.y + 1.5, p.pos.z, 2.1);
  sfx.gameover();
  // char + pop turret
  const tr = p.mesh.turret;
  tr.getWorldPosition(_v1); tr.getWorldQuaternion(_q1);
  p.mesh.body.remove(tr);
  tr.position.copy(_v1); tr.quaternion.copy(_q1);
  scene.add(tr);
  debris.push({ mesh: tr, vel: new THREE.Vector3(randSpread(4), rand(10, 14), randSpread(4)), angVel: new THREE.Vector3(randSpread(5), randSpread(5), randSpread(5)), settled: false, age: 0 });
  for (const m of p.mesh.mats) { m.color.set(0x1c1915); m.roughness = 1; }
  smokeEmitters.push({ x: p.pos.x, y: p.pos.y + 1.6, z: p.pos.z, until: rt.simTime + 30, rate: 12, acc: 0, big: true });
  rt.timeScale = 0.25;
  document.body.classList.remove('crit');
  afterReal(2.0, showGameOver);
}
function showGameOver() {
  rt.state = 'GAMEOVER';
  rt.timeScale = 1;
  document.body.classList.remove('playing');
  const acc = stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0;
  const mins = Math.floor(stats.time / 60), secs = Math.floor(stats.time % 60);
  document.getElementById('stWaves').textContent = String(Math.max(0, rt.wave - 1));
  document.getElementById('stKills').textContent = String(stats.kills);
  document.getElementById('stAcc').textContent = acc + '%';
  document.getElementById('stTime').textContent = `${mins}:${fmt(secs, 2)}`;
  document.getElementById('stScore').textContent = String(stats.score).padStart(6, '0');
  const rec = stats.score > rt.hiScore;
  if (rec) {
    rt.hiScore = stats.score;
    try { localStorage.setItem(HI_KEY, String(rt.hiScore)); } catch (e) {}
  }
  document.getElementById('newRecord').style.display = rec ? 'block' : 'none';
  document.getElementById('goScreen').classList.remove('hidden');
}
export function resetWorld() {
  // enemies
  for (const e of enemies) scene.remove(e.mesh.root);
  enemies.length = 0;
  // debris / wrecks / emitters / pickups
  for (const d of debris) scene.remove(d.mesh);
  debris.length = 0;
  wrecks.length = 0;
  rt.obstacles.length = 0;
  rt.obstacles.push(...staticObstacles);
  for (const pk of pickups) scene.remove(pk.mesh);
  pickups.length = 0;
  for (const s of shells) killShell(s);
  clearVfx();
  simTimers.length = 0;
  realTimers.length = 0;
  document.getElementById('feed').innerHTML = '';
  // stats
  stats.kills = 0; stats.shots = 0; stats.hits = 0; stats.score = 0; stats.time = 0;
  rt.wave = 0; rt.pendingSpawns = 0;
  rt.timeScale = 1; rt.timeScaleTarget = 1; rt.hitstopT = 0;
  rt.trauma = 0; rt.vignetteFlash = 0;
  document.body.classList.remove('crit');
  gunChip.classList.remove('loading');
  gunTxt.textContent = 'CANNON READY';
  hintBar.classList.remove('faded');
  buildPlayer();
  updateArmorHud(); updateScoreHud(); updateWaveHud();
}
export function startGame(range = false) {
  resetWorld();
  rt.noWaves = range;
  rt.state = 'PLAYING';
  rt.paused = false;
  document.getElementById('titleScreen').classList.add('hidden');
  document.getElementById('goScreen').classList.add('hidden');
  document.body.classList.add('playing');
  rt.hintFadeT = rt.simTime + 11;
  if (!range) after(1.0, () => startWave(1));
  else updateWaveHud();
}
export function togglePause() {
  rt.paused = !rt.paused;
  document.getElementById('pauseScreen').classList.toggle('hidden', !rt.paused);
  document.body.classList.toggle('playing', !rt.paused && (rt.state === 'PLAYING' || rt.state === 'DYING'));
}
