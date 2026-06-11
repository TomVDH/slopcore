import type { ShaderVariant } from "./types";

/**
 * Clay: a stop-motion table. Four plasticine forms sit on a paper
 * sweep under one soft studio light, breathing in little squishes as
 * if a thumb just left them. Matte all the way down, contact shadows
 * holding them to the floor. The cursor pokes the nearest form.
 */

export const clay: ShaderVariant = {
  id: "clay",
  name: "Clay",
  family: "Claymation",
  blurb: "Plasticine forms squishing under studio light.",
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

    // A squished ball of clay.
    float blob(vec2 p, vec2 c, float r, vec2 squish) {
      vec2 q = (p - c) / squish;
      return length(q) - r;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * (0.5 + 0.25 * uEnergy);
      float aa = 3.0 / min(uRes.x, uRes.y);

      // The studio sweep: light falls from above, floor curls forward.
      vec3 sweep = mix(vec3(0.90, 0.88, 0.84), vec3(0.80, 0.77, 0.72),
                       smoothstep(0.6, -0.9, p.y));
      vec3 col = sweep;

      vec2 L = normalize(vec2(-0.45, 0.9));

      // Four forms on the table.
      for (int i = 0; i < 4; i++) {
        float fi = float(i);

        vec2 c;
        float r;
        vec3 tint;
        if (i == 0) { c = vec2(-0.72, -0.28); r = 0.30; tint = vec3(0.93, 0.52, 0.42); }
        else if (i == 1) { c = vec2(-0.10, -0.40); r = 0.22; tint = vec3(0.56, 0.80, 0.66); }
        else if (i == 2) { c = vec2(0.46, -0.26); r = 0.34; tint = vec3(0.95, 0.83, 0.45); }
        else { c = vec2(1.02, -0.44); r = 0.18; tint = vec3(0.60, 0.71, 0.88); }

        // The squish: each form breathes; the cursor pokes the nearest.
        float phase = t * (0.8 + fi * 0.23) + fi * 2.0;
        float poke = exp(-length(c - uMouse) * 2.2) * uMouseStrength;
        vec2 squish = vec2(1.0 + 0.07 * sin(phase) + 0.12 * poke,
                           1.0 - 0.07 * sin(phase) - 0.10 * poke);

        // Contact shadow first.
        vec2 sc = c + vec2(0.02, -r * squish.y * 0.92);
        vec2 sq = (p - sc) / vec2(r * squish.x * 1.25, r * 0.22);
        float shadow = exp(-dot(sq, sq) * 1.4);
        col *= 1.0 - shadow * 0.32;

        float d = blob(p, c, r, squish);
        if (d < aa) {
          // Matte clay shading: numeric normal, broad diffuse.
          float e = 0.012;
          float dx = blob(p + vec2(e, 0.0), c, r, squish) - d;
          float dy = blob(p + vec2(0.0, e), c, r, squish) - d;
          vec3 n = normalize(vec3(dx, dy, e * 1.6));

          float diff = clamp(dot(n.xy, L) * 0.5 + 0.62, 0.0, 1.0);

          // Thumb marks: broad soft ridges in the surface.
          float thumb = vnoise((p - c) * 9.0 + fi * 13.0);
          diff *= 0.94 + 0.08 * thumb;

          vec3 clayCol = tint * diff;
          // A soft warm bounce where the form meets the table.
          clayCol += vec3(0.10, 0.06, 0.03) * smoothstep(0.0, -r, p.y - c.y);

          float m = 1.0 - smoothstep(-aa, aa, d);
          col = mix(col, clayCol, m);
        }
      }

      // The table edge, far back.
      col *= 1.0 - 0.10 * smoothstep(0.55, 0.8, p.y);

      // Scroll rolls the table, barely.
      col *= 1.0 + 0.008 * clamp(uScrollVel, -4.0, 4.0);

      // Camera grain of a patient stop-motion rig.
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.016;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
