import type { ShaderVariant } from "./types";

/**
 * Aquarelle: a quiet watercolor study. A sky wash, a meadow wash, a
 * sun blot and a handful of poppies, all wet-on-wet: every wash dries
 * darker at its edge and granulates into the paper tooth. The cursor
 * is a wet brush that re-blooms whatever it touches.
 */

export const aquarelle: ShaderVariant = {
  id: "aquarelle",
  name: "Aquarelle",
  family: "Watercolor",
  blurb: "Sky and meadow washes drying on white paper.",
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
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.6;
      for (int i = 0; i < 3; i++) {
        v += amp * vnoise(p);
        p *= 2.05;
        amp *= 0.5;
      }
      return v;
    }

    // Lay a wash: pigment body plus the darker dried edge.
    vec3 wash(vec3 paper, vec3 pigment, float mask, float granu) {
      float edge = mask * (1.0 - mask) * 4.0;
      float body = mask * 0.62 + edge * 0.30;
      body *= 0.85 + 0.3 * granu;
      return mix(paper, pigment, clamp(body, 0.0, 1.0));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.02;

      // Cold-press paper.
      float tooth = vnoise(p * 90.0) * 0.5 + vnoise(p * 31.0) * 0.5;
      vec3 paper = vec3(0.985, 0.982, 0.972) - tooth * 0.025;
      vec3 col = paper;

      vec3 skyBlue = vec3(0.52, 0.70, 0.86);
      vec3 meadow  = vec3(0.55, 0.74, 0.46);
      vec3 sunYel  = vec3(0.99, 0.83, 0.38);
      vec3 poppy   = vec3(0.92, 0.33, 0.30);

      // The wet brush: touching a wash re-blooms it.
      float md = length(p - uMouse);
      float rewet = exp(-md * 2.6) * clamp(uMouseStrength, 0.0, 1.0);

      float granu = fbm(p * 14.0);

      // Sky wash: a broad irregular field, high.
      float skyM = smoothstep(0.15, 0.75,
        fbm(p * vec2(0.9, 1.4) + vec2(t, 0.0)) + (p.y + 0.15) * 0.85);
      skyM = clamp(skyM + rewet * 0.35 * step(0.0, p.y), 0.0, 1.0);
      col = wash(col, skyBlue, skyM * (0.8 + 0.2 * uEnergy), granu);

      // Sun blot: wet into the wet sky, blooming outward.
      float sunM = 1.0 - smoothstep(0.10, 0.30 + 0.05 * sin(uTime * 0.2), length(p - vec2(0.52, 0.42)));
      col = wash(col, sunYel, sunM, granu);

      // Meadow wash low, lapping unevenly against the paper.
      float meadowM = smoothstep(0.1, 0.8,
        fbm(p * vec2(1.6, 2.4) + 7.0) + (-p.y - 0.30) * 1.5);
      meadowM = clamp(meadowM + rewet * 0.35 * step(p.y, -0.1), 0.0, 1.0);
      col = wash(col, meadow, meadowM * (0.8 + 0.2 * uEnergy), granu);

      // Poppies: five small wet dots, each with its dried rim.
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 c = vec2(mix(-1.1, 1.1, hash(vec2(fi, 3.1))),
                      mix(-0.75, -0.35, hash(vec2(fi, 8.2))));
        float r = mix(0.035, 0.06, hash(vec2(fi, 5.5)));
        r *= 1.0 + 0.4 * rewet * exp(-length(c - uMouse) * 2.0);
        float m = 1.0 - smoothstep(r * 0.5, r, length(p - c));
        col = wash(col, poppy, m * meadowM * 1.4, granu);
      }

      // Pencil horizon, barely there under the washes.
      float pencil = 1.0 - smoothstep(0.0, 0.004, abs(p.y + 0.30 + 0.01 * fbm(vec2(p.x * 3.0, 1.0))));
      col = mix(col, vec3(0.55), pencil * 0.18);

      // The deckle: washes never reach the edge of the sheet.
      vec2 b = abs(p) - vec2(1.46, 0.88);
      float margin = smoothstep(-0.06, 0.02, max(b.x, b.y));
      col = mix(col, paper, margin);

      // Scroll tilts the board: the faintest run of pigment.
      col -= vec3(0.02, 0.01, 0.0) * clamp(uScrollVel, 0.0, 4.0) * 0.02 * skyM;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
