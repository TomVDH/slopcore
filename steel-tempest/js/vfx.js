// TONK — vfx.js
// Pooled GPU particles (additive fire / normal smoke), shockwave rings,
// scorch decals, flash lights, persistent smoke emitters, explosion/muzzle fx.
import * as THREE from 'three';
import { CFG, rt, rand, randSpread, clamp, lerp, dist2D, addTrauma, _v1 } from './config.js';
import { scene } from './scene.js';
import { terrainH, terrainN } from './world.js';
import { sfx } from './audio.js';

const PARTICLE_VERT = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vAlpha; varying vec3 vColor;
uniform float uPx;
void main(){
  vAlpha = aAlpha; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PARTICLE_FRAG = `
varying float vAlpha; varying vec3 vColor;
void main(){
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = dot(uv, uv);
  float m = smoothstep(1.0, 0.22, d);
  if (vAlpha * m < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha * m);
}`;

class ParticlePool {
  constructor(n, blending) {
    this.n = n;
    this.pos  = new Float32Array(n * 3);
    this.vel  = new Float32Array(n * 3);
    this.col0 = new Float32Array(n * 3);
    this.col1 = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.age  = new Float32Array(n);
    this.s0   = new Float32Array(n);
    this.s1   = new Float32Array(n);
    this.a0   = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.curve = new Uint8Array(n);  // 0 spark, 1 smoke, 2 flash
    this.alive = [];
    this.free = [];
    for (let i = n - 1; i >= 0; i--) this.free.push(i);

    const geo = new THREE.BufferGeometry();
    this.aPos   = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize  = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aColor', this.aColor);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    this.uniforms = { uPx: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG,
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === THREE.AdditiveBlending ? 11 : 10;
    scene.add(this.points);
  }
  spawn(o) {
    if (!this.free.length) return;
    const i = this.free.pop();
    this.alive.push(i);
    this.pos[i*3] = o.x; this.pos[i*3+1] = o.y; this.pos[i*3+2] = o.z;
    this.vel[i*3] = o.vx || 0; this.vel[i*3+1] = o.vy || 0; this.vel[i*3+2] = o.vz || 0;
    const c0 = o.c0, c1 = o.c1 || o.c0;
    this.col0[i*3] = c0.r; this.col0[i*3+1] = c0.g; this.col0[i*3+2] = c0.b;
    this.col1[i*3] = c1.r; this.col1[i*3+1] = c1.g; this.col1[i*3+2] = c1.b;
    this.life[i] = o.life; this.age[i] = 0;
    this.s0[i] = o.s0; this.s1[i] = o.s1 !== undefined ? o.s1 : o.s0;
    this.a0[i] = o.a !== undefined ? o.a : 1;
    this.grav[i] = o.grav || 0;
    this.drag[i] = o.drag || 0;
    this.curve[i] = o.curve || 0;
  }
  clear() {
    for (const i of this.alive) this.free.push(i);
    this.alive.length = 0;
    this.aSize.array.fill(0);
    this.aAlpha.array.fill(0);
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }
  update(dt) {
    const ap = this.aPos.array, ac = this.aColor.array, as = this.aSize.array, aa = this.aAlpha.array;
    for (let k = this.alive.length - 1; k >= 0; k--) {
      const i = this.alive[k];
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        as[i] = 0; aa[i] = 0;
        this.alive[k] = this.alive[this.alive.length - 1];
        this.alive.pop(); this.free.push(i);
        continue;
      }
      const t = this.age[i] / this.life[i];
      const dr = 1 - this.drag[i] * dt;
      this.vel[i*3] *= dr; this.vel[i*3+2] *= dr;
      this.vel[i*3+1] = this.vel[i*3+1] * dr - this.grav[i] * dt;
      this.pos[i*3]   += this.vel[i*3]   * dt;
      this.pos[i*3+1] += this.vel[i*3+1] * dt;
      this.pos[i*3+2] += this.vel[i*3+2] * dt;
      ap[i*3] = this.pos[i*3]; ap[i*3+1] = this.pos[i*3+1]; ap[i*3+2] = this.pos[i*3+2];
      ac[i*3]   = lerp(this.col0[i*3],   this.col1[i*3],   t);
      ac[i*3+1] = lerp(this.col0[i*3+1], this.col1[i*3+1], t);
      ac[i*3+2] = lerp(this.col0[i*3+2], this.col1[i*3+2], t);
      as[i] = lerp(this.s0[i], this.s1[i], t);
      let alpha;
      if (this.curve[i] === 1)      alpha = Math.min(t * 6, 1) * (1 - t) * (1 - t); // smoke: ease in, slow out
      else if (this.curve[i] === 2) alpha = (1 - t) * (1 - t) * (1 - t);            // flash: hard drop
      else                          alpha = 1 - t;                                  // spark: linear
      aa[i] = this.a0[i] * alpha;
    }
    this.aPos.needsUpdate = true; this.aColor.needsUpdate = true;
    this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }
}
export const fireP  = new ParticlePool(1600, THREE.AdditiveBlending);
export const smokeP = new ParticlePool(1100, THREE.NormalBlending);
const C = (h) => new THREE.Color(h);
export const COL = {
  flashCore: C(0xfff6d8), flashOut: C(0xffb24a),
  fire0: C(0xffd27a), fire1: C(0xff5217),
  spark0: C(0xfff0b8), spark1: C(0xff7a2a),
  smoke0: C(0x2e2a24), smoke1: C(0x4d463c),
  dust0: C(0xcbb088), dust1: C(0xa68d66),
  dirt0: C(0x8a6c44), dirt1: C(0x6b5234),
  trail: C(0xffc06a),
};

export function setPixelUniform(px) {
  fireP.uniforms.uPx.value = px;
  smokeP.uniforms.uPx.value = px;
}
export function particleCount() {
  return fireP.alive.length + smokeP.alive.length;
}

// ---------------------------------------------------------------- shockwave rings
const shockPool = [];
{
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,200,120,0)');
  rg.addColorStop(0.72, 'rgba(255,210,140,0.85)');
  rg.addColorStop(0.9, 'rgba(255,170,90,0.35)');
  rg.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false; m.renderOrder = 12;
    scene.add(m);
    shockPool.push({ mesh: m, age: 0, life: 0, maxR: 0 });
  }
}
export function spawnShock(x, y, z, maxR = 14, life = 0.55) {
  const s = shockPool.find(s => !s.mesh.visible) || shockPool[0];
  s.mesh.visible = true;
  s.mesh.position.set(x, y + 0.25, z);
  terrainN(x, z, _v1);
  s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v1);
  s.age = 0; s.life = life; s.maxR = maxR;
}

// ---------------------------------------------------------------- scorch decals
const scorchPool = [];
{
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  rg.addColorStop(0, 'rgba(10,8,6,0.85)');
  rg.addColorStop(0.55, 'rgba(14,11,8,0.5)');
  rg.addColorStop(1, 'rgba(14,11,8,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })
    );
    m.visible = false; m.renderOrder = 2;
    scene.add(m);
    scorchPool.push({ mesh: m, age: 0, life: 0 });
  }
}
let scorchIdx = 0;
export function spawnScorch(x, z, size = 5) {
  const s = scorchPool[scorchIdx++ % scorchPool.length];
  s.mesh.visible = true;
  s.mesh.position.set(x, terrainH(x, z) + 0.06, z);
  terrainN(x, z, _v1);
  s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v1);
  s.mesh.rotateZ(rand(0, Math.PI * 2));
  s.mesh.scale.setScalar(size);
  s.age = 0; s.life = 26;
}

// ---------------------------------------------------------------- flash lights
const flashLights = [];
for (let i = 0; i < 3; i++) {
  const l = new THREE.PointLight(0xffa24d, 0, 60, 1.8);
  scene.add(l);
  flashLights.push({ light: l, age: 1, life: 1, base: 0 });
}
let flashIdx = 0;
export function spawnFlash(x, y, z, intensity = 260, life = 0.3) {
  const f = flashLights[flashIdx++ % flashLights.length];
  f.light.position.set(x, y, z);
  f.light.intensity = intensity;
  f.base = intensity;
  f.age = 0; f.life = life;
}

// persistent smoke emitters (burning wrecks / damaged engine)
export const smokeEmitters = []; // {x,y,z,until,rate,acc,big}

// ---------------------------------------------------------------- effects
export function explosion(x, y, z, scale = 1, dirt = false) {
  const pm = CFG.vfx.particleMul, sm = CFG.vfx.sizeMul;
  // flash
  fireP.spawn({ x, y, z, c0: COL.flashCore, c1: COL.flashOut, life: 0.14, s0: 7 * scale * sm, s1: 10 * scale * sm, a: 1, curve: 2 });
  // fireball
  if (!dirt) for (let i = 0; i < Math.round(16 * pm); i++) {
    const a = rand(0, Math.PI * 2), e = rand(0.2, 1.4), sp = rand(2, 9) * scale;
    fireP.spawn({
      x, y: y + 0.3, z,
      vx: Math.cos(a) * sp, vy: e * sp * 0.9 + 2, vz: Math.sin(a) * sp,
      c0: COL.fire0, c1: COL.fire1, life: rand(0.35, 0.7), s0: rand(2, 3.6) * scale * sm, s1: 0.5 * scale * sm,
      a: 0.95, drag: 2.2, curve: 2,
    });
  }
  // sparks
  for (let i = 0; i < Math.round((dirt ? 10 : 26) * pm); i++) {
    const a = rand(0, Math.PI * 2), sp = rand(7, 22) * Math.sqrt(scale);
    fireP.spawn({
      x, y: y + 0.2, z,
      vx: Math.cos(a) * sp * rand(0.3, 1), vy: rand(4, 15) * Math.sqrt(scale), vz: Math.sin(a) * sp * rand(0.3, 1),
      c0: COL.spark0, c1: COL.spark1, life: rand(0.4, 0.95), s0: rand(0.3, 0.6) * sm, s1: 0.08,
      a: 1, grav: 22, drag: 0.4,
    });
  }
  // dirt clods on ground hits
  if (dirt) for (let i = 0; i < Math.round(18 * pm); i++) {
    const a = rand(0, Math.PI * 2), sp = rand(2, 8) * scale;
    smokeP.spawn({
      x, y: y + 0.1, z,
      vx: Math.cos(a) * sp, vy: rand(5, 13) * scale, vz: Math.sin(a) * sp,
      c0: COL.dirt0, c1: COL.dirt1, life: rand(0.5, 1), s0: rand(0.7, 1.6) * scale * sm, s1: rand(2, 3) * scale * sm,
      a: 0.9, grav: 16, drag: 0.6, curve: 1,
    });
  }
  // smoke
  for (let i = 0; i < Math.round((dirt ? 6 : 12) * pm); i++) {
    const a = rand(0, Math.PI * 2), sp = rand(0.5, 3) * scale;
    smokeP.spawn({
      x: x + randSpread(scale), y: y + rand(0.5, 1.5), z: z + randSpread(scale),
      vx: Math.cos(a) * sp, vy: rand(1.5, 4), vz: Math.sin(a) * sp,
      c0: dirt ? COL.dust0 : COL.smoke0, c1: dirt ? COL.dust1 : COL.smoke1,
      life: rand(1.4, 2.8) * (dirt ? 0.7 : 1), s0: rand(1.6, 2.6) * scale * sm, s1: rand(5, 8) * scale * sm,
      a: dirt ? 0.5 : 0.62, drag: 0.7, curve: 1,
    });
  }
  spawnShock(x, terrainH(x, z), z, (dirt ? 8 : 13) * scale, 0.5);
  if (!dirt || scale > 1.2) spawnFlash(x, y + 2, z, 240 * scale, 0.28);
  spawnScorch(x, z, (dirt ? 3.5 : 5.5) * scale);
  if (rt.player) {
    addTrauma(clamp(CFG.vfx.explosionTrauma * scale * (1 - dist2D(x, z, rt.player.pos.x, rt.player.pos.z) / 90), 0, 0.55));
  }
  if (dirt) sfx.dirt(x, z); else sfx.explosion(x, z, scale);
}

export function muzzleFx(p, dir, big = false) {
  const s = (big ? 1.35 : 1) * CFG.vfx.sizeMul;
  const pm = CFG.vfx.particleMul;
  fireP.spawn({ x: p.x, y: p.y, z: p.z, c0: COL.flashCore, c1: COL.flashOut, life: 0.09, s0: 3.4 * s, s1: 5 * s, a: 1, curve: 2 });
  for (let i = 0; i < Math.round(7 * pm); i++) {
    fireP.spawn({
      x: p.x, y: p.y, z: p.z,
      vx: dir.x * rand(8, 22) + randSpread(4), vy: dir.y * rand(8, 22) + rand(0, 3), vz: dir.z * rand(8, 22) + randSpread(4),
      c0: COL.fire0, c1: COL.fire1, life: rand(0.1, 0.25), s0: rand(0.7, 1.3) * s, s1: 0.2, a: 0.95, drag: 3,
    });
  }
  for (let i = 0; i < Math.round(5 * pm); i++) {
    smokeP.spawn({
      x: p.x + dir.x, y: p.y + dir.y, z: p.z + dir.z,
      vx: dir.x * rand(2, 5) + randSpread(1.5), vy: rand(0.8, 2.2), vz: dir.z * rand(2, 5) + randSpread(1.5),
      c0: COL.smoke1, c1: COL.dust1, life: rand(0.7, 1.3), s0: 0.8 * s, s1: rand(2.5, 4) * s, a: 0.4, drag: 1.4, curve: 1,
    });
  }
  // ground dust ring under the muzzle blast
  const gy = terrainH(p.x, p.z);
  if (p.y - gy < 2.6) {
    for (let i = 0; i < Math.round(6 * pm); i++) {
      const a = rand(0, Math.PI * 2);
      smokeP.spawn({
        x: p.x + Math.cos(a) * 1.2, y: gy + 0.25, z: p.z + Math.sin(a) * 1.2,
        vx: Math.cos(a) * rand(3, 7), vy: rand(0.4, 1.4), vz: Math.sin(a) * rand(3, 7),
        c0: COL.dust0, c1: COL.dust1, life: rand(0.5, 0.9), s0: 1 * s, s1: rand(2.2, 3.4) * s, a: 0.45, drag: 2, curve: 1,
      });
    }
  }
  spawnFlash(p.x, p.y, p.z, big ? 200 : 140, 0.12);
}

// ---------------------------------------------------------------- ambient dust
let ambientAcc = 0;
export function ambientDust(dt, camPos) {
  ambientAcc += dt * CFG.world.ambientDustRate;
  while (ambientAcc > 1) {
    ambientAcc -= 1;
    const a = rand(0, Math.PI * 2), r = rand(10, 90);
    const x = camPos.x + Math.cos(a) * r, z = camPos.z + Math.sin(a) * r;
    smokeP.spawn({
      x, y: terrainH(x, z) + rand(0.4, 3), z,
      vx: rand(2, 5), vy: rand(0.1, 0.5), vz: randSpread(1),
      c0: COL.dust0, c1: COL.dust1, life: rand(2, 4), s0: rand(2, 5), s1: rand(6, 10), a: 0.07, curve: 1,
    });
  }
}

// ---------------------------------------------------------------- per-frame tick
export function updateVfx(dt, simTime) {
  fireP.update(dt);
  smokeP.update(dt);

  // smoke emitters
  for (let i = smokeEmitters.length - 1; i >= 0; i--) {
    const em = smokeEmitters[i];
    if (simTime > em.until) { smokeEmitters.splice(i, 1); continue; }
    em.acc += dt * em.rate;
    while (em.acc > 1) {
      em.acc -= 1;
      smokeP.spawn({
        x: em.x + randSpread(0.9), y: em.y, z: em.z + randSpread(0.9),
        vx: randSpread(0.5) + 0.8, vy: rand(2, 4.5), vz: randSpread(0.5),
        c0: COL.smoke0, c1: COL.smoke1, life: rand(1.6, 3.2), s0: rand(1, 1.8), s1: rand(4, 7), a: em.big ? 0.65 : 0.5, curve: 1,
      });
      if (Math.random() < 0.12) fireP.spawn({
        x: em.x + randSpread(0.8), y: em.y - 0.8, z: em.z + randSpread(0.8),
        vx: randSpread(1), vy: rand(1, 3), vz: randSpread(1),
        c0: COL.fire0, c1: COL.fire1, life: rand(0.2, 0.5), s0: rand(0.8, 1.6), s1: 0.3, a: 0.8, curve: 2,
      });
    }
  }
  // shockwaves
  for (const s of shockPool) {
    if (!s.mesh.visible) continue;
    s.age += dt;
    const t = s.age / s.life;
    if (t >= 1) { s.mesh.visible = false; continue; }
    const r = s.maxR * (1 - Math.pow(1 - t, 2.4));
    s.mesh.scale.setScalar(Math.max(0.01, r));
    s.mesh.material.opacity = 0.85 * (1 - t);
  }
  // scorches
  for (const s of scorchPool) {
    if (!s.mesh.visible) continue;
    s.age += dt;
    if (s.age > s.life) { s.mesh.visible = false; continue; }
    s.mesh.material.opacity = 0.9 * Math.min(1, (s.life - s.age) / 6);
  }
  // flash lights
  for (const f of flashLights) {
    if (f.age >= f.life) { f.light.intensity = 0; continue; }
    f.age += dt;
    const t = clamp(f.age / f.life, 0, 1);
    f.light.intensity = (f.base || 0) * Math.pow(1 - t, 1.8);
  }
}

export function clearVfx() {
  fireP.clear();
  smokeP.clear();
  smokeEmitters.length = 0;
  for (const s of scorchPool) s.mesh.visible = false;
  for (const s of shockPool) s.mesh.visible = false;
}
