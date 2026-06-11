import type { ShaderVariant } from "./types";

/**
 * Risograph: a two-ink halftone print on dark stock. Lime and bone inks
 * sit at different screen angles with a lazy registration drift; moving
 * the cursor pools ink and slips the registration a little more.
 */

export const risograph: ShaderVariant = {
  id: "risograph",
  name: "Risograph",
  family: "Print & craft",
  blurb: "Two-ink halftone print with a lazy registration drift.",
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

    // Halftone coverage: dot radius follows the source field.
    float halftone(vec2 p, float ang, float scale, float src) {
      vec2 q = rot(ang) * p * scale;
      vec2 cell = fract(q) - 0.5;
      float r = sqrt(clamp(src, 0.0, 1.0)) * 0.60;
      float aa = scale * 2.0 / min(uRes.x, uRes.y);
      return 1.0 - smoothstep(r - aa, r + aa, length(cell));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.05;

      vec3 ink  = vec3(0.043, 0.043, 0.051);
      vec3 bone = vec3(0.64, 0.63, 0.58);
      vec3 lime = vec3(0.784, 0.961, 0.259);

      // Dark stock with paper tooth.
      vec3 col = ink * (0.92 + 0.10 * fbm(p * 9.0));

      // Lime plate: a drifting disc seated upper right, plus ink pooling
      // at the cursor.
      vec2 c1 = vec2(0.58 + 0.10 * sin(t * 0.8), 0.24 + 0.08 * cos(t * 0.6));
      float limeSrc = smoothstep(0.95, -0.15, length(p - c1) * 1.25);
      float md = length(p - uMouse);
      limeSrc += 0.55 * exp(-md * 2.6) * uMouseStrength;
      limeSrc = clamp(limeSrc, 0.0, 1.0) * (0.45 + 0.55 * uEnergy);

      // Bone plate: a wash across the upper left, leaving the lower left
      // quiet for the hero copy.
      float boneSrc = 0.62 * smoothstep(-0.25, 1.0, dot(p, vec2(-0.50, 0.42)));
      boneSrc += 0.28 * fbm(p * 2.1 + t * 0.15);
      boneSrc = clamp(boneSrc - 0.30, 0.0, 1.0);

      // Registration drift: slow breathing plus cursor slip.
      vec2 mis = vec2(0.007, -0.005) * (1.0 + 1.8 * uMouseStrength)
               + 0.0025 * vec2(sin(t * 0.9), cos(t * 0.7))
               + vec2(clamp(uScrollVel, -4.0, 4.0) * 0.0012, 0.0);

      float boneDots = halftone(p, 1.31, 24.0, boneSrc);
      float limeDots = halftone(p + mis, 0.26, 24.0, limeSrc);

      col = mix(col, bone, boneDots * 0.70);
      col = mix(col, lime, limeDots * 0.85);

      // Where the plates overlap the ink stacks a touch brighter.
      col += lime * boneDots * limeDots * 0.10;

      float vig = smoothstep(1.65, 0.4, length(p * vec2(0.85, 1.0)));
      col *= mix(0.62, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.035;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
