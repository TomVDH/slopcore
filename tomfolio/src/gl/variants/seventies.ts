import type { ShaderVariant } from "./types";

/**
 * Seventies: the supergraphic. Two families of concentric arcs sweep
 * in from opposite corners in burnt orange, harvest gold, avocado and
 * cream, interleaving where they meet like an airport corridor wall
 * from 1974. Matte, warm, certain of itself. The cursor breathes the
 * nearest bands; energy speeds the crawl.
 */

export const seventies: ShaderVariant = {
  id: "seventies",
  name: "Seventies",
  family: "Supergraphic",
  blurb: "Concentric corner arcs, burnt orange and harvest gold.",
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

    vec3 band(float idx) {
      float m = mod(idx, 5.0);
      if (m < 1.0) return vec3(0.80, 0.33, 0.12);   // burnt orange
      if (m < 2.0) return vec3(0.93, 0.69, 0.20);   // harvest gold
      if (m < 3.0) return vec3(0.94, 0.88, 0.74);   // cream
      if (m < 4.0) return vec3(0.45, 0.47, 0.18);   // avocado
      return vec3(0.36, 0.20, 0.12);                // chocolate
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * (0.5 + 0.3 * uEnergy) * 0.12 + vel * 0.01;
      float aa = 2.5 / min(uRes.x, uRes.y);

      // Two arc families from opposite corners.
      vec2 c1 = vec2(-1.7, -1.15);
      vec2 c2 = vec2(1.75, 1.2);

      float freq = 3.4;
      float breathe1 = 1.0 + 0.05 * uMouseStrength * exp(-length(p - uMouse) * 1.8);

      float r1 = length(p - c1) * freq * breathe1 - t;
      float r2 = length(p - c2) * freq + t * 0.8;

      float i1 = floor(r1);
      float i2 = floor(r2);

      // The families interleave along a soft diagonal frontier.
      float frontier = dot(p, normalize(vec2(1.0, 0.85)));
      float wobble = 0.18 * sin(p.x * 1.7 + t * 2.0) * 0.5;
      float pick = step(frontier + wobble, 0.05);

      float idx = mix(i2, i1, pick);
      float fr = mix(fract(r2), fract(r1), pick);

      vec3 col = band(idx);

      // A thin cream pinstripe rides each band seam.
      float pin = 1.0 - smoothstep(0.0, aa * freq * 2.0 + 0.012, fr);
      col = mix(col, vec3(0.96, 0.92, 0.82), pin * 0.8);

      // Band shading: each arc rolls slightly, like painted plaster.
      col *= 0.94 + 0.08 * sin(fr * 3.14159);

      // Matte paper grain, no gloss anywhere.
      col *= 0.96 + 0.05 * hash(floor(p * 220.0));
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.018;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
