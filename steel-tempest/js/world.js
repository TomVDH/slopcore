// TONK — world.js
// Analytic heightfield terrain, ground mesh, props, obstacle registry.
import * as THREE from 'three';
import { rand, randSpread, dist2D } from './config.js';
import { scene } from './scene.js';

const TEETH_R = 268; // dragon-teeth ring radius (fixed décor outside CFG.world.radius)

export function terrainH(x, z) {
  return Math.sin(x * 0.021) * Math.cos(z * 0.019) * 1.7
       + Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.038 + 0.6) * 0.65
       + Math.sin(x * 0.011 - 0.4) * Math.cos(z * 0.013 + 2.2) * 2.3;
}
export function terrainN(x, z, out) {
  const e = 0.8;
  out.set(terrainH(x - e, z) - terrainH(x + e, z), 2 * e, terrainH(x, z - e) - terrainH(x, z + e));
  return out.normalize();
}

// ---------------------------------------------------------------- ground
{
  const geo = new THREE.PlaneGeometry(1300, 1300, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainH(x, z));
  }
  geo.computeVertexNormals();

  // sand texture
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#b18d5e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9; i++) {
    const rg = g.createRadialGradient(rand(0, 512), rand(0, 512), 10, rand(0, 512), rand(0, 512), rand(90, 240));
    rg.addColorStop(0, `rgba(${140 + (Math.random() * 40 | 0)},${105 + (Math.random() * 30 | 0)},${60 + (Math.random() * 25 | 0)},0.25)`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
  }
  for (let i = 0; i < 5200; i++) {
    const v = Math.random();
    g.fillStyle = v > 0.5 ? `rgba(60,42,22,${rand(0.04, 0.14)})` : `rgba(255,235,190,${rand(0.04, 0.12)})`;
    g.fillRect(rand(0, 512), rand(0, 512), rand(1, 2.4), rand(1, 2.4));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(15, 15);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// ---------------------------------------------------------------- props & obstacles
export const staticObstacles = []; // {x,z,r,h,block}
const propsGroup = new THREE.Group(); scene.add(propsGroup);
export function placeOnTerrain(obj, x, z, sink = 0) {
  obj.position.set(x, terrainH(x, z) - sink, z);
}
{
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x847458, roughness: 0.95, flatShading: true });
  const rockGeoA = new THREE.DodecahedronGeometry(1, 0);
  const rockGeoB = new THREE.IcosahedronGeometry(1, 0);
  const ruinMat = new THREE.MeshStandardMaterial({ color: 0xa39076, roughness: 0.9 });
  const ruinGeo = new THREE.BoxGeometry(1, 1, 1);
  const toothMat = new THREE.MeshStandardMaterial({ color: 0x8d8d86, roughness: 0.85 });
  const toothGeo = new THREE.ConeGeometry(1.5, 2.7, 4);

  function scatter(n, minR, maxR, fn) {
    for (let i = 0; i < n; i++) {
      let x, z, ok = false;
      for (let t = 0; t < 12 && !ok; t++) {
        const a = rand(0, Math.PI * 2), r = rand(minR, maxR);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        ok = staticObstacles.every(o => dist2D(x, z, o.x, o.z) > o.r + 7);
      }
      if (ok) fn(x, z, i);
    }
  }

  // rocks — instanced, two shapes
  const nRocks = 46;
  const instA = new THREE.InstancedMesh(rockGeoA, rockMat, Math.ceil(nRocks / 2));
  const instB = new THREE.InstancedMesh(rockGeoB, rockMat, Math.floor(nRocks / 2));
  instA.castShadow = instB.castShadow = true;
  instA.receiveShadow = instB.receiveShadow = true;
  let ia = 0, ib = 0;
  const dummy = new THREE.Object3D();
  scatter(nRocks, 30, 245, (x, z, i) => {
    const s = rand(1.4, 3.6);
    dummy.position.set(x, terrainH(x, z) + s * 0.18, z);
    dummy.rotation.set(rand(0, 3), rand(0, 6), rand(0, 3));
    dummy.scale.set(s * rand(0.8, 1.3), s * rand(0.6, 1), s * rand(0.8, 1.3));
    dummy.updateMatrix();
    if (i % 2) { instA.setMatrixAt(ia++, dummy.matrix); } else { instB.setMatrixAt(ib++, dummy.matrix); }
    staticObstacles.push({ x, z, r: s * 1.05, h: s * 1.1, block: true });
  });
  instA.count = ia; instB.count = ib;
  propsGroup.add(instA, instB);

  // ruined walls
  scatter(16, 40, 235, (x, z) => {
    const w = rand(5, 9), h = rand(1.6, 3.2), yaw = rand(0, Math.PI);
    const m = new THREE.Mesh(ruinGeo, ruinMat);
    m.scale.set(w, h, rand(0.9, 1.4));
    m.rotation.y = yaw;
    m.rotation.z = randSpread(0.08);
    placeOnTerrain(m, x, z, -h * 0.32);
    m.castShadow = m.receiveShadow = true;
    propsGroup.add(m);
    staticObstacles.push({ x, z, r: w * 0.42, h: h, block: true });
  });

  // dead trees
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 });
  scatter(14, 35, 240, (x, z) => {
    const tr = new THREE.Group();
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, rand(3, 4.6), 5), trunkMat);
    t1.position.y = t1.geometry.parameters.height / 2;
    t1.rotation.z = randSpread(0.15);
    tr.add(t1);
    for (let b = 0; b < 3; b++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, rand(1.2, 2.2), 4), trunkMat);
      br.position.y = rand(1.8, 3.2);
      br.rotation.z = randSpread(1.2) + 0.6;
      br.rotation.y = rand(0, Math.PI * 2);
      tr.add(br);
    }
    tr.traverse(o => { o.castShadow = true; });
    placeOnTerrain(tr, x, z, 0.1);
    propsGroup.add(tr);
    staticObstacles.push({ x, z, r: 0.5, h: 0.0, block: false }); // drivable-around, doesn't block shots
  });

  // dragon-teeth boundary ring
  const nTeeth = 96;
  const teeth = new THREE.InstancedMesh(toothGeo, toothMat, nTeeth);
  teeth.castShadow = teeth.receiveShadow = true;
  for (let i = 0; i < nTeeth; i++) {
    const a = (i / nTeeth) * Math.PI * 2 + randSpread(0.012);
    const r = TEETH_R + randSpread(2.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    dummy.position.set(x, terrainH(x, z) + 1.05, z);
    dummy.rotation.set(randSpread(0.12), rand(0, Math.PI), randSpread(0.12));
    dummy.scale.setScalar(rand(0.85, 1.2));
    dummy.updateMatrix();
    teeth.setMatrixAt(i, dummy.matrix);
  }
  propsGroup.add(teeth);
}
