import type { ShaderVariant } from "./types";

/**
 * Liquid Light: the oil-and-dye projector from a 1967 ballroom.
 * Immiscible blobs of hot color fold into each other inside the round
 * throw of the lens, edges fringing where the dyes refuse to mix.
 * The cursor is a finger on the slide: it smears. Energy is heat.
 */

export const liquidlight: ShaderVariant = {
  id: "liquidlight",
  name: "Liquid Light",
  family: "Psychedelia",
  blurb: "An oil-dye projector throw, hot colors refusing to mix.",
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
        p *= 2.1;
        amp *= 0.5;
      }
      return v;
    }

    // The dye wheel: hot, saturated, never shy.
    vec3 dye(float v) {
      vec3 a = vec3(0.62, 0.20, 0.55);
      vec3 b = vec3(0.45, 0.35, 0.30);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.00, 0.22, 0.52);
      return a + b * cos(6.28318 * (c * v + d));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * (0.5 + 0.35 * uEnergy) * 0.14 + vel * 0.01;

      // The room beyond the throw.
      vec3 room = vec3(0.06, 0.035, 0.05);
      vec3 col = room;

      float lens = length(p * vec2(0.92, 1.0));
      float inside = 1.0 - smoothstep(0.93, 0.97, lens);

      if (inside > 0.0) {
        // The finger on the slide.
        float md = length(p - uMouse);
        vec2 smear = (p - uMouse) * exp(-md * 2.2) * 0.5 * uMouseStrength;

        // Big immiscible folds: low frequency, heavy warp.
        vec2 q = p * 1.1 + smear;
        vec2 w1 = vec2(fbm(q * 1.3 + vec2(t * 0.9, -t * 0.6)),
                       fbm(q * 1.3 + vec2(4.7, 2.3) + t * 0.7));
        vec2 w2 = vec2(fbm(q + 3.2 * w1 + vec2(8.1, 1.9) - t * 0.4),
                       fbm(q + 3.2 * w1 + vec2(2.4, 7.7)));
        float v = fbm(q + 3.6 * w2);

        // Posterize gently: dyes pool, they don't gradient.
        float pooled = floor(v * 6.0 + 0.5) / 6.0;
        vec3 oil = dye(pooled * 1.7 + t * 0.25);

        // Fringe where two pools meet: a hot bright seam.
        float seam = abs(v - pooled) * 6.0;
        oil += vec3(1.0, 0.9, 0.6) * pow(1.0 - seam, 12.0) * 0.18;

        // The lamp hotspot breathes in the middle of the throw.
        oil *= 0.75 + 0.45 * exp(-lens * lens * 1.4) * (0.8 + 0.2 * sin(uTime * 0.6));

        col = mix(room, oil, inside);
      }

      // The lens rim glows faintly with spilled light.
      float rim = exp(-abs(lens - 0.95) * 30.0);
      col += vec3(0.45, 0.25, 0.40) * rim * 0.35;

      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
