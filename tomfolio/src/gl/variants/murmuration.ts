import type { ShaderVariant } from "./types";

/**
 * Murmuration: starlings at dusk. The flock is a density field that
 * breathes and folds as it crosses the sky, stippled into hundreds of
 * wing-beating points; a thin band of late light holds the horizon.
 * The cursor is a hawk: the flock parts around it and reforms behind.
 */

export const murmuration: ShaderVariant = {
  id: "murmuration",
  name: "Murmuration",
  family: "Creature",
  blurb: "A starling flock folding over the last of the light.",
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
        p *= 2.07;
        amp *= 0.5;
      }
      return v;
    }

    // The flock as a density field around its wandering heart.
    float density(vec2 p, vec2 heart, float t, float cohesion) {
      vec2 q = p - heart;
      // The body stretches along its direction of travel.
      q.x *= 0.62;
      float envelope = exp(-dot(q, q) * (1.1 + 1.5 * cohesion));
      float fold = fbm(q * 2.2 + vec2(t * 0.5, t * 0.22));
      return envelope * smoothstep(0.20, 0.62, fold) * 1.4;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * (0.5 + 0.2 * uEnergy) + vel * 0.02;

      vec3 nightTop = vec3(0.035, 0.035, 0.051);
      vec3 duskMid  = vec3(0.16, 0.155, 0.17);
      vec3 lime     = vec3(0.784, 0.961, 0.259);
      vec3 bird     = vec3(0.02, 0.02, 0.028);

      // Dusk: dark above, a held breath of grey, lime light dying low.
      float h = smoothstep(-1.0, 0.9, p.y);
      vec3 col = mix(duskMid, nightTop, h);
      float horizon = exp(-pow((p.y + 0.66) * 2.2, 2.0));
      col += mix(lime, vec3(0.75, 0.75, 0.6), 0.35) * horizon * 0.30;

      // A far ridge line under the light.
      float ridge = smoothstep(0.0, 0.012, p.y + 0.78 + 0.05 * fbm(vec2(p.x * 1.4, 3.0)));
      col *= mix(0.35, 1.0, ridge);

      // The flock's heart wanders low, against the last light.
      vec2 heart = vec2(0.32 * sin(t * 0.23) + 0.10, 0.20 * sin(t * 0.31 + 1.7) - 0.10);

      float cohesion = 0.4 + 0.6 * uEnergy;
      float D = density(p, heart, t, cohesion);

      // The hawk: density flees the cursor.
      float md = length(p - uMouse);
      D *= 1.0 - exp(-md * md * 9.0) * clamp(uMouseStrength * 1.5, 0.0, 1.0);

      // Stipple the field into birds, each on its own wingbeat.
      vec2 g = p * 52.0;
      vec2 cell = floor(g);
      vec2 f = fract(g) - 0.5;
      float rnd = hash(cell);
      vec2 jitter = (vec2(hash(cell + 1.1), hash(cell + 2.2)) - 0.5) * 0.7;
      float cellD = density((cell + 0.5) / 52.0, heart, t, cohesion);
      cellD *= 1.0 - exp(-pow(length((cell + 0.5) / 52.0 - uMouse), 2.0) * 9.0)
             * clamp(uMouseStrength * 1.5, 0.0, 1.0);

      float present = step(rnd, cellD * 1.9);
      float beat = 0.75 + 0.45 * sin(uTime * 5.0 + rnd * 40.0);
      float size = (0.09 + 0.24 * cellD) * beat;
      float dot_ = (1.0 - smoothstep(size * 0.6, size + 0.06, length(f - jitter))) * present;

      // A few stragglers trailing wide of the body.
      float straggler = step(0.9965, rnd) * step(0.02, D + 0.02) * 0.8;
      dot_ = max(dot_, straggler * (1.0 - smoothstep(0.05, 0.12, length(f - jitter))));

      col = mix(col, bird, clamp(dot_, 0.0, 1.0) * 0.92);

      // The flock dims the sky behind it, the way a turning mass does.
      col *= 1.0 - D * 0.30;

      float vig = smoothstep(2.0, 0.5, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.02;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
