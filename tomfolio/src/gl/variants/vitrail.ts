import type { ShaderVariant } from "./types";

/**
 * Vitrail: leaded glass in deep tones, light breathing through pane by
 * pane. Roughly one pane in twelve is lime. The cursor backlights
 * whichever pane it rests on.
 */

export const vitrail: ShaderVariant = {
  id: "vitrail",
  name: "Vitrail",
  family: "Glass",
  blurb: "Leaded glass panes, light breathing through one by one.",
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

    vec2 hash2(vec2 p) {
      return vec2(hash(p), hash(p + 7.77));
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

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * 0.05;

      vec3 ink  = vec3(0.043, 0.043, 0.051);
      vec3 bone = vec3(0.70, 0.69, 0.64);
      vec3 moss = vec3(0.16, 0.23, 0.16);
      vec3 sea  = vec3(0.12, 0.18, 0.20);
      vec3 lime = vec3(0.784, 0.961, 0.259);

      // Voronoi panes, barely drifting.
      vec2 q = p * 1.9 + vec2(t * 0.05, 0.0);
      vec2 cell = floor(q);
      vec2 fr = fract(q);

      float f1 = 8.0;
      float f2 = 8.0;
      vec2 bestId = vec2(0.0);
      vec2 bestPos = vec2(0.0);

      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash2(cell + g);
          o = 0.5 + 0.38 * sin(t * 0.3 + 6.2831 * o);
          vec2 rel = g + o - fr;
          float d = length(rel);
          if (d < f1) {
            f2 = f1;
            f1 = d;
            bestId = cell + g;
            bestPos = rel;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }

      float h = hash(bestId);

      // Glass tone per pane: mostly muted moss and sea, the odd bone pane,
      // and roughly one in twelve in lime.
      vec3 glass = mix(moss * 0.8, sea * 0.8, step(0.5, h));
      glass = mix(glass, bone * 0.45, step(0.78, h));
      float isLime = step(0.92, h);
      glass = mix(glass, lime * 0.65, isLime);

      // Night chapel: most panes sleep; a third or so catch light at a
      // time, each on its own clock.
      float wave = sin(uTime * 0.16 + h * 6.2831 + p.y * 0.9);
      float gate = smoothstep(0.25, 0.90, wave);
      float lum = 0.16 + 1.10 * gate * gate;

      // Streaky hand-blown texture, seeded per pane.
      float streak = 0.80 + 0.34 * fbm(p * 6.5 + bestId * 13.0);

      // The cursor backlights its pane.
      float md = length(p - uMouse);
      lum += 0.65 * uMouseStrength * exp(-md * 2.8);

      vec3 col = ink + glass * lum * streak * (0.55 + 0.45 * uEnergy);

      // Lead came between panes.
      float edge = f2 - f1;
      float aa = 2.5 / min(uRes.x, uRes.y) * 2.5;
      float lead = 1.0 - smoothstep(0.022, 0.022 + 0.042 + aa, edge);
      col = mix(col, ink * 0.70, lead * 0.95);

      // A soft gleam runs along the lead beside lit panes.
      float gleam = (1.0 - smoothstep(0.042, 0.13, edge)) * gate;
      col += bone * gleam * 0.05;

      float vig = smoothstep(1.7, 0.4, length(p * vec2(0.85, 1.0)));
      col *= mix(0.58, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
