// SOOB — world.js
// The water column as a stage: analytic seabed heightfield (ridges, dunes,
// seamounts you can hide against), the surface sheet seen from below, swaying
// light shafts, the thermal layer band, rock + derelict scatter.
import * as THREE from 'three';
import { CFG, rt, rand, randSpread, clamp, _v1 } from './config.js';
import { scene, camera } from './scene.js';

// ---------------------------------------------------------------- seabed
// Analytic heightfield: y of the floor at (x,z). Negative (depth convention).
const MOUNTS = [
  { x:  430, z: -380, s: 150, h: 118 },
  { x: -620, z:  240, s: 180, h: 96 },
  { x:  120, z:  760, s: 140, h: 104 },
  { x: -260, z: -820, s: 200, h: 88 },
];
export function seabedH(x, z) {
  let y = -244
    + 20 * Math.sin(x * 0.011 + 1.7) * Math.sin(z * 0.009 - 0.4)
    + 12 * Math.sin(x * 0.027 + 0.6) * Math.cos(z * 0.031)
    + 5  * Math.sin(x * 0.061 + z * 0.043);
  for (const m of MOUNTS) {
    const dx = x - m.x, dz = z - m.z;
    y += m.h * Math.exp(-(dx * dx + dz * dz) / (m.s * m.s));
  }
  return y;
}
export function seabedN(x, z, out) {
  const e = 1.5;
  const hx = seabedH(x + e, z) - seabedH(x - e, z);
  const hz = seabedH(x, z + e) - seabedH(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

{
  const SIZE = 3400, SEG = 110;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, seabedH(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  // silt floor: dark blue-grey with painted mottling
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#16242c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${20 + Math.random() * 26 | 0},${36 + Math.random() * 26 | 0},${42 + Math.random() * 24 | 0},${0.12 + Math.random() * 0.2})`;
    const r = 2 + Math.random() * 14;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(26, 26);
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0x46606e });
  const floor = new THREE.Mesh(geo, mat);
  scene.add(floor);
}

// rocks + two derelict hulls on the floor
{
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x223540 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 130);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  for (let i = 0; i < 130; i++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 1500;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    e.set(rand(0, 3), rand(0, 3), rand(0, 3));
    q.setFromEuler(e);
    const sc = rand(2.5, 13);
    s.set(sc * rand(0.7, 1.4), sc * rand(0.5, 1), sc * rand(0.7, 1.4));
    m4.compose(_v1.set(x, seabedH(x, z) + sc * 0.2, z), q, s);
    rocks.setMatrixAt(i, m4);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  const derelictMat = new THREE.MeshLambertMaterial({ color: 0x1c2e36 });
  for (const [dx, dz, yaw] of [[260, 180, 0.7], [-540, -460, 2.3]]) {
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 52, 7, 1), derelictMat);
    hull.rotation.set(Math.PI / 2 + randSpread(0.3), yaw, randSpread(0.5));
    hull.position.set(dx, seabedH(dx, dz) + 3.4, dz);
    scene.add(hull);
  }
}

// ---------------------------------------------------------------- surface
// The roof of the world: two counter-scrolling caustic sheets + a sun glow.
let surfA, surfB, sunGlow;
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 256, 256);
  // caustic web: bright wandering arcs
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${170 + Math.random() * 60 | 0},${225 + Math.random() * 30 | 0},255,${0.10 + Math.random() * 0.22})`;
    g.lineWidth = 1 + Math.random() * 2.6;
    g.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += randSpread(36); y += randSpread(36);
      g.quadraticCurveTo(x + randSpread(20), y + randSpread(20), x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(9, 9);
  const tex2 = tex.clone(); tex2.repeat.set(5, 5);

  const mk = (t, op) => new THREE.Mesh(
    new THREE.PlaneGeometry(4200, 4200),
    new THREE.MeshBasicMaterial({
      map: t, transparent: true, opacity: op, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  surfA = mk(tex, 0.34); surfB = mk(tex2, 0.2);
  surfA.rotation.x = surfB.rotation.x = Math.PI / 2;
  surfA.position.y = -0.4; surfB.position.y = -1.1;
  surfA.renderOrder = surfB.renderOrder = 3;
  scene.add(surfA, surfB);

  // bright ceiling sheet — the silvered underside of the surface
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(4200, 4200),
    new THREE.MeshBasicMaterial({ color: 0x9fdcf2, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false })
  );
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 0.4; ceil.renderOrder = 2;
  scene.add(ceil);

  // sun disc glow through the water
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 2, 64, 64, 64);
  rg.addColorStop(0, 'rgba(235,255,255,1)');
  rg.addColorStop(0.25, 'rgba(170,235,255,.7)');
  rg.addColorStop(0.6, 'rgba(110,200,240,.18)');
  rg.addColorStop(1, 'rgba(90,180,230,0)');
  sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: stex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.9,
  }));
  sunGlow.scale.setScalar(520);
  scene.add(sunGlow);
}

// ---------------------------------------------------------------- light shafts
const shafts = [];
{
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(190,240,255,0.55)');
  gr.addColorStop(0.5, 'rgba(150,220,250,0.18)');
  gr.addColorStop(1, 'rgba(120,200,245,0)');
  g.fillStyle = gr;
  g.fillRect(8, 0, 48, 256);
  const blur = g.createLinearGradient(0, 0, 64, 0);
  blur.addColorStop(0, 'rgba(0,0,0,1)'); blur.addColorStop(0.25, 'rgba(0,0,0,0)');
  blur.addColorStop(0.75, 'rgba(0,0,0,0)'); blur.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = blur; g.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(rand(18, 42), 110),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      })
    );
    m.renderOrder = 4;
    m.userData = { ox: randSpread(220), oz: randSpread(220), phase: rand(0, 9), op: rand(0.045, 0.12) };
    scene.add(m);
    shafts.push(m);
  }
}

// ---------------------------------------------------------------- thermal layer
// A faint shimmering pane — the acoustic blanket you hide under.
export let layerMesh;
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 380; i++) {
    g.fillStyle = `rgba(120,235,210,${0.03 + Math.random() * 0.07})`;
    g.beginPath();
    g.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 30, 1 + Math.random() * 3, 0, 0, 7);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 14);
  layerMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4200, 4200),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  layerMesh.rotation.x = Math.PI / 2;
  layerMesh.position.y = rt.layerY;
  layerMesh.renderOrder = 3;
  scene.add(layerMesh);
}
export function setLayerY(y) {
  rt.layerY = y;
  layerMesh.position.y = y;
}

// ---------------------------------------------------------------- per-frame
export function updateWorld(dt, realT) {
  const cp = camera.position;
  // caustic scroll
  surfA.material.map.offset.x += dt * 0.012;
  surfA.material.map.offset.y += dt * 0.007;
  surfB.material.map.offset.x -= dt * 0.009;
  surfB.material.map.offset.y += dt * 0.011;
  // surface sheets + layer follow the camera so the planes never run out
  surfA.position.x = surfB.position.x = layerMesh.position.x = cp.x;
  surfA.position.z = surfB.position.z = layerMesh.position.z = cp.z;
  sunGlow.position.set(cp.x + 240, 160, cp.z + 150);

  // light shafts: hang from the surface near the camera, sway, die with depth
  const depthFade = clamp(1 + cp.y / 130, 0, 1) * CFG.world.shaftOpacity;
  for (const s of shafts) {
    const u = s.userData;
    s.position.set(cp.x + u.ox, -52, cp.z + u.oz);
    s.rotation.z = 0.16 * Math.sin(realT * 0.11 + u.phase);
    s.rotation.y = Math.atan2(cp.x - s.position.x, cp.z - s.position.z); // soft billboard
    s.material.opacity = u.op * depthFade * (0.75 + 0.25 * Math.sin(realT * 0.5 + u.phase * 2));
  }
  // layer shimmer breathes
  layerMesh.material.opacity = 0.13 + 0.05 * Math.sin(realT * 0.7);
}
