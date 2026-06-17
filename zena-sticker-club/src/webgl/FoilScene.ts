import * as THREE from 'three';

const MAX_PARTICLES = 900;

const SHIMMER_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Premium brushed-metal foil: anisotropic grain, a sharp travelling highlight
// with a subtle thin-film tint, micro-sparkle, and a jagged tear-front glint.
// Stays within the neutral pewter palette (the sealed pack must not reveal hue).
const SHIMMER_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime, uTear, uEnergy, uSeed;
  uniform vec2 uPointer;
  uniform vec3 uColorA, uColorB;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 uv = vUv;
    // Brushed anisotropy: noise strongly stretched along one axis.
    float grain  = noise(uv * vec2(2.0, 30.0) + vec2(uSeed, uTime * 0.05) + uPointer * 0.06);
    float grain2 = noise(uv * vec2(42.0, 2.0) - uTime * 0.03);

    // Base metallic gradient between the two neutral foil tones.
    vec3 base = mix(uColorA, uColorB, clamp(uv.y * 0.6 + grain * 0.4, 0.0, 1.0));

    // Sharp diagonal highlight that travels (faster + brighter on hover).
    float sweepPos = (uv.x + uv.y) * 0.5;
    float band = sin(sweepPos * 9.0 - uTime * (0.55 + uEnergy * 1.0) + grain * 1.4);
    float sweep = pow(smoothstep(0.45, 1.0, band), 3.0);

    // Faint thin-film tint, only inside the highlight (a hint of life, not rainbow).
    float phase = fract(grain * 0.5 + dot(uPointer, vec2(0.4, 0.25)) + uTime * 0.05);
    vec3 tint = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));

    float spark = pow(grain2, 8.0) * 1.3;

    vec3 col = base * (0.28 + uEnergy * 0.3)
             + sweep * mix(vec3(1.0), tint, 0.35) * 1.1
             + vec3(spark);
    float a = sweep * 0.7 + spark * 0.45 + grain * 0.05;

    // Jagged tear dissolve: a diagonal front advances as uTear rises.
    float front = uv.x * 0.5 + uv.y * 0.5;
    float edge = 1.0 - smoothstep(0.0, 0.07, abs(front - uTear));
    col += edge * uTear * mix(vec3(1.0), uColorB, 0.4) * 2.0;
    a += edge * uTear;

    // Branchless reveal mask (avoids discard, which stalls early-Z on tile GPUs).
    float mask = uTear > 0.0001 ? step(uTear - 0.04, front) : 1.0;
    gl_FragColor = vec4(col * mask, a * mask);
  }
`;

const PARTICLE_VERT = /* glsl */ `
  uniform float uElapsed, uPixelRatio, uScale;
  uniform vec2 uOrigin;
  attribute vec3 aVel;
  attribute float aSize, aBirth, aHue;
  varying float vLife, vHue;
  void main() {
    float t = max(0.0, uElapsed - aBirth);
    float life = t / 1.25;
    vLife = life; vHue = aHue;
    vec2 grav = vec2(0.0, -240.0);
    vec2 pos = uOrigin + aVel.xy * t + 0.5 * grav * t * t;
    vec4 mv = modelViewMatrix * vec4(pos, 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
    float fade = clamp(1.0 - life, 0.0, 1.0);
    gl_PointSize = aSize * fade * uScale * uPixelRatio;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA, uColorB;
  varying float vLife, vHue;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float life = clamp(1.0 - vLife, 0.0, 1.0);
    float halo = smoothstep(0.5, 0.0, d);   // soft outer glow
    float core = smoothstep(0.16, 0.0, d);  // bright hot core
    vec3 col = mix(uColorA, uColorB, vHue) + core * 0.7;
    float alpha = (halo * 0.45 + core * 0.95) * life;
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface BurstOptions {
  /** Screen-space origin in CSS pixels. */
  x: number;
  y: number;
  colorA: string;
  colorB: string;
  count: number;
}

/**
 * Single transparent WebGL canvas in #fx-layer, mapped 1:1 to CSS pixels by an
 * orthographic camera. Renders ONLY when needed (idle shimmer while the pack is
 * shown, or during a ~1.1s burst), then stops. Pooled particles, no per-burst
 * allocation. Everything is best-effort: a thrown error never breaks the loop.
 */
export class FoilScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly clock = new THREE.Clock();

  private readonly shimmer: THREE.Mesh;
  private readonly shimmerMat: THREE.ShaderMaterial;
  private readonly points: THREE.Points;
  private readonly pointsMat: THREE.ShaderMaterial;
  private readonly pointsGeo: THREE.BufferGeometry;

  private mode: 'off' | 'idle' | 'burst' = 'off';
  private raf = 0;
  private idleAccum = 0;
  private burstElapsed = 0;
  private burstDuration = 0;
  private packRect: DOMRect | null = null;
  private packEl: HTMLElement | null = null;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    this.renderer.setClearAlpha(0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    host.append(this.renderer.domElement);

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -1000, 1000);

    // --- shimmer plane (hidden until a pack is attached) ---
    this.shimmerMat = new THREE.ShaderMaterial({
      vertexShader: SHIMMER_VERT,
      fragmentShader: SHIMMER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uTear: { value: 0 },
        uEnergy: { value: 0 },
        uSeed: { value: Math.random() * 10 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uColorA: { value: new THREE.Color('#c9d2de') },
        uColorB: { value: new THREE.Color('#8a93a1') },
      },
    });
    this.shimmer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shimmerMat);
    this.shimmer.visible = false;
    this.scene.add(this.shimmer);

    // --- particle burst (pooled) ---
    this.pointsGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3); // unused by shader but required
    const vel = new Float32Array(MAX_PARTICLES * 3);
    const size = new Float32Array(MAX_PARTICLES);
    const birth = new Float32Array(MAX_PARTICLES);
    const hue = new Float32Array(MAX_PARTICLES);
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.pointsGeo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    this.pointsGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.pointsGeo.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
    this.pointsGeo.setAttribute('aHue', new THREE.BufferAttribute(hue, 1));
    this.pointsGeo.setDrawRange(0, 0);

    this.pointsMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uElapsed: { value: 0 },
        uOrigin: { value: new THREE.Vector2(0, 0) },
        uScale: { value: 1 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uColorA: { value: new THREE.Color('#ffffff') },
        uColorB: { value: new THREE.Color('#ffd34d') },
      },
    });
    this.points = new THREE.Points(this.pointsGeo, this.pointsMat);
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
  }

  /** Show the shimmer over the pack element and start the throttled idle loop. */
  attachPack(packEl: HTMLElement, colorA = '#c9d2de', colorB = '#8a93a1'): void {
    this.packEl = packEl;
    (this.shimmerMat.uniforms.uColorA!.value as THREE.Color).set(colorA);
    (this.shimmerMat.uniforms.uColorB!.value as THREE.Color).set(colorB);
    this.shimmerMat.uniforms.uTear!.value = 0;
    this.positionShimmer();
    this.shimmer.visible = true;
    this.mode = 'idle';
    this.ensureLoop();
  }

  /** Drive the tear dissolve (0..1) during the rip. */
  setTear(p: number): void {
    this.shimmerMat.uniforms.uTear!.value = p;
    this.shimmerMat.uniforms.uEnergy!.value = Math.max(this.shimmerMat.uniforms.uEnergy!.value, p);
    this.ensureLoop();
  }

  setEnergy(e: number): void {
    this.shimmerMat.uniforms.uEnergy!.value = e;
  }

  hidePack(): void {
    this.shimmer.visible = false;
    this.shimmerMat.uniforms.uTear!.value = 0;
    this.shimmerMat.uniforms.uEnergy!.value = 0;
    this.packEl = null;
    if (this.mode === 'idle') this.mode = 'off';
  }

  /** Fire the particle burst from a screen-space point. */
  burst(opts: BurstOptions): void {
    const count = Math.min(MAX_PARTICLES, Math.max(0, Math.floor(opts.count)));
    const vel = this.pointsGeo.getAttribute('aVel') as THREE.BufferAttribute;
    const size = this.pointsGeo.getAttribute('aSize') as THREE.BufferAttribute;
    const birth = this.pointsGeo.getAttribute('aBirth') as THREE.BufferAttribute;
    const hue = this.pointsGeo.getAttribute('aHue') as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 540;
      const upBias = 70 + Math.random() * 210;
      vel.setXYZ(i, Math.cos(angle) * speed, Math.sin(angle) * speed + upBias, 0);
      const r = Math.random();
      size.setX(i, 3 + r * r * 22); // mostly small flecks, a few large foil flakes
      birth.setX(i, Math.random() * 0.1);
      hue.setX(i, Math.random());
    }
    vel.needsUpdate = true;
    size.needsUpdate = true;
    birth.needsUpdate = true;
    hue.needsUpdate = true;
    this.pointsGeo.setDrawRange(0, count);

    (this.pointsMat.uniforms.uColorA!.value as THREE.Color).set(opts.colorA);
    (this.pointsMat.uniforms.uColorB!.value as THREE.Color).set(opts.colorB);
    this.pointsMat.uniforms.uOrigin!.value.set(opts.x - window.innerWidth / 2, window.innerHeight / 2 - opts.y);
    this.pointsMat.uniforms.uElapsed!.value = 0;
    this.points.visible = true;

    this.burstElapsed = 0;
    this.burstDuration = 1.45;
    this.mode = 'burst';
    this.ensureLoop();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.mode = 'off';
    this.shimmer.geometry.dispose();
    this.shimmerMat.dispose();
    this.pointsGeo.dispose();
    this.pointsMat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private positionShimmer(): void {
    if (!this.packEl) return;
    // Read the live (transformed) rect so the shimmer follows the pack's idle
    // float, tear and scale exactly; add the rotation from its CSS var.
    const r = this.packEl.getBoundingClientRect();
    this.packRect = r;
    const rot = parseFloat(this.packEl.style.getPropertyValue('--pack-rot')) || 0;
    this.shimmer.scale.set(r.width, r.height, 1);
    this.shimmer.position.set(
      r.left + r.width / 2 - window.innerWidth / 2,
      window.innerHeight / 2 - (r.top + r.height / 2),
      0,
    );
    this.shimmer.rotation.z = (-rot * Math.PI) / 180;
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.pointsMat.uniforms.uPixelRatio!.value = this.renderer.getPixelRatio();
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();
    this.positionShimmer();
  };

  private onPointer = (e: PointerEvent): void => {
    if (!this.packRect || this.mode === 'off') return;
    const r = this.packRect;
    const px = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const py = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const v = this.shimmerMat.uniforms.uPointer!.value as THREE.Vector2;
    v.set(Math.max(-1.5, Math.min(1.5, px)), Math.max(-1.5, Math.min(1.5, py)));
  };

  private ensureLoop(): void {
    if (this.raf || this.mode === 'off') return;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.mode === 'idle') {
      this.idleAccum += dt;
      // throttle idle shimmer to ~30fps
      if (this.idleAccum >= 1 / 30) {
        this.positionShimmer(); // follow the pack's float / tear each rendered frame
        this.shimmerMat.uniforms.uTime!.value += this.idleAccum;
        this.renderer.render(this.scene, this.camera);
        this.idleAccum = 0;
      }
      this.raf = requestAnimationFrame(this.tick);
      return;
    }

    if (this.mode === 'burst') {
      this.burstElapsed += dt;
      this.shimmerMat.uniforms.uTime!.value += dt;
      this.pointsMat.uniforms.uElapsed!.value = this.burstElapsed;
      this.renderer.render(this.scene, this.camera);
      if (this.burstElapsed >= this.burstDuration) {
        this.points.visible = false;
        this.pointsGeo.setDrawRange(0, 0);
        this.mode = this.shimmer.visible ? 'idle' : 'off';
      }
      if (this.mode !== 'off') {
        this.raf = requestAnimationFrame(this.tick);
        return;
      }
    }

    // mode === 'off'
    this.raf = 0;
  };
}
