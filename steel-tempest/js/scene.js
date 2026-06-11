// TONK — scene.js
// Renderer, scene, camera, lights, sky dome + sun sprite.
import * as THREE from 'three';
import { CFG, rand } from './config.js';

export const canvas = document.getElementById('scene');
export let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  const ts = document.getElementById('titleScreen');
  if (ts) ts.innerHTML =
    '<h1 style="font-size:40px">NO WEBGL</h1><div class="brief">This machine refuses to render tanks.</div>';
  throw e;
}
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CFG.world.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfa376, CFG.world.fogNear, CFG.world.fogFar);

export const camera = new THREE.PerspectiveCamera(
  58,
  (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight),
  0.1, 2200
);
camera.position.set(0, 9, -16);

// lights
export const hemi = new THREE.HemisphereLight(0xa8bdd1, 0x8a6f4d, CFG.world.hemiIntensity);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffdcae, CFG.world.sunIntensity);
sun.position.set(60, 85, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10; sun.shadow.camera.far = 260;
sun.shadow.camera.left = -85; sun.shadow.camera.right = 85;
sun.shadow.camera.top = 85; sun.shadow.camera.bottom = -85;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.55;
scene.add(sun); scene.add(sun.target);

// push live CFG.world values into the scene objects (tester hook)
export function applyWorldCfg() {
  scene.fog.near = CFG.world.fogNear;
  scene.fog.far = CFG.world.fogFar;
  sun.intensity = CFG.world.sunIntensity;
  hemi.intensity = CFG.world.hemiIntensity;
  renderer.toneMappingExposure = CFG.world.exposure;
}

// sky dome
{
  const c = document.createElement('canvas'); c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0.0, '#5d7693');
  gr.addColorStop(0.42, '#9da793');
  gr.addColorStop(0.62, '#d3af79');
  gr.addColorStop(0.78, '#eccb92');
  gr.addColorStop(1.0, '#e3bd84');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(950, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // baked sun glow sprite
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 2, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,244,214,1)');
  rg.addColorStop(0.18, 'rgba(255,219,150,.85)');
  rg.addColorStop(0.5, 'rgba(255,180,90,.22)');
  rg.addColorStop(1, 'rgba(255,170,80,0)');
  sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: stex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
  }));
  sunSprite.position.copy(sun.position).normalize().multiplyScalar(880);
  sunSprite.scale.setScalar(330);
  scene.add(sunSprite);
}
