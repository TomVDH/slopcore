import type { ShaderVariant } from "./types";

/**
 * Monolith: three concrete slabs and one long soft shadow. Museum
 * light orbits slowly; the cursor leans it. The accent lives in a
 * single lit reveal joint.
 */

export const monolith: ShaderVariant = {
  id: "monolith",
  name: "Monolith",
  family: "Architecture",
  blurb: "Three slabs, one soft shadow study, museum light.",
  frag: /* glsl */ `
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
      float amp = 0.6;
      for (int i = 0; i < 3; i++) {
        v += amp * vnoise(p);
        p *= 2.03;
        amp *= 0.5;
      }
      return v;
    }

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    float sdBox(vec2 p, vec2 b, float r) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.05;

      vec3 ink      = vec3(0.043, 0.043, 0.051);
      vec3 concrete = vec3(0.76, 0.76, 0.72);
      vec3 lime     = vec3(0.784, 0.961, 0.259);

      // Museum light orbits very slowly; the cursor leans it.
      float la = 2.45 + 0.18 * sin(uTime * 0.025) + uMouse.x * 0.5;
      vec2 L = vec2(cos(la), sin(la));
      float lampe = (0.85 + 0.15 * sin(uTime * 0.017)) * (1.0 + 0.15 * uMouseStrength);

      // Three slabs with microscopic drift, grouped right of center so
      // the hero copy keeps the lower-left quadrant.
      vec2 pA = rot(0.07 + 0.012 * sin(t * 0.8)) * (p - vec2(-0.16, 0.04 + 0.012 * sin(t * 0.6)));
      vec2 pB = rot(-0.05 + 0.010 * sin(t * 0.7 + 2.0)) * (p - vec2(0.48, -0.32));
      vec2 pC = rot(0.12 + 0.014 * sin(t * 0.9 + 4.0)) * (p - vec2(0.74, 0.32 + 0.014 * sin(t * 0.5 + 1.0)));

      float dA = sdBox(pA, vec2(0.16, 0.58), 0.012);
      float dB = sdBox(pB, vec2(0.52, 0.10), 0.012);
      float dC = sdBox(pC, vec2(0.09, 0.27), 0.012);

      // Background wall: vertical museum gradient with breath of haze.
      vec3 col = ink + concrete * (0.10 + 0.07 * smoothstep(-1.0, 1.0, p.y)) * lampe;
      col *= 0.94 + 0.06 * fbm(p * 2.4 + t * 0.1);

      // Long soft shadows cast onto the wall (one penumbra per slab).
      vec2 so = L * 0.16;
      float sh = 1.0;
      sh *= 0.45 + 0.55 * smoothstep(-0.02, 0.16, sdBox(pA + rot(0.07) * so, vec2(0.16, 0.58), 0.012));
      sh *= 0.45 + 0.55 * smoothstep(-0.02, 0.16, sdBox(pB + rot(-0.05) * so, vec2(0.52, 0.10), 0.012));
      sh *= 0.45 + 0.55 * smoothstep(-0.02, 0.16, sdBox(pC + rot(0.12) * so, vec2(0.09, 0.27), 0.012));
      col *= sh;

      float aa = 2.5 / min(uRes.x, uRes.y);

      // Paint slabs front-most last: B (low), A (tall), C (small).
      for (int i = 0; i < 3; i++) {
        float d = i == 0 ? dB : (i == 1 ? dA : dC);
        vec2 q = i == 0 ? pB : (i == 1 ? pA : pC);
        float inside = 1.0 - smoothstep(-aa, aa, d);
        if (inside > 0.001) {
          // Face: flat concrete, faint top-light gradient, fine mottle.
          float face = 0.30 + 0.10 * smoothstep(-0.7, 0.9, q.y);
          face *= 0.93 + 0.09 * fbm(q * 9.0 + float(i) * 7.3);

          // Lit edge facing the lamp.
          float rim = exp(-abs(d) * 60.0) * max(dot(normalize(q + vec2(0.0001)), L), 0.0);

          vec3 slab = ink + concrete * face * lampe + concrete * rim * 0.35 * lampe;
          col = mix(col, slab, inside);
        }
      }

      // The one accent: a lit reveal joint where the tall slab passes the low one.
      float joint = exp(-abs(dA) * 30.0) * exp(-abs(dB) * 30.0);
      col += lime * joint * 0.9 * uEnergy * lampe;

      col = mix(col * 0.6, col, 0.45 + 0.55 * uEnergy);

      float vig = smoothstep(1.6, 0.35, length(p * vec2(0.88, 1.0)));
      col *= mix(0.55, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
