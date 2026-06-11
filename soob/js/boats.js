// SOOB — boats.js
// Mesh factories, all primitive assembly + canvas plating textures.
// Conventions: group origin at the waterline (ships) or hull centre (sub,
// torpedo); forward is +z (heading 0), so x = sin(heading), z = cos(heading).
import * as THREE from 'three';
import { rand, randSpread } from './config.js';

// rust-streaked plating texture for merchant hulls
function platingTex(base, streak) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 128;
    g.fillStyle = `rgba(${streak},${0.05 + Math.random() * 0.22})`;
    g.fillRect(x, Math.random() * 18, 1 + Math.random() * 3, 12 + Math.random() * 40);
  }
  for (let y = 8; y < 64; y += 9) { // plate seams
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, y, 128, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const MAT = {
  subHull:  new THREE.MeshLambertMaterial({ color: 0x1b2832 }),
  subBelly: new THREE.MeshLambertMaterial({ color: 0x3c2a28 }),
  subTrim:  new THREE.MeshLambertMaterial({ color: 0x121c24 }),
  merch:    new THREE.MeshLambertMaterial({ map: platingTex('#2c3338', '120,70,50'), color: 0x8a949c }),
  merchDk:  new THREE.MeshLambertMaterial({ color: 0x232b30 }),
  tanker:   new THREE.MeshLambertMaterial({ map: platingTex('#33302c', '130,75,45'), color: 0x9a948a }),
  escort:   new THREE.MeshLambertMaterial({ color: 0x46545e }),
  escortDk: new THREE.MeshLambertMaterial({ color: 0x2c363e }),
  brass:    new THREE.MeshLambertMaterial({ color: 0x5c5644 }),
  charge:   new THREE.MeshLambertMaterial({ color: 0x20262c }),
  decoy:    new THREE.MeshLambertMaterial({ color: 0x3a5a50, emissive: 0x1a4438 }),
  prop:     new THREE.MeshLambertMaterial({ color: 0x4f4636 }),
};

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (r0, r1, h, mat, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);

// ---------------------------------------------------------------- player sub
export function buildSub() {
  const g = new THREE.Group();
  // hull: capsule lying along z
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.7, 27, 6, 12), MAT.subHull);
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(2.45, 26, 5, 10), MAT.subBelly);
  belly.rotation.x = Math.PI / 2;
  belly.position.y = -0.9;
  g.add(belly);
  // casing/deck
  const deck = box(2.4, 0.7, 26, MAT.subTrim);
  deck.position.y = 2.4;
  g.add(deck);
  // sail
  const sail = box(1.7, 4.2, 7.2, MAT.subHull);
  sail.position.set(0, 4.6, 2.5);
  g.add(sail);
  const sailCap = box(1.9, 0.5, 7.6, MAT.subTrim);
  sailCap.position.set(0, 6.8, 2.5);
  g.add(sailCap);
  // periscopes
  const scope1 = cyl(0.14, 0.14, 2.6, MAT.subTrim, 6);
  scope1.position.set(0.4, 8.2, 1.4); g.add(scope1);
  const scope2 = cyl(0.1, 0.1, 1.9, MAT.subTrim, 6);
  scope2.position.set(-0.4, 7.9, 3.2); g.add(scope2);
  // bow + stern planes, rudder
  const mkPlane = (w) => box(w, 0.22, 2.6, MAT.subTrim);
  const bowP = mkPlane(7); bowP.position.set(0, -0.4, 12.5); g.add(bowP);
  const sternP = mkPlane(8); sternP.position.set(0, 0, -13.5); g.add(sternP);
  const rudder = box(0.25, 6.5, 2.4, MAT.subTrim);
  rudder.position.set(0, 0, -14.5); g.add(rudder);
  // prop
  const prop = new THREE.Group();
  const hub = cyl(0.5, 0.2, 1, MAT.prop, 8);
  hub.rotation.x = Math.PI / 2; prop.add(hub);
  for (let i = 0; i < 5; i++) {
    const blade = box(0.18, 2.6, 0.7, MAT.prop);
    blade.position.y = 1.1;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 5) * Math.PI * 2;
    holder.rotation.y = 0.5;
    holder.add(blade);
    prop.add(holder);
  }
  prop.position.z = -16.6;
  g.add(prop);
  g.userData.prop = prop;
  return g;
}

// ---------------------------------------------------------------- merchants
function merchantHull(len, beam, hullH, mat) {
  const g = new THREE.Group();
  const mid = box(beam, hullH, len * 0.72, mat);
  g.add(mid);
  // raked bow: squashed cone
  const bow = new THREE.Mesh(new THREE.ConeGeometry(beam * 0.52, len * 0.2, 4), mat);
  bow.scale.y = 1; bow.rotation.x = Math.PI / 2; bow.rotation.z = Math.PI / 4;
  bow.scale.set(1.35, 1, hullH / (beam * 1.04));
  bow.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  bow.position.z = len * 0.46;
  // cone axis along z after rotateX; scale x/beam, y handled by geometry radius
  bow.geometry.computeBoundingBox?.();
  g.add(bow);
  const stern = box(beam * 0.9, hullH, len * 0.12, mat);
  stern.position.z = -len * 0.42;
  g.add(stern);
  return g;
}

export function buildShip(kind) {
  const g = new THREE.Group();
  if (kind === 'freighter') {
    const hull = merchantHull(58, 9, 8, MAT.merch);
    hull.position.y = 0.6; // 3.4 draft below, freeboard above
    g.add(hull);
    const sup = box(8, 7, 12, MAT.merchDk); sup.position.set(0, 7, -16); g.add(sup);
    const funnel = cyl(1.5, 1.8, 6, MAT.merchDk); funnel.position.set(0, 12, -16); g.add(funnel);
    const m1 = cyl(0.2, 0.25, 12, MAT.merchDk, 6); m1.position.set(0, 9, 12); g.add(m1);
    const m2 = cyl(0.2, 0.25, 10, MAT.merchDk, 6); m2.position.set(0, 8, -2); g.add(m2);
    const hatch1 = box(6, 1.2, 8, MAT.merchDk); hatch1.position.set(0, 4.6, 14); g.add(hatch1);
    const hatch2 = box(6, 1.2, 8, MAT.merchDk); hatch2.position.set(0, 4.6, 0); g.add(hatch2);
  } else if (kind === 'tanker') {
    const hull = merchantHull(78, 12, 9, MAT.tanker);
    hull.position.y = 0.3;
    g.add(hull);
    const sup = box(10, 8, 11, MAT.merchDk); sup.position.set(0, 8, -28); g.add(sup);
    const funnel = cyl(1.7, 2, 6, MAT.merchDk); funnel.position.set(0, 14, -29); g.add(funnel);
    const walk = box(1.4, 0.5, 52, MAT.merchDk); walk.position.set(0, 5.6, 4); g.add(walk);
    for (let i = 0; i < 4; i++) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), MAT.merchDk);
      dome.position.set(0, 5.2, 22 - i * 11);
      g.add(dome);
    }
  } else { // escort / hunter
    const hull = merchantHull(45, 6, 6.5, MAT.escort);
    hull.position.y = 0.9; // 2.6 draft, lean and fast
    g.add(hull);
    const bridge = box(5, 4.5, 8, MAT.escortDk); bridge.position.set(0, 5.6, 6); g.add(bridge);
    const mast = cyl(0.18, 0.3, 9, MAT.escortDk, 6); mast.position.set(0, 11, 5); g.add(mast);
    const funnel = cyl(1.2, 1.5, 5.5, MAT.escortDk);
    funnel.position.set(0, 7, -2); funnel.rotation.x = -0.12; g.add(funnel);
    // forward gun
    const turret = box(2.6, 1.4, 3, MAT.escortDk); turret.position.set(0, 4.2, 14); g.add(turret);
    const barrel = cyl(0.18, 0.18, 4.4, MAT.escortDk, 6);
    barrel.rotation.x = Math.PI / 2 - 0.12;
    barrel.position.set(0, 4.8, 16.6); g.add(barrel);
    g.userData.gun = barrel;
    // depth-charge racks aft
    for (const dx of [-1.6, 1.6]) {
      const rack = box(1.4, 1, 6, MAT.escortDk);
      rack.position.set(dx, 3.6, -18);
      g.add(rack);
    }
  }
  return g;
}

// ---------------------------------------------------------------- ordnance
export function buildTorpedo() {
  const g = new THREE.Group();
  const body = cyl(0.36, 0.36, 5.4, MAT.brass, 8);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), MAT.brass);
  nose.position.z = 2.7; g.add(nose);
  const tail = cyl(0.34, 0.16, 0.9, MAT.prop, 8);
  tail.rotation.x = Math.PI / 2; tail.position.z = -3.05; g.add(tail);
  return g;
}

export function buildCharge() {
  const g = new THREE.Group();
  const drum = cyl(0.8, 0.8, 1.6, MAT.charge, 10);
  g.add(drum);
  const band = cyl(0.84, 0.84, 0.25, MAT.brass, 10);
  g.add(band);
  return g;
}

export function buildDecoy() {
  const g = new THREE.Group();
  const can = cyl(0.6, 0.6, 1.8, MAT.decoy, 8);
  g.add(can);
  return g;
}
