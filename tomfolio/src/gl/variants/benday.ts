import type { ShaderVariant } from "./types";

/**
 * Benday: one comic panel. Cyan dot-screen sky over a flat yellow
 * field, a red starburst inked in black, speed lines from the corner.
 * Printed, not painted: every color is a screen or a fill. The burst
 * throbs toward the cursor; energy scales the dots.
 */

export const benday: ShaderVariant = {
  id: "benday",
  name: "Benday",
  family: "Pop art",
  blurb: "A comic panel: dot screens, flat fills, one red burst.",
  frag: /* glsl */ `
    precision highp float;

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uMouse;
    uniform float uMouseStrength;
    uniform float uEnergy;
    uniform float uScrollVel;

    const float TAU = 6.28318530;

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

    // A star: radius walks between inner and outer with a triangle wave.
    float starDist(vec2 rel, float rIn, float rOut, float points, float phase) {
      float a = atan(rel.y, rel.x) + phase;
      float tri = abs(fract(a * points / TAU) * 2.0 - 1.0);
      float rad = mix(rOut, rIn, tri);
      return length(rel) - rad;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.5;
      float aa = 2.5 / min(uRes.x, uRes.y);

      vec3 paper  = vec3(0.96, 0.95, 0.91);
      vec3 inkB   = vec3(0.07, 0.07, 0.08);
      vec3 yellow = vec3(0.99, 0.83, 0.10);
      vec3 red    = vec3(0.89, 0.13, 0.13);
      vec3 cyan   = vec3(0.22, 0.62, 0.86);

      // Two zones split by a bold diagonal.
      float zone = step(0.0, dot(p, vec2(0.55, 1.0)) - 0.05);

      // Sky: cyan dot screen on paper, 45 degree grid.
      float dotScale = 26.0;
      vec2 g = rot(0.785) * p * dotScale;
      float dotR = (0.26 + 0.10 * uEnergy);
      float screen = 1.0 - smoothstep(dotR - aa * dotScale, dotR + aa * dotScale,
                                      length(fract(g) - 0.5));
      vec3 sky = mix(paper, cyan, screen);

      // Field: flat yellow with a coarser red screen creeping in low.
      vec2 g2 = rot(0.262) * p * 16.0;
      float screen2 = 1.0 - smoothstep(0.30, 0.34, length(fract(g2) - 0.5));
      screen2 *= smoothstep(0.1, -0.7, p.y);
      vec3 field = mix(yellow, red, screen2 * 0.85);

      vec3 col = mix(field, sky, zone);

      // Speed lines from the top-left corner.
      vec2 corner = vec2(-1.7, 1.2);
      vec2 cd = p - corner;
      float ca = atan(cd.y, cd.x);
      float ray = step(0.92, fract(ca * 14.0)) * step(length(cd), 2.0) * zone;
      col = mix(col, inkB, ray * 0.85);

      // The burst: red star inked in black, white core, throbbing.
      vec2 bc = vec2(0.45, -0.18) + uMouse * 0.10;
      float throb = 1.0 + 0.06 * sin(uTime * 3.0) + 0.20 * uMouseStrength;
      float spin = t * 0.1 + clamp(uScrollVel, -4.0, 4.0) * 0.02;

      float dOuter = starDist((p - bc) / throb, 0.20, 0.46, 11.0, spin);
      float dInner = starDist((p - bc) / throb, 0.10, 0.24, 11.0, spin + 0.28);

      // Black ink first, then red fill, then the white core.
      col = mix(col, inkB, 1.0 - smoothstep(0.022 - aa, 0.022 + aa, dOuter));
      col = mix(col, red, 1.0 - smoothstep(-aa, aa, dOuter));
      col = mix(col, inkB, 1.0 - smoothstep(0.018 - aa, 0.018 + aa, dInner));
      col = mix(col, paper, 1.0 - smoothstep(-aa, aa, dInner));

      // The panel border.
      vec2 b = abs(p) - vec2(1.52, 0.93);
      float border = 1.0 - smoothstep(0.0, aa * 2.0, abs(max(b.x, b.y)) - 0.012);
      float outside = step(0.012, max(b.x, b.y));
      col = mix(col, inkB, border);
      col = mix(col, paper * 0.97, outside);

      // Print misregistration: the faintest paper tone wobble.
      col *= 0.97 + 0.04 * hash(floor(p * 200.0));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
