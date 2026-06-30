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
import { TRAIL_N } from "./constants";
// How often (ms) a new trail sample is recorded. Fixed cadence keeps the trail's
// temporal length framerate-independent (faster motion -> longer spatial trail).
const TRAIL_SAMPLE_MS = 22;

export interface GlScene {
  ready: Promise<void>;
  setEnergy(value: number): void;
  setScrollVelocity(value: number): void;
  setRunning(running: boolean): void;
  renderOnce(): void;
  /** Set any shader uniform by name (number, or [x, y] for a vec2). */
  setParam(name: string, value: number | [number, number]): void;
  /** Set the image to dither (img / canvas / bitmap), or null to clear it. */
  setImage(source: TexImageSource | null): void;
  /** Set the second image slot used for image->image crossfades (uXfade). */
  setImage2(source: TexImageSource | null): void;
  /**
   * Easter egg: bloom the cursor effect — hold `uMouseStrength` flat at `peak`
   * AND drop `uCursorRadius` to `radius` (lower = BIGGER disc) so the effect
   * balloons across the plate — for `holdMs` ms, defeating the usual fade. Then
   * the radius is restored and the pegged strength is released to decay from the
   * peak. Fine-pointer + motion only (a no-op under reduced motion, frame loop off).
   */
  cursorBurst(peak?: number, holdMs?: number, radius?: number): void;
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

  // A 1x1 mid-grey stand-in so uImage is always a valid sampler.
  const placeholder = new THREE.DataTexture(
    new Uint8Array([128, 128, 128, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  placeholder.needsUpdate = true;

  const uniforms = {
    uRes: {
      value: new THREE.Vector2(first.w * pixelRatio, first.h * pixelRatio),
    },
    uTime: { value: reducedMotion ? 20.0 : 0.0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseStrength: { value: 0 },
    // Recent pointer path, newest first (uTrail[0] = current). Recorded by the
    // frame loop; the shader draws cursor influence as the distance to it.
    uTrail: { value: Array.from({ length: TRAIL_N }, () => new THREE.Vector2(0, 0)) },
    uEnergy: { value: 1 },
    uScrollVel: { value: 0 },
    // Editable dither parameters (defaults reproduce the original plate).
    // Unused by shaders that do not declare them; three.js ignores those.
    uCell: { value: 150 },
    uToneBase: { value: 0.42 },
    uToneContrast: { value: 0.34 },
    uToneScale: { value: 1.7 },
    uDrift: { value: 0.05 },
    uThreshold: { value: 0.03 },
    uCursorMode: { value: 1 }, // 0 off, 1 clear, 2 ink, 3 bias, 4 negative, 5 develop
    uCursorAmp: { value: 0.4 }, // cursor effect strength
    uCursorRadius: { value: 9.0 }, // disc falloff rate (larger = tighter)
    uHold: { value: 0 }, // static floor under the decaying cursor strength
    uCursorEdge: { value: 0.25 }, // negative-mode disc hardness
    uDevCell: { value: 450 }, // develop sub-grid cell count (same units as uCell)
    uDevColor: { value: 1 }, // develop colorize amount: 0 monochrome .. 1 full colour
    uDevStage: { value: 0.45 }, // develop: grain->photo handoff point (0..1 of the press)
    uDevResolve: { value: 1 }, // develop: how far a full press resolves toward the photo (0..1)
    uDevSat: { value: 1 }, // develop: saturation of the resolved colour (0 gray .. 2 boost)
    uDevSharp: { value: 0 }, // develop: local-contrast / unsharp pop
    uDevLevels: { value: 4 }, // develop: posterise steps per RGB channel (own Levels)
    uDevBright: { value: 0 }, // develop: own brightness offset (on top of image B)
    uDevContrast: { value: 1 }, // develop: own contrast (on top of image C)
    uMotif: { value: 0 },
    uMotifWeight: { value: 0.5 },
    uMotifAngle: { value: 0 },
    uMotifTone: { value: 0 },
    uColorway: { value: 0 },
    uCrossOn: { value: 1 },
    uCrossSize: { value: 0.075 },
    uCrossPos: { value: new THREE.Vector2(0.62, 0.58) },
    uImage: { value: placeholder as THREE.Texture },
    uImageOn: { value: 0 },
    uImageRes: { value: new THREE.Vector2(1, 1) },
    uImage2: { value: placeholder as THREE.Texture },
    uImage2Res: { value: new THREE.Vector2(1, 1) },
    uXfade: { value: 0 }, // 0 sample uImage, 1 sample uImage2 (image->image crossfade)
    uImageState: { value: 0 }, // dev: show the undithered adjusted source
    uInvert: { value: 0 },
    uImageBrightness: { value: 0 },
    uImageContrast: { value: 1 },
    uFit: { value: 0 }, // 0 cover (crop), 1 contain (letterbox)
    uImgAlign: { value: new THREE.Vector2(0.5, 0.5) }, // image anchor in [0,1]
    uImgScale: { value: 1 }, // image zoom within the plate
    uEdgeFade: { value: 0.12 }, // photo edge taper (L/R image edge dissolves into ground)
    uFadeMode: { value: 0 },
    uFadeScale: { value: 3 },
    uFadeScaleY: { value: 3 }, // cloud Y frequency (isotropic by default)
    uNoiseType: { value: 0 }, // cloud noise: 0 fbm, 1 ridged, 2 voronoi, 3 turbulence, 4 cracks
    uFadeWarp: { value: 0 }, // domain-warp amount on the cloud noise
    uCloudWidth: { value: 1 }, // cloud horizontal extent, independent of the image
    uCloudSpeed: { value: 0 }, // cloud sideways scroll speed (0 = static)
    uFadePos: { value: new THREE.Vector2(0, 0) }, // dissolve anchor in [0,1] plate space
    uMaskView: { value: 0 }, // dev: show the raw fade mask as grayscale
    uCursorView: { value: 0 }, // dev: show raw cursor influence (infl) as grayscale
    uReveal: { value: 0 }, // 0 dithered, 1 full-res photo (crossfade)
    uColorDither: { value: 0 }, // 0 duotone, 1 full-colour ordered dither
    uColorLevels: { value: 4 }, // posterise steps per channel in colour mode
    uMarkBright: { value: 0 }, // brightness offset on the dither mark colour (not the source)
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
  let burstMs = 0; // easter egg: ms left holding the cursor bloom flat
  let burstPeak = 0; // held cursor strength during a burst (defeats the fade)
  let burstRadius = 0; // expanded uCursorRadius during a burst (lower = bigger disc)
  let baseRadius = 0; // uCursorRadius to restore when the burst ends
  let trailInit = false; // seed the whole trail on the first real pointer move
  let trailAccum = 0; // ms since the last recorded trail sample

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
        // First move: snap the cursor and seed the whole trail to here, so the
        // trail does not streak in from the screen center.
        if (!trailInit) {
          uniforms.uMouse.value.set(sx, sy);
          for (let i = 0; i < TRAIL_N; i++) uniforms.uTrail.value[i].set(sx, sy);
          trailInit = true;
        }
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
    // Triple-click burst: hold the bloom flat at full strength AND drop the disc
    // falloff so the cursor effect balloons across the plate (lower uCursorRadius
    // = bigger radius). Held flat for the brief moment — no fade — keeping
    // strengthTarget pegged so strength eases down from the peak after. On the
    // last burst frame the radius is restored to its pre-burst value.
    if (burstMs > 0) {
      burstMs -= deltaTime;
      strengthTarget = Math.max(strengthTarget, burstPeak);
      uniforms.uMouseStrength.value = burstPeak;
      uniforms.uCursorRadius.value = burstMs > 0 ? burstRadius : baseRadius;
    }

    // Record the smoothed cursor position into the trail on a fixed cadence
    // (newest at [0]); the shader draws influence as distance to this path.
    if (trailInit) {
      trailAccum += deltaTime;
      if (trailAccum >= TRAIL_SAMPLE_MS) {
        trailAccum = 0;
        const trail = uniforms.uTrail.value;
        for (let i = TRAIL_N - 1; i > 0; i--) trail[i].copy(trail[i - 1]);
        trail[0].copy(uniforms.uMouse.value);
      }
    }

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
    setParam(name: string, value: number | [number, number]) {
      const u = (uniforms as Record<string, { value: unknown }>)[name];
      if (!u) return;
      if (Array.isArray(value)) {
        (u.value as THREE.Vector2).set(value[0], value[1]);
      } else {
        u.value = value;
      }
      // Static frames (reduced / ?still) need a manual re-render to update.
      if (reducedMotion) render(20.0);
    },
    setImage(source: TexImageSource | null) {
      writeImage(uniforms.uImage, uniforms.uImageRes, source);
    },
    setImage2(source: TexImageSource | null) {
      writeImage(uniforms.uImage2, uniforms.uImage2Res, source);
    },
    cursorBurst(peak = 1, holdMs = 300, radius = 0.8) {
      // Capture the disc size to restore only when starting fresh, so re-arming
      // mid-burst (rapid clicks) never bakes the expanded radius in as the base.
      if (burstMs <= 0) baseRadius = uniforms.uCursorRadius.value;
      burstPeak = peak;
      burstRadius = radius;
      burstMs = holdMs;
    },
  };

  // Upload `source` into a (texture, resolution) uniform pair. Frees the previous
  // upload (never the shared placeholder) so repeated swaps do not leak textures.
  function writeImage(
    texU: { value: THREE.Texture },
    resU: { value: THREE.Vector2 },
    source: TexImageSource | null,
  ): void {
    const prev = texU.value;
    if (prev && prev !== placeholder) prev.dispose();
    if (!source) {
      texU.value = placeholder;
      resU.value.set(1, 1);
    } else {
      const tex = new THREE.Texture(source);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      const s = source as {
        naturalWidth?: number;
        videoWidth?: number;
        width?: number;
        naturalHeight?: number;
        videoHeight?: number;
        height?: number;
      };
      texU.value = tex;
      resU.value.set(
        s.naturalWidth || s.videoWidth || s.width || 1,
        s.naturalHeight || s.videoHeight || s.height || 1,
      );
    }
    if (reducedMotion) render(20.0);
  }
}
