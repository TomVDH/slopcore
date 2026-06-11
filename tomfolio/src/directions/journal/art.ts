/**
 * Journal ink study.
 *
 * Algorithmic philosophy: wet ink on sized paper, observed rather than
 * animated. A slow fbm field decides where the wash settles; pigment
 * pools at the wash boundary the way real ink dries darker at its
 * edges; fine anisotropic noise plays the paper fiber. One vermilion
 * stroke crosses the study, the editor's mark. The cursor wets the
 * sheet locally and the wash blooms toward it. Everything moves at
 * drying speed; stillness is the point.
 */

export const journalFrag = /* glsl */ `
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
      p *= 2.04;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
    float t = uTime * 0.02;

    vec3 paper = vec3(0.973, 0.973, 0.969);
    vec3 ink   = vec3(0.086, 0.086, 0.102);
    vec3 verm  = vec3(0.78, 0.243, 0.114);

    // Paper fiber: fine, anisotropic, still.
    float fiber = vnoise(p * vec2(64.0, 9.0)) * 0.05 + vnoise(p * vec2(7.0, 52.0)) * 0.03;
    vec3 col = paper - fiber * 0.5;

    // The wash: where the ink has settled.
    float w = fbm(p * 1.55 + vec2(t * 0.6, -t * 0.4));
    w += 0.30 * fbm(p * 3.3 - vec2(t * 0.35, t * 0.5));

    // The cursor wets the sheet; the wash blooms toward it.
    float md = length(p - uMouse);
    w += 0.22 * uMouseStrength * exp(-md * 2.4);

    // Scroll barely stirs the water.
    w += clamp(uScrollVel, -4.0, 4.0) * 0.004;

    float body = smoothstep(0.58, 0.86, w);
    float rim = smoothstep(0.55, 0.59, w) * (1.0 - smoothstep(0.62, 0.70, w));

    // Granulation: pigment catching in the paper tooth.
    float gran = vnoise(p * 26.0) * 0.16;

    float density = clamp(body * (0.62 - gran) + rim * 0.30, 0.0, 1.0);
    density *= 0.7 + 0.3 * uEnergy;
    col = mix(col, ink, density);

    // The editor's stroke: one vermilion gesture, upper third.
    float dpath = p.y - (0.16 * sin(p.x * 1.9 + 1.3) + 0.34);
    float along = smoothstep(0.95, 0.15, abs(p.x - 0.05));
    float stroke = exp(-dpath * dpath * 160.0) * along;
    stroke *= 0.8 + 0.2 * vnoise(p * vec2(14.0, 3.0));
    col = mix(col, verm, stroke * 0.55 * (0.6 + 0.4 * uEnergy));

    // The sheet darkens a breath toward its edges.
    float vig = smoothstep(1.7, 0.5, length(p * vec2(0.9, 1.0)));
    col *= mix(0.965, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;
