// SOOB — scene.js
// Renderer, scene, camera, lights, and the depth grade: fog density, water
// colour, and light levels all follow the camera down the water column.
import * as THREE from 'three';
import { CFG, clamp, lerp } from './config.js';

export const canvas = document.getElementById('scene');
export let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  const ts = document.getElementById('titleScreen');
  if (ts) ts.innerHTML =
    '<h1 style="font-size:40px">NO WEBGL</h1><div class="brief">THIS MACHINE REFUSES TO DIVE.</div>';
  throw e;
}
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CFG.world.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a2e44);
scene.fog = new THREE.FogExp2(0x0a2e44, CFG.world.fogShallow);

export const camera = new THREE.PerspectiveCamera(
  60,
  (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight),
  0.1, 2600
);
camera.position.set(0, -8, -40);

// lights — sun filters down from the surface, dies with depth
export const hemi = new THREE.HemisphereLight(0x9fd8e8, 0x06222e, CFG.world.hemiIntensity);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xbfeaff, CFG.world.sunIntensity);
sun.position.set(40, 120, 25);
scene.add(sun); scene.add(sun.target);
// faint abyssal floor light so deep silhouettes never go fully black
export const deepFill = new THREE.AmbientLight(0x0a1c28, 0.9);
scene.add(deepFill);

// water column colour stops (surface → abyss)
const SHALLOW = new THREE.Color(0x0d3a55);
const MID     = new THREE.Color(0x07273c);
const ABYSS   = new THREE.Color(0x020a14);
const _c = new THREE.Color();

// push live CFG.world values + camera depth into fog/lights (called every frame)
export function applyDepthGrade(camY) {
  const d = clamp(-camY / (CFG.world.crushDepth + 60), 0, 1); // 0 surface → 1 deep
  if (d < 0.45) _c.lerpColors(SHALLOW, MID, d / 0.45);
  else _c.lerpColors(MID, ABYSS, (d - 0.45) / 0.55);
  scene.background.copy(_c);
  scene.fog.color.copy(_c);
  scene.fog.density = lerp(CFG.world.fogShallow, CFG.world.fogDeep, d);
  sun.intensity = CFG.world.sunIntensity * Math.pow(1 - d, 1.7);
  hemi.intensity = CFG.world.hemiIntensity * (0.35 + 0.65 * (1 - d));
  renderer.toneMappingExposure = CFG.world.exposure;
}
export function applyWorldCfg() { applyDepthGrade(camera.position.y); }
