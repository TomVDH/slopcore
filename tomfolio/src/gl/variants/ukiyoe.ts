import type { ShaderVariant } from "./types";

/**
 * Ukiyo-e: a woodblock sea. Flat planes of indigo stacked into swells,
 * each crest breaking into clawed foam, a bone sky, a red sun, and a
 * far peak keeping still. Every color is one block, one impression;
 * the registration sits a hair off, as good prints do. The cursor
 * lifts the nearest swell; energy is the wind.
 */

export const ukiyoe: ShaderVariant = {
  id: "ukiyoe",
  name: "Ukiyo-e",
  family: "Woodblock",
  blurb: "Flat indigo swells, clawed foam, one red sun.",
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

    // One swell line across the sheet.
    float swell(float x, float base, float amp, float freq, float phase, float t) {
      float y = base;
      y += amp * sin(x * freq + phase + t);
      y += amp * 0.45 * sin(x * freq * 2.3 + phase * 1.7 - t * 0.7);
      return y;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float wind = 0.5 + 0.5 * uEnergy;
      float t = uTime * 0.18 * wind + clamp(uScrollVel, -4.0, 4.0) * 0.02;

      vec3 bone    = vec3(0.93, 0.89, 0.80);
      vec3 boneDim = vec3(0.86, 0.82, 0.72);
      vec3 indigo1 = vec3(0.13, 0.22, 0.38);
      vec3 indigo2 = vec3(0.09, 0.15, 0.29);
      vec3 indigo3 = vec3(0.06, 0.10, 0.21);
      vec3 outline = vec3(0.05, 0.08, 0.16);
      vec3 sunRed  = vec3(0.78, 0.22, 0.16);

      // Sky: two flat tones meeting in a clean block edge.
      vec3 col = mix(bone, boneDim, step(0.42, p.y));

      // The sun, one block of red, a hair out of register.
      float sd = length((p - vec2(0.55, 0.46)) * vec2(1.0, 1.05));
      col = mix(col, sunRed * 1.06, 1.0 - smoothstep(0.155, 0.16, sd + 0.006));
      col = mix(col, sunRed, 1.0 - smoothstep(0.15, 0.155, sd));

      // The far peak, snow shoulder, holding still.
      float peak = -0.9 + 1.5 * (1.0 - abs(p.x + 0.55) * 1.4);
      if (p.y < peak && p.y > 0.02) {
        col = mix(col, indigo2, 0.85);
        if (p.y > peak - 0.10) col = mix(col, bone, 0.8);
      }

      float aa = 3.0 / min(uRes.x, uRes.y);

      // Three swells, far to near; the cursor lifts the nearest.
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float base = 0.10 - fi * 0.42;
        float amp = 0.06 + fi * 0.05;
        float lift = (fi == 2.0 ? 1.0 : 0.0) * 0.10 * uMouseStrength
                   * exp(-abs(p.x - uMouse.x) * 1.5);
        float y = swell(p.x, base + lift, amp * wind, 2.4 - fi * 0.4, fi * 2.7, t * (1.0 + fi * 0.3));

        float below = 1.0 - smoothstep(y - aa, y + aa, p.y);
        vec3 water = fi == 0.0 ? indigo1 : (fi == 1.0 ? indigo2 : indigo3);

        // Foam: a clawed scallop band riding the crest.
        float claw = abs(fract(p.x * (7.0 + fi * 2.0) + fi * 0.4 - t * (0.6 + fi * 0.2)) - 0.5);
        float foamY = y - 0.018 - 0.05 * claw * claw * 4.0;
        float foam = (1.0 - smoothstep(foamY - aa, foamY + aa, p.y)) * below;
        foam = below - foam;

        col = mix(col, water, below);
        col = mix(col, bone, foam * 0.95);
        // The block outline along the crest.
        col = mix(col, outline, (1.0 - smoothstep(0.0, aa * 2.5, abs(p.y - y) - 0.003)) * 0.85);
      }

      // Paper laid texture and a clean margin.
      col *= 0.965 + 0.05 * vnoise(p * vec2(140.0, 30.0));
      vec2 b = abs(p) - vec2(1.49, 0.91);
      col = mix(col, vec3(0.95, 0.93, 0.87), smoothstep(0.0, 0.015, max(b.x, b.y)));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
