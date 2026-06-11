import type { ShaderVariant } from "./types";

/**
 * Twill: woven herringbone cloth at macro scale. Columns of diagonal
 * threads alternate direction; each thread is shaded as a tiny
 * cylinder and catches a sheen that travels with the light. One lime
 * running stitch crosses the weave. The cursor carries a soft lamp
 * over the cloth; energy turns the sheen up.
 */

export const twill: ShaderVariant = {
  id: "twill",
  name: "Twill",
  family: "Textile",
  blurb: "Herringbone weave, thread by thread, one lime stitch.",
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

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);

      vec3 charcoal = vec3(0.118, 0.118, 0.129);
      vec3 slate    = vec3(0.22, 0.22, 0.235);
      vec3 paper    = vec3(0.85, 0.85, 0.83);
      vec3 lime     = vec3(0.784, 0.961, 0.259);

      // Herringbone: columns of diagonals, direction alternating.
      float cols = 9.0;
      float colIdx = floor(p.x * cols * 0.5 + 100.0);
      float dir = mod(colIdx, 2.0) * 2.0 - 1.0;

      // Thread coordinate along the diagonal of this column.
      float density = 26.0;
      float v = (p.y + dir * p.x) * density;
      float threadIdx = floor(v);
      float ft = fract(v);

      // Cylindrical thread profile.
      float profile = sin(ft * 3.14159);
      float aa = density * 2.0 / min(uRes.x, uRes.y);
      float gap = smoothstep(0.0, aa + 0.06, ft) * (1.0 - smoothstep(0.94 - aa, 1.0, ft));

      // The light: a slow lamp arc, leaned by the cursor, swayed by scroll.
      float lightPhase = uTime * 0.12 + uMouse.x * 1.2 + vel * 0.05;

      // Sheen travels thread to thread.
      float sheen = 0.5 + 0.5 * sin(threadIdx * 0.55 + lightPhase + dir * 0.8);
      sheen = pow(sheen, 2.2) * (0.45 + 0.55 * uEnergy);

      // The cursor lamp brightens the cloth locally.
      float md = length(p - uMouse);
      float lamp = exp(-md * 2.1) * (0.25 + 0.75 * uMouseStrength);

      vec3 cloth = mix(charcoal, slate, profile * profile);
      cloth += paper * profile * sheen * 0.34;
      cloth += paper * profile * lamp * 0.22;

      // Fiber: fine noise running with the thread.
      float fiber = vnoise(vec2(v * 2.4, p.x * 90.0));
      cloth *= 0.92 + 0.12 * fiber;

      // Fold shadow where the column direction flips.
      float fc = fract(p.x * cols * 0.5 + 100.0);
      float fold = smoothstep(0.0, 0.06, fc) * (1.0 - smoothstep(0.94, 1.0, fc));
      cloth *= mix(0.62, 1.0, fold);

      cloth *= gap;

      // The running stitch: lime dashes crossing the weave.
      float stitchY = abs(p.y - 0.18);
      float dash = step(0.5, fract(p.x * 5.5 + 0.25));
      float stitch = (1.0 - smoothstep(0.008, 0.016, stitchY)) * dash;
      float slub = 0.85 + 0.3 * vnoise(vec2(p.x * 40.0, 3.0));
      cloth = mix(cloth, lime * slub, stitch * 0.9);
      // Each dash dimples the cloth beneath it.
      cloth *= 1.0 - (1.0 - smoothstep(0.016, 0.05, stitchY)) * 0.18 * (1.0 - stitch);

      float vig = smoothstep(1.8, 0.45, length(p * vec2(0.85, 1.0)));
      cloth *= mix(0.6, 1.0, vig);
      cloth += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.025;

      gl_FragColor = vec4(cloth, 1.0);
    }
  `,
};
