import type { ShaderVariant } from "./types";

/**
 * Cyanotype: a sheet from the drawing office. Prussian blue ground,
 * white construction lines: a main circle on its centerlines, a
 * tangent arc being swung, hatching where the section is cut, and a
 * compass point that follows the cursor with its construction circle.
 * The drawing is mid-thought; that is its charm.
 */

export const cyanotype: ShaderVariant = {
  id: "cyanotype",
  name: "Cyanotype",
  family: "Drafting",
  blurb: "White construction lines swimming in Prussian blue.",
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

    float lineS(float d, float w, float aa) {
      return 1.0 - smoothstep(w - aa, w + aa, abs(d));
    }

    // Dashes along a coordinate.
    float dashed(float along, float duty) {
      return step(duty, fract(along));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.5;
      float aa = 2.2 / min(uRes.x, uRes.y);
      float bright = 0.55 + 0.45 * uEnergy;

      // The print: uneven exposure, brushed edges.
      float exposure = 0.9 + 0.18 * vnoise(p * 2.0) + 0.06 * vnoise(p * 9.0);
      vec3 prussian = vec3(0.075, 0.18, 0.42) * exposure;
      vec3 white = vec3(0.93, 0.96, 1.0);
      vec3 col = prussian;

      float ink = 0.0;
      float faint = 0.0;

      // Graph grid, barely fixed into the print.
      vec2 g = fract(p * 6.0);
      faint += (lineS(g.x - 0.5, 0.003, aa * 3.0) + lineS(g.y - 0.5, 0.003, aa * 3.0)) * 0.12;

      // The main circle on its centerlines.
      vec2 C = vec2(-0.30, 0.05);
      float r = length(p - C);
      ink += lineS(r - 0.46, 0.004, aa);
      ink += lineS(r - 0.30, 0.0035, aa) * 0.8;
      // Centerlines: long dash, short gap, crossing the sheet.
      ink += lineS(p.y - C.y, 0.0028, aa) * dashed((p.x - C.x) * 6.0, 0.25) * 0.85;
      ink += lineS(p.x - C.x, 0.0028, aa) * dashed((p.y - C.y) * 6.0, 0.25) * 0.85;

      // Hatching: the cut section of an L-shaped plate, lower right.
      vec2 q = p - vec2(0.62, -0.38);
      float plate = step(abs(q.x), 0.42) * step(abs(q.y), 0.30)
                  * (1.0 - step(abs(q.x - 0.20), 0.22) * step(abs(q.y - 0.16), 0.16));
      float hatch = lineS(fract((q.x + q.y) * 14.0) - 0.5, 0.06, aa * 8.0);
      ink += plate * hatch * 0.5;
      // The plate's own outline.
      vec2 b1 = abs(q) - vec2(0.42, 0.30);
      ink += lineS(max(b1.x, b1.y), 0.004, aa) * step(max(b1.x, b1.y), 0.01);

      // A tangent arc being swung from the circle, mid-construction.
      float sweep = 1.9 + 0.5 * sin(t * 0.3);
      float aAng = atan(p.y - C.y, p.x - C.x);
      float arc = lineS(r - 0.72, 0.003, aa) * step(0.2, aAng) * step(aAng, sweep);
      ink += arc * 0.9;

      // The compass at the cursor: point, and its construction circle.
      vec2 M = uMouse;
      float mr = length(p - M);
      float compass = lineS(mr - 0.18, 0.0028, aa) * (0.4 + 0.6 * uMouseStrength);
      compass += (1.0 - smoothstep(0.004, 0.010, mr));
      ink += compass * 0.8;

      // Small tick marks where the arc meets the verticals.
      ink += lineS(p.x - 0.42, 0.0028, aa) * step(abs(p.y - 0.6), 0.05) * 0.7;

      // Press the lines into the print.
      col = mix(col, white, clamp(faint, 0.0, 1.0) * bright * 0.5);
      col = mix(col, white, clamp(ink, 0.0, 1.0) * bright);

      // Brushed-on edges of the emulsion.
      vec2 bb = abs(p) - vec2(1.5, 0.92);
      float edge = smoothstep(-0.05, 0.03, max(bb.x, bb.y) + 0.04 * vnoise(p * 8.0));
      col = mix(col, vec3(0.90, 0.91, 0.88), edge);

      // Scroll drifts the sheet light.
      col *= 1.0 + 0.01 * clamp(uScrollVel, -4.0, 4.0);

      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.02;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
