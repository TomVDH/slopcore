import type { ShaderVariant } from "./types";

/**
 * Phyllotaxis: sunflower-head geometry, seeds laid on the golden angle,
 * a slow pulse traveling outward through the rings. The cursor tilts
 * the head and swells the seeds it passes.
 */

export const phyllotaxis: ShaderVariant = {
  id: "phyllotaxis",
  name: "Phyllotaxis",
  family: "Light & nature",
  blurb: "Sunflower geometry breathing in slow waves.",
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

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    const float GA = 2.39996323;
    const float SEED_C = 0.074;

    float g_best;
    float g_bestR;
    float g_bestN;

    // Spatial neighbors on a phyllotaxis differ by Fibonacci strides,
    // so candidates are checked at those offsets around the estimate.
    void consider(vec2 p, float n) {
      n = max(n, 0.0);
      float sr = SEED_C * sqrt(n);
      float sa = mod(n * GA, 6.28318530);
      vec2 sp = sr * vec2(cos(sa), sin(sa));
      float d = length(p - sp);
      if (d < g_best) {
        g_best = d;
        g_bestR = sr;
        g_bestN = n;
      }
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);

      vec3 ink  = vec3(0.043, 0.043, 0.051);
      vec3 moss = vec3(0.18, 0.25, 0.17);
      vec3 bone = vec3(0.78, 0.78, 0.73);
      vec3 lime = vec3(0.784, 0.961, 0.259);

      // The head sits up and right of center, clear of the hero copy.
      p -= vec2(0.30, 0.10);

      // The whole head turns imperceptibly; the cursor tilts it.
      p = rot(uTime * 0.008) * p;
      p.x *= 1.0 + 0.10 * uMouse.x * 0.5;
      p.y *= 1.0 + 0.14 * uMouse.y * 0.5;

      float c = SEED_C;

      float rr = length(p);
      float nEst = floor((rr / c) * (rr / c) + 0.5);

      g_best = 9.0;
      g_bestR = 0.0;
      g_bestN = 0.0;
      consider(p, nEst);
      consider(p, nEst + 1.0);  consider(p, nEst - 1.0);
      consider(p, nEst + 2.0);  consider(p, nEst - 2.0);
      consider(p, nEst + 3.0);  consider(p, nEst - 3.0);
      consider(p, nEst + 5.0);  consider(p, nEst - 5.0);
      consider(p, nEst + 8.0);  consider(p, nEst - 8.0);
      consider(p, nEst + 13.0); consider(p, nEst - 13.0);
      consider(p, nEst + 21.0); consider(p, nEst - 21.0);
      consider(p, nEst + 34.0); consider(p, nEst - 34.0);
      consider(p, nEst + 55.0); consider(p, nEst - 55.0);
      float best = g_best;
      float bestR = g_bestR;
      float bestN = g_bestN;

      vec3 col = ink;

      // Faint gloom so the head sits in space.
      col += moss * 0.10 * exp(-rr * 1.2);

      // Seed size: ring pulse traveling outward, cursor swell on top.
      float pulse = sin(uTime * 0.5 - bestR * 5.2);
      float md = length(p - uMouse);
      float swell = 1.0 + 0.30 * exp(-md * 2.2) * uMouseStrength;
      float rd = c * 0.46 * (0.82 + 0.20 * pulse) * swell;

      float aa = 3.0 / min(uRes.x, uRes.y);
      float seed = 1.0 - smoothstep(rd - aa, rd + aa, best);

      // Tone runs dark at the heart to pale at the edge.
      vec3 tone = mix(moss, bone, smoothstep(0.05, 1.15, bestR));
      tone *= 0.94 + 0.10 * hash(vec2(bestN, 1.0));

      // The traveling pulse front carries the accent.
      float front = smoothstep(0.84, 1.0, pulse);
      tone = mix(tone, lime, front * 0.70 * uEnergy);

      float fade = smoothstep(1.95, 0.45, rr);
      col = mix(col, tone, seed * fade * (0.70 + 0.30 * uEnergy));

      // The very heart stays a quiet solid.
      col = mix(col, moss * 0.8, (1.0 - smoothstep(0.05, 0.10, rr)) * 0.8);

      // Scroll stirs a faint shimmer across the head.
      col += bone * 0.02 * vel * exp(-rr * 1.5);

      float vig = smoothstep(1.8, 0.45, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.028;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
