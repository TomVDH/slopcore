/**
 * Background WebGL scene: one fullscreen shader quad, driven by gsap's
 * shared ticker (single RAF owner for the whole site).
 *
 * Renders are skipped while the canvas is fully covered by the solid
 * midband sections, and while the tab is hidden.
 */

import * as THREE from "three";
import { gsap } from "gsap";
import { fragmentShader, vertexShader } from "./shaders";

export interface GlScene {
  ready: Promise<void>;
  setEnergy(value: number): void;
  setScrollVelocity(value: number): void;
  setRunning(running: boolean): void;
  renderOnce(): void;
}

export function initScene(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
  frag: string = fragmentShader,
): GlScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });

  const isNarrow = window.innerWidth < 768;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, isNarrow ? 1.1 : 1.5);

  // Software rasterizers (SwiftShader, llvmpipe) cannot afford the fbm
  // field at full resolution; drop hard so the page stays responsive.
  const gl = renderer.getContext();
  const rendererName = String(
    gl.getParameter(
      gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER,
    ),
  );
  if (/swiftshader|llvmpipe|software/i.test(rendererName)) {
    pixelRatio = 0.45;
  }

  // The canvas may be fullscreen-fixed (the main site) or a panel
  // inside a layout (direction pages); size to the element either way.
  function measure(): { w: number; h: number } {
    const r = canvas.getBoundingClientRect();
    return {
      w: Math.max(Math.round(r.width) || window.innerWidth, 2),
      h: Math.max(Math.round(r.height) || window.innerHeight, 2),
    };
  }

  renderer.setPixelRatio(pixelRatio);
  const first = measure();
  renderer.setSize(first.w, first.h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uRes: {
      value: new THREE.Vector2(first.w * pixelRatio, first.h * pixelRatio),
    },
    uTime: { value: reducedMotion ? 20.0 : 0.0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseStrength: { value: 0 },
    uEnergy: { value: 1 },
    uScrollVel: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  let running = true;
  let firstFrameDone!: () => void;
  const ready = new Promise<void>((resolve) => {
    firstFrameDone = resolve;
  });

  // Mouse, lerped toward the pointer in shader space; strength decays.
  const mouseTarget = new THREE.Vector2(0, 0);
  let strengthTarget = 0;

  function toShaderSpace(clientX: number, clientY: number): [number, number] {
    const r = canvas.getBoundingClientRect();
    const w = r.width || window.innerWidth;
    const h = r.height || window.innerHeight;
    const x = clientX - r.left;
    const y = clientY - r.top;
    const m = Math.min(w, h);
    return [(2 * x - w) / m, -(2 * y - h) / m];
  }

  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (finePointer && !reducedMotion) {
    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();
    window.addEventListener(
      "pointermove",
      (e) => {
        const [sx, sy] = toShaderSpace(e.clientX, e.clientY);
        mouseTarget.set(sx, sy);
        const now = performance.now();
        const dt = Math.max(now - lastT, 1);
        const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt;
        strengthTarget = Math.min(strengthTarget + speed * 0.35, 1.4);
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
      },
      { passive: true },
    );
  }

  function render(elapsed: number) {
    uniforms.uTime.value = elapsed;
    renderer.render(scene, camera);
  }

  let rendered = false;
  function frame(time: number, deltaTime: number) {
    if (document.hidden) return;
    if (!running && rendered) return;

    const k = 1 - Math.exp(-deltaTime * 0.006);
    uniforms.uMouse.value.lerp(mouseTarget, k);
    strengthTarget *= Math.exp(-deltaTime * 0.0022);
    uniforms.uMouseStrength.value +=
      (strengthTarget - uniforms.uMouseStrength.value) * k;

    render(reducedMotion ? 20.0 : time);

    if (!rendered) {
      rendered = true;
      firstFrameDone();
    }
  }

  // First frame renders synchronously at init, even in a hidden tab, so
  // the intro never blocks on visibility.
  render(reducedMotion ? 20.0 : 0);
  rendered = true;
  firstFrameDone();

  if (!reducedMotion) {
    gsap.ticker.add((time, deltaTime) => frame(time, deltaTime));
  }

  function resize() {
    const { w, h } = measure();
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
    render(reducedMotion ? 20.0 : gsap.ticker.time);
  }
  window.addEventListener("resize", resize, { passive: true });

  return {
    ready,
    setEnergy(value: number) {
      uniforms.uEnergy.value = value;
    },
    setScrollVelocity(value: number) {
      uniforms.uScrollVel.value = value;
    },
    setRunning(value: boolean) {
      running = value;
      if (running) rendered = false;
    },
    renderOnce() {
      render(reducedMotion ? 20.0 : gsap.ticker.time);
    },
  };
}
