// SOOB — vfx.js
// Pooled GPU particles (additive glow / normal murk), pressure spheres,
// surface foam discs, ping rings, flash lights, persistent emitters
// (cavitation, torpedo wakes, sinking bubbles, burning tankers), marine snow.
import * as THREE from 'three';
import { CFG, rt, rand, randSpread, clamp, lerp, addTrauma, _v1 } from './config.js';
import { scene, camera } from './scene.js';
import { seabedH } from './world.js';
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
  float m = smoothstep(1.0, 0.25, d);
  if (vAlpha * m < 0.004) discard;
  gl_FragColor = vec4(vColor, vAlpha * m);
}`;

// curves: 0 spark (linear out) · 1 murk (ease in, slow out) · 2 flash (hard
// drop) · 3 bubble (steady, wobbles, pops at the surface)
class ParticlePool {
  constructor(n, blending) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col0 = new Float32Array(n * 3);
    this.col1 = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.age = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.grav = new Float32Array(n);   // negative = buoyancy
    this.drag = new Float32Array(n);
    this.wob = new Float32Array(n);    // sideways wobble amplitude
    this.curve = new Uint8Array(n);
    this.alive = [];
    this.free = [];
    for (let i = n - 1; i >= 0; i--) this.free.push(i);

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
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
    this.wob[i] = o.wob || 0;
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
  update(dt, time) {
    const ap = this.aPos.array, ac = this.aColor.array, as = this.aSize.array, aa = this.aAlpha.array;
    for (let k = this.alive.length - 1; k >= 0; k--) {
      const i = this.alive[k];
      this.age[i] += dt;
      const isBubble = this.curve[i] === 3;
      // bubbles breach and die at the surface
      if (this.age[i] >= this.life[i] || (isBubble && this.pos[i*3+1] > -0.25)) {
        as[i] = 0; aa[i] = 0;
        this.alive[k] = this.alive[this.alive.length - 1];
        this.alive.pop(); this.free.push(i);
        continue;
      }
      const t = this.age[i] / this.life[i];
      const dr = 1 - this.drag[i] * dt;
      this.vel[i*3] *= dr; this.vel[i*3+2] *= dr;
      this.vel[i*3+1] = this.vel[i*3+1] * dr - this.grav[i] * dt;
      if (this.wob[i]) {
        this.pos[i*3]   += Math.sin(time * 5.1 + i * 1.71) * this.wob[i] * dt;
        this.pos[i*3+2] += Math.cos(time * 4.3 + i * 2.13) * this.wob[i] * dt;
      }
      this.pos[i*3]   += this.vel[i*3]   * dt;
      this.pos[i*3+1] += this.vel[i*3+1] * dt;
      this.pos[i*3+2] += this.vel[i*3+2] * dt;
      ap[i*3] = this.pos[i*3]; ap[i*3+1] = this.pos[i*3+1]; ap[i*3+2] = this.pos[i*3+2];
      ac[i*3]   = lerp(this.col0[i*3],   this.col1[i*3],   t);
      ac[i*3+1] = lerp(this.col0[i*3+1], this.col1[i*3+1], t);
      ac[i*3+2] = lerp(this.col0[i*3+2], this.col1[i*3+2], t);
      as[i] = lerp(this.s0[i], this.s1[i], t);
      let alpha;
      if (this.curve[i] === 1)      alpha = Math.min(t * 6, 1) * (1 - t) * (1 - t);
      else if (this.curve[i] === 2) alpha = (1 - t) * (1 - t) * (1 - t);
      else if (isBubble)            alpha = Math.min(t * 8, 1) * (t > 0.86 ? (1 - t) / 0.14 : 1);
      else                          alpha = 1 - t;
      aa[i] = this.a0[i] * alpha;
    }
    this.aPos.needsUpdate = true; this.aColor.needsUpdate = true;
    this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }
}
export const glowP = new ParticlePool(3000, THREE.AdditiveBlending);
export const murkP = new ParticlePool(1600, THREE.NormalBlending);
const C = (h) => new THREE.Color(h);
export const COL = {
  bubble0: C(0xbfeeff), bubble1: C(0x6fd2ee),
  flashCore: C(0xeafcff), flashOut: C(0x6fd8e8),
  fire0: C(0xffd9a0), fire1: C(0xff6a2a),       // hot debris dies fast underwater
  spark0: C(0xfff2c8), spark1: C(0x4fd8c8),
  silt0: C(0x3a4f58), silt1: C(0x222f38),
  murk0: C(0x101c24), murk1: C(0x0a141c),
  oil0: C(0x0a0d12), oil1: C(0x05070c),
  foam: C(0xdcf6ff),
  snow0: C(0x9fc8d8), snow1: C(0x6f98ac),
  pingMine: C(0x49ffae), pingTheirs: C(0xff5346),
};

export function setPixelUniform(px) {
  glowP.uniforms.uPx.value = px;
  murkP.uniforms.uPx.value = px;
}
export function particleCount() { return glowP.alive.length + murkP.alive.length; }

// ---------------------------------------------------------------- pressure spheres
// Expanding translucent shells — explosion pressure waves and sonar pings.
const spherePool = [];
{
  const geo = new THREE.IcosahedronGeometry(1, 2);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xbfeeff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    m.visible = false; m.renderOrder = 12;
    scene.add(m);
    spherePool.push({ mesh: m, age: 0, life: 0, maxR: 0, a: 0.5 });
  }
}
export function spawnSphere(x, y, z, maxR = 26, life = 0.6, color = null, a = 0.4) {
  const s = spherePool.find(s => !s.mesh.visible) || spherePool[0];
  s.mesh.visible = true;
  s.mesh.position.set(x, y, z);
  s.mesh.material.color.copy(color || COL.flashOut);
  s.age = 0; s.life = life; s.maxR = maxR; s.a = a;
}

// ---------------------------------------------------------------- surface foam discs
const foamPool = [];
{
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 22, 64, 64, 64);
  rg.addColorStop(0, 'rgba(225,250,255,0)');
  rg.addColorStop(0.6, 'rgba(225,250,255,0.8)');
  rg.addColorStop(0.85, 'rgba(200,240,255,0.3)');
  rg.addColorStop(1, 'rgba(190,235,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false; m.renderOrder = 12;
    scene.add(m);
    foamPool.push({ mesh: m, age: 0, life: 0, maxR: 0 });
  }
}
export function spawnFoam(x, z, maxR = 12, life = 1.1) {
  const s = foamPool.find(s => !s.mesh.visible) || foamPool[0];
  s.mesh.visible = true;
  s.mesh.position.set(x, -0.3, z);
  s.age = 0; s.life = life; s.maxR = maxR;
}

// ---------------------------------------------------------------- flash lights
const flashLights = [];
for (let i = 0; i < 3; i++) {
  const l = new THREE.PointLight(0x9fe8ff, 0, 130, 1.7);
  scene.add(l);
  flashLights.push({ light: l, age: 1, life: 1, base: 0 });
}
let flashIdx = 0;
export function spawnFlash(x, y, z, intensity = 300, life = 0.35, color = null) {
  const f = flashLights[flashIdx++ % flashLights.length];
  f.light.position.set(x, y, z);
  f.light.color.set(color || 0x9fe8ff);
  f.light.intensity = intensity;
  f.base = intensity;
  f.age = 0; f.life = life;
}
// two dedicated flicker lights for burning tankers
const burnLights = [];
for (let i = 0; i < 2; i++) {
  const l = new THREE.PointLight(0xff8a30, 0, 220, 1.6);
  scene.add(l);
  burnLights.push(l);
}

// ---------------------------------------------------------------- emitters
// Persistent particle sources. ref is a live {x,y,z} (e.g. a ship's pos);
// kind: bubbles | fire | oil | wake
export const emitters = []; // {ref,offY,rate,until,kind,acc}
export function addEmitter(e) { e.acc = 0; emitters.push(e); }

// ---------------------------------------------------------------- effects
// the underwater explosion — flash, hot debris, bubble burst, murk, pressure
export function boom(x, y, z, scale = 1, { charge = false, silent = false } = {}) {
  const pm = CFG.vfx.particleMul, sm = CFG.vfx.sizeMul;
  glowP.spawn({ x, y, z, c0: COL.flashCore, c1: COL.flashOut, life: 0.14, s0: 6 * scale * sm, s1: 9 * scale * sm, a: 0.85, curve: 2 });
  // hot debris — orange embers that die to teal as the water quenches them
  for (let i = 0; i < Math.round(18 * pm * scale); i++) {
    const a = rand(0, Math.PI * 2), e = randSpread(1), sp = rand(4, 14) * Math.sqrt(scale);
    glowP.spawn({
      x, y, z,
      vx: Math.cos(a) * sp * rand(0.4, 1), vy: e * sp * 0.8, vz: Math.sin(a) * sp * rand(0.4, 1),
      c0: COL.fire0, c1: COL.spark1, life: rand(0.3, 0.7), s0: rand(0.5, 1.1) * sm * scale, s1: 0.1,
      a: 1, drag: 2.6,
    });
  }
  // bubble burst — the explosion gas, rising and wobbling
  for (let i = 0; i < Math.round(26 * pm * scale); i++) {
    const a = rand(0, Math.PI * 2), sp = rand(2, 9) * Math.sqrt(scale);
    glowP.spawn({
      x, y, z,
      vx: Math.cos(a) * sp, vy: rand(1, 6), vz: Math.sin(a) * sp,
      c0: COL.bubble0, c1: COL.bubble1, life: rand(1.2, 2.8), s0: rand(0.3, 0.9) * sm, s1: rand(0.5, 1.3) * sm,
      a: 0.75, grav: -6, drag: 1.4, wob: rand(1, 3), curve: 3,
    });
  }
  // murk cloud
  for (let i = 0; i < Math.round(10 * pm * scale); i++) {
    const a = rand(0, Math.PI * 2), sp = rand(0.5, 2.5) * scale;
    murkP.spawn({
      x: x + randSpread(scale), y: y + randSpread(scale), z: z + randSpread(scale),
      vx: Math.cos(a) * sp, vy: rand(-0.4, 1), vz: Math.sin(a) * sp,
      c0: COL.murk0, c1: COL.murk1, life: rand(2, 4.5), s0: rand(2, 3.5) * scale * sm, s1: rand(7, 11) * scale * sm,
      a: 0.5, drag: 0.8, curve: 1,
    });
  }
  // silt geyser if near the floor
  const floorY = seabedH(x, z);
  if (y - floorY < 16) {
    for (let i = 0; i < Math.round(16 * pm * scale); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(1, 5) * scale;
      murkP.spawn({
        x: x + randSpread(3), y: floorY + 1, z: z + randSpread(3),
        vx: Math.cos(a) * sp, vy: rand(3, 9) * Math.sqrt(scale), vz: Math.sin(a) * sp,
        c0: COL.silt0, c1: COL.silt1, life: rand(2.5, 5), s0: rand(2, 4) * scale * sm, s1: rand(8, 13) * scale * sm,
        a: 0.55, grav: 2.5, drag: 1, curve: 1,
      });
    }
  }
  spawnSphere(x, y, z, (charge ? 30 : 22) * scale, 0.55, charge ? COL.flashCore : COL.flashOut, 0.2);
  spawnFlash(x, y, z, 320 * scale, 0.3, charge ? 0xcef4ff : 0x8fe0f0);
  // breach foam if shallow
  if (y > -30 * scale) spawnFoam(x, z, 10 + 9 * scale, 1.3);
  if (rt.player) {
    const d = _v1.set(x - rt.player.pos.x, y - rt.player.pos.y, z - rt.player.pos.z).length();
    addTrauma(clamp(CFG.vfx.explosionTrauma * scale * (1 - d / CFG.vfx.chargeTraumaR), 0, 0.7));
  }
  if (!silent) { if (charge) sfx.charge(x, z, true); else sfx.explosion(x, z, scale); }
}

// a torpedo striking a hull at the waterline: boom + tall white geyser
export function breach(x, y, z, scale = 1) {
  boom(x, y, z, scale);
  const pm = CFG.vfx.particleMul, sm = CFG.vfx.sizeMul;
  for (let i = 0; i < Math.round(30 * pm); i++) {
    glowP.spawn({
      x: x + randSpread(2), y: -1, z: z + randSpread(2),
      vx: randSpread(2), vy: rand(8, 22) * Math.sqrt(scale), vz: randSpread(2),
      c0: COL.foam, c1: COL.bubble1, life: rand(0.5, 1.2), s0: rand(0.6, 1.4) * sm, s1: rand(1.5, 2.6) * sm,
      a: 0.9, grav: 18, drag: 0.6,
    });
  }
  spawnFoam(x, z, 16 * scale, 1.8);
}

// depth-charge entry: a small splash bloom on the roof of the world
export function splashIn(x, z) {
  spawnFoam(x, z, 6, 0.9);
  for (let i = 0; i < 8; i++) {
    glowP.spawn({
      x: x + randSpread(1), y: -0.6, z: z + randSpread(1),
      vx: randSpread(1.5), vy: rand(-3, -1), vz: randSpread(1.5),
      c0: COL.foam, c1: COL.bubble1, life: rand(0.4, 0.8), s0: 0.5, s1: 0.2, a: 0.7,
    });
  }
  sfx.splash(x, z);
}

// deck-gun shell hitting the water above you
export function shellSplash(x, z) {
  spawnFoam(x, z, 8, 1.0);
  for (let i = 0; i < 14; i++) {
    glowP.spawn({
      x: x + randSpread(1.5), y: -0.8, z: z + randSpread(1.5),
      vx: randSpread(2), vy: rand(-6, -2), vz: randSpread(2),
      c0: COL.foam, c1: COL.bubble1, life: rand(0.5, 1), s0: rand(0.4, 0.8), s1: 0.2, a: 0.8,
    });
  }
  sfx.shellSplash(x, z);
}

// sonar ping wavefront — green for yours, red for theirs
export function pingRing(x, y, z, maxR, mine = true) {
  spawnSphere(x, y, z, maxR, maxR / CFG.detection.pingSpeed, mine ? COL.pingMine : COL.pingTheirs, mine ? 0.16 : 0.13);
}

// prop cavitation — called per frame while cavitating
let cavAcc = 0;
export function cavitation(x, y, z, dt, intensity = 1) {
  cavAcc += dt * 80 * intensity * CFG.vfx.particleMul;
  while (cavAcc > 1) {
    cavAcc -= 1;
    glowP.spawn({
      x: x + randSpread(1.2), y: y + randSpread(1.2), z: z + randSpread(1.2),
      vx: randSpread(1.5), vy: rand(0.5, 2), vz: randSpread(1.5),
      c0: COL.bubble0, c1: COL.bubble1, life: rand(0.8, 1.8), s0: rand(0.15, 0.45), s1: rand(0.3, 0.7),
      a: 0.6, grav: -5, drag: 1.2, wob: rand(1, 2.5), curve: 3,
    });
  }
}

// torpedo bubble wake — called per frame per running torpedo
export function wake(x, y, z, dt, rate) {
  // direct spawn, caller accumulates via its own acc
  glowP.spawn({
    x: x + randSpread(0.5), y: y + randSpread(0.5), z: z + randSpread(0.5),
    vx: randSpread(0.4), vy: rand(0.3, 1.2), vz: randSpread(0.4),
    c0: COL.bubble0, c1: COL.bubble1, life: rand(1.6, 3.2), s0: rand(0.2, 0.5), s1: rand(0.4, 0.8),
    a: 0.55, grav: -3.5, drag: 1.5, wob: rand(0.5, 1.5), curve: 3,
  });
}

// ---------------------------------------------------------------- ambient
let snowAcc = 0;
export function marineSnow(dt) {
  snowAcc += dt * CFG.world.snowRate;
  const cp = camera.position;
  while (snowAcc > 1) {
    snowAcc -= 1;
    const a = rand(0, Math.PI * 2), r = rand(8, 110);
    murkP.spawn({
      x: cp.x + Math.cos(a) * r, y: clamp(cp.y + randSpread(70), -400, -1), z: cp.z + Math.sin(a) * r,
      vx: randSpread(0.3), vy: rand(-0.5, -0.2), vz: randSpread(0.3),
      c0: COL.snow0, c1: COL.snow1, life: rand(5, 10), s0: rand(0.06, 0.2), s1: rand(0.06, 0.16),
      a: rand(0.12, 0.3), wob: 0.3, curve: 1,
    });
  }
}

// ---------------------------------------------------------------- per-frame
export function updateVfx(dt, simTime) {
  glowP.update(dt, simTime);
  murkP.update(dt, simTime);
  marineSnow(dt);

  // emitters
  let burnN = 0;
  for (let i = emitters.length - 1; i >= 0; i--) {
    const em = emitters[i];
    if (simTime > em.until || (em.ref && em.ref.dead)) { emitters.splice(i, 1); continue; }
    const px = em.ref ? em.ref.x : em.x, py = (em.ref ? em.ref.y : em.y) + (em.offY || 0), pz = em.ref ? em.ref.z : em.z;
    em.acc += dt * em.rate * CFG.vfx.particleMul;
    while (em.acc > 1) {
      em.acc -= 1;
      if (em.kind === 'bubbles') {
        glowP.spawn({
          x: px + randSpread(em.spread || 2), y: py + randSpread(1), z: pz + randSpread(em.spread || 2),
          vx: randSpread(0.5), vy: rand(0.5, 2), vz: randSpread(0.5),
          c0: COL.bubble0, c1: COL.bubble1, life: rand(1.5, 3.5), s0: rand(0.2, 0.6), s1: rand(0.4, 1),
          a: 0.6, grav: -4.5, drag: 1.2, wob: rand(1, 2.5), curve: 3,
        });
      } else if (em.kind === 'fire') {
        glowP.spawn({
          x: px + randSpread(em.spread || 6), y: 0.5, z: pz + randSpread(em.spread || 6),
          vx: randSpread(1), vy: rand(2, 6), vz: randSpread(1),
          c0: COL.fire0, c1: COL.fire1, life: rand(0.4, 1), s0: rand(1.2, 2.4), s1: 0.4, a: 0.9, drag: 0.5, curve: 2,
        });
        if (Math.random() < 0.4) murkP.spawn({
          x: px + randSpread(6), y: 2, z: pz + randSpread(6),
          vx: randSpread(1), vy: rand(2, 5), vz: randSpread(1),
          c0: COL.oil0, c1: COL.oil1, life: rand(1.5, 3), s0: rand(2, 4), s1: rand(6, 10), a: 0.5, curve: 1,
        });
      } else if (em.kind === 'oil') {
        murkP.spawn({
          x: px + randSpread(em.spread || 4), y: py, z: pz + randSpread(em.spread || 4),
          vx: randSpread(0.4), vy: rand(0.4, 1.4), vz: randSpread(0.4),
          c0: COL.oil0, c1: COL.oil1, life: rand(3, 6), s0: rand(1.5, 3), s1: rand(5, 9), a: 0.55, curve: 1,
        });
      }
    }
    // burning emitters claim the flicker lights
    if (em.kind === 'fire' && burnN < burnLights.length) {
      const l = burnLights[burnN++];
      l.position.set(px, 6, pz);
      l.intensity = 140 + Math.sin(simTime * 17 + i * 3) * 50 + Math.sin(simTime * 7.7) * 30;
    }
  }
  for (let i = burnN; i < burnLights.length; i++) burnLights[i].intensity = 0;

  // pressure spheres / ping fronts
  for (const s of spherePool) {
    if (!s.mesh.visible) continue;
    s.age += dt;
    const t = s.age / s.life;
    if (t >= 1) { s.mesh.visible = false; continue; }
    const r = s.maxR * (s.life > 1.5 ? t : 1 - Math.pow(1 - t, 2.2)); // pings expand linearly
    s.mesh.scale.setScalar(Math.max(0.01, r));
    s.mesh.material.opacity = s.a * (1 - t);
  }
  // foam discs
  for (const s of foamPool) {
    if (!s.mesh.visible) continue;
    s.age += dt;
    const t = s.age / s.life;
    if (t >= 1) { s.mesh.visible = false; continue; }
    s.mesh.scale.setScalar(Math.max(0.01, s.maxR * (1 - Math.pow(1 - t, 2))));
    s.mesh.material.opacity = 0.8 * (1 - t);
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
  glowP.clear();
  murkP.clear();
  emitters.length = 0;
  for (const s of spherePool) s.mesh.visible = false;
  for (const s of foamPool) s.mesh.visible = false;
  for (const l of burnLights) l.intensity = 0;
}
