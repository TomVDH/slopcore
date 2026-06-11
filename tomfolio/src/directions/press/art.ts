/**
 * Presswerk dither field.
 *
 * Algorithmic philosophy: a continuous tone field, reproduced the only
 * way a press can: by deciding, dot by dot, ink or no ink. A drifting
 * fbm luminance field is quantized through an ordered 4x4 Bayer matrix
 * at chunky cell size, so the gradient lives entirely in dot density.
 * The cursor presses a highlight into the plate; one aviation-red
 * registration cross holds the corner. Seeded by time alone, tuned so
 * the plate reads as a working proof, not a screensaver.
 */

export const pressFrag = /* glsl */ `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uEnergy;
  uniform float uScrollVel;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return v;
  }

  // 2x2 Bayer cell: (0,0)=0 (1,0)=2 (0,1)=3 (1,1)=1
  float bayer2(vec2 p) {
    return p.x * 2.0 + p.y * 3.0 - p.x * p.y * 4.0;
  }

  // Ordered 4x4 Bayer threshold in [0,1).
  float bayer4(vec2 pix) {
    vec2 p1 = mod(pix, 2.0);
    vec2 p2 = mod(floor(pix / 2.0), 2.0);
    return (bayer2(p1) * 4.0 + bayer2(p2)) / 16.0;
  }

  void main() {
    // Chunky press cells.
    float cell = max(uRes.y / 150.0, 2.0);
    vec2 pix = floor(gl_FragCoord.xy / cell);
    vec2 p = (pix * cell * 2.0 - uRes) / min(uRes.x, uRes.y);

    float t = uTime * 0.05;

    vec3 paper = vec3(0.957, 0.957, 0.941);
    vec3 ink   = vec3(0.039, 0.039, 0.039);
    vec3 red   = vec3(0.902, 0.098, 0.098);

    // Tone field: diagonal wash plus drifting grain.
    float lum = 0.42 + 0.34 * fbm(p * 1.7 + vec2(t * 0.5, -t * 0.3));
    lum += 0.22 * smoothstep(-1.2, 1.2, dot(p, vec2(0.5, 0.85)));

    // The cursor presses a highlight into the plate.
    float md = length(p - uMouse);
    lum += 0.40 * uMouseStrength * exp(-md * 2.2);

    // Energy is press pressure: contrast around the midpoint.
    lum = 0.5 + (lum - 0.5) * (0.75 + 0.55 * uEnergy);
    lum += clamp(uScrollVel, -4.0, 4.0) * 0.01;

    // The decision: ink or no ink.
    float threshold = bayer4(pix) + 0.03;
    float on = step(threshold, clamp(lum, 0.0, 1.0));
    vec3 col = mix(ink, paper, on);

    // Aviation-red registration cross, upper right of the plate.
    vec2 cpos = vec2(0.62, 0.58);
    vec2 cd = abs(p - cpos);
    float cross = step(min(cd.x, cd.y), 0.006) * step(max(cd.x, cd.y), 0.075);
    col = mix(col, red, cross);

    gl_FragColor = vec4(col, 1.0);
  }
`;
