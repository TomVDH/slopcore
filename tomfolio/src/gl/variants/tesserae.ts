import type { ShaderVariant } from "./types";

/**
 * Tesserae: a mosaic set by hand. Every tile sits at its own slight
 * angle in its own bed of grout, tones stepped like sorted stone, and
 * a long wave rolls through the values the way mosaicists drew water.
 * Crest tiles occasionally run lime. The cursor loosens nearby tiles;
 * they catch the light and settle back.
 */

export const tesserae: ShaderVariant = {
  id: "tesserae",
  name: "Tesserae",
  family: "Mosaic",
  blurb: "Hand-set stone tiles, a wave rolling through the tones.",
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

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.6;
      for (int i = 0; i < 3; i++) {
        v += amp * vnoise(p);
        p *= 2.03;
        amp *= 0.5;
      }
      return v;
    }

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * 0.5;

      vec3 grout = vec3(0.085, 0.082, 0.078);
      vec3 lime  = vec3(0.784, 0.961, 0.259);
      vec2 L = normalize(vec2(-0.6, 0.8));

      float S = 17.0;
      vec2 id = floor(p * S);
      vec2 f = fract(p * S) - 0.5;

      // Each tile sits at its own slight angle; the cursor loosens it.
      float md = length(id / S - uMouse);
      float loose = exp(-md * 2.4) * uMouseStrength;
      float ang = (hash(id) - 0.5) * 0.16 + loose * 0.12 * sin(uTime * 2.0 + hash(id) * 9.0);
      vec2 q = rot(ang) * f;

      // The wave that organizes the tones, rolling very slowly.
      float W = fbm(id / S * vec2(1.3, 2.2) + vec2(t * 0.06, 0.0));
      W = 0.5 + (W - 0.5) * (0.8 + 0.6 * uEnergy) + vel * 0.01;

      // Stepped stone tones, like sorted tesserae trays.
      float tone = clamp(mix(0.14, 0.88, smoothstep(0.22, 0.78, W)), 0.0, 1.0);
      tone = floor(tone * 5.0 + 0.5) / 5.0;
      vec3 stone = vec3(tone * 0.96, tone, tone * 0.93);

      // Crest tiles occasionally run lime.
      if (hash(id + 3.3) > 0.93 && W > 0.62) stone = lime * (0.7 + 0.3 * tone);

      // Per-tile mottle: no two stones cut alike.
      stone *= 0.90 + 0.16 * hash(id + 7.7);
      stone *= 0.94 + 0.10 * vnoise(p * 60.0);

      // Bevel: edges facing the light lift, the others sink.
      float e = 0.40 - max(abs(q.x), abs(q.y));
      float rim = 1.0 - smoothstep(0.0, 0.10, e);
      float facing = dot(normalize(q + 1e-4), L);
      stone *= 1.0 + rim * facing * 0.22;
      stone += vec3(1.0) * loose * 0.10;

      // Grout bed.
      float aa = S * 2.0 / min(uRes.x, uRes.y);
      float tile = 1.0 - smoothstep(0.40 - aa, 0.40 + aa, max(abs(q.x), abs(q.y)));

      vec3 col = mix(grout * (0.9 + 0.2 * hash(id + 1.2)), stone, tile);

      float vig = smoothstep(1.9, 0.45, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.022;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
