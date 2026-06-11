import type { ShaderVariant } from "./types";

/**
 * Synthwave: the poster sunset. A striped sun sinks behind a violet
 * ridge while a cyan laser grid rolls toward the horizon forever.
 * Unapologetically pink. The cursor drags the sun; energy is glow.
 */

export const synthwave: ShaderVariant = {
  id: "synthwave",
  name: "Synthwave",
  family: "Synthwave",
  blurb: "Striped sun, laser grid, a sky that never apologizes.",
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

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * (0.5 + 0.2 * uEnergy) + clamp(abs(uScrollVel), 0.0, 4.0) * 0.05;
      float glow = 0.6 + 0.4 * uEnergy;

      vec3 skyTop = vec3(0.09, 0.02, 0.21);
      vec3 skyLow = vec3(0.45, 0.07, 0.42);
      vec3 pink   = vec3(1.0, 0.18, 0.62);
      vec3 gold   = vec3(1.0, 0.78, 0.25);
      vec3 cyan   = vec3(0.15, 0.95, 0.95);
      vec3 ridgeC = vec3(0.13, 0.03, 0.25);

      float horizon = -0.12;
      vec3 col;

      if (p.y > horizon) {
        // Sky.
        float h = (p.y - horizon) / (1.0 - horizon);
        col = mix(skyLow, skyTop, pow(h, 0.7));

        // Stars high up.
        vec2 sc = floor(p * 60.0);
        float star = step(0.992, hash(sc)) * smoothstep(0.3, 0.8, h);
        col += vec3(0.9) * star * (0.5 + 0.5 * sin(uTime + hash(sc + 1.0) * 9.0));

        // The sun, leaning with the cursor.
        vec2 sunC = vec2(0.0 + uMouse.x * 0.15, 0.30 + uMouse.y * 0.08);
        float sd = length((p - sunC) * vec2(1.0, 1.05));
        float sun = 1.0 - smoothstep(0.42, 0.425, sd);

        // Stripes eat the sun's lower half, wider as they descend.
        float rel = p.y - (sunC.y - 0.42);
        float stripeW = mix(0.55, 0.0, clamp(rel / 0.5, 0.0, 1.0));
        float stripes = step(stripeW, fract(rel * 11.0));
        sun *= stripes;

        vec3 sunCol = mix(pink, gold, clamp((p.y - sunC.y + 0.42) / 0.84, 0.0, 1.0));
        col = mix(col, sunCol, sun);
        col += pink * exp(-sd * 2.4) * 0.35 * glow;

        // The ridge in front of everything.
        float ridge = horizon + 0.10 + 0.13 * vnoise(vec2(p.x * 1.6 + 4.0, 2.0))
                    + 0.05 * vnoise(vec2(p.x * 4.2, 7.0));
        float m = 1.0 - smoothstep(ridge - 0.004, ridge + 0.004, p.y);
        col = mix(col, ridgeC, m);
        col += pink * m * exp(-(ridge - p.y) * 14.0) * 0.4;
      } else {
        // The grid floor, rolling toward the viewer.
        float depth = horizon - p.y;
        float z = 1.0 / max(depth, 1e-3);
        vec2 g = vec2(p.x * z * 1.4, z * 0.8 + t * 1.2);

        vec3 floorC = mix(vec3(0.16, 0.02, 0.27), vec3(0.05, 0.01, 0.12),
                          clamp(depth * 1.6, 0.0, 1.0));

        float lineX = pow(1.0 - abs(fract(g.x) - 0.5) * 2.0, 24.0);
        float lineY = pow(1.0 - abs(fract(g.y) - 0.5) * 2.0, 24.0);
        float lines = clamp(lineX + lineY, 0.0, 1.0) * smoothstep(0.0, 0.06, depth);

        col = floorC + cyan * lines * glow * 0.9;
        // Horizon burn.
        col += pink * exp(-depth * 9.0) * 0.5 * glow;
      }

      float vig = smoothstep(2.0, 0.5, length(p * vec2(0.8, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.02;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
