import type { ShaderVariant } from "./types";

/**
 * Stairwell: looking up a square light well, floor slabs spiraling
 * toward a skylight. The cursor peers; slabs drift slowly upward.
 */

export const stairwell: ShaderVariant = {
  id: "stairwell",
  name: "Stairwell",
  family: "Architecture",
  blurb: "Looking up the light well, slabs spiraling toward a skylight.",
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

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * 0.05 + vel * 0.01;

      // Peer into the well with the cursor.
      p -= uMouse * 0.18;

      vec3 ink   = vec3(0.043, 0.043, 0.051);
      vec3 plast = vec3(0.84, 0.84, 0.80);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      // Square metric; the whole well rotates almost imperceptibly,
      // a touch more with depth. Edges stay straight.
      vec2 q = rot(t * 0.1 + max(abs(p.x), abs(p.y)) * 0.22) * p;
      vec2 a2 = abs(q);
      float m = max(a2.x, a2.y) + 0.05;

      // Skylight at the core.
      float core = exp(-m * 2.2);

      // Floor slabs: nested square rings drifting toward the viewer.
      float k = 3.6;
      float r = fract(-m * k + t * 0.4);
      float aa = k * 2.5 / min(uRes.x, uRes.y) + 0.010;
      float slab = smoothstep(0.0, aa + 0.04, r) * (1.0 - smoothstep(0.55, 0.55 + aa + 0.08, r));

      // Soffit shading: each slab darker on its underside.
      float soffit = mix(0.30, 1.0, smoothstep(0.0, 0.55, r));

      float depthLight = exp(-m * 1.3);
      vec3 col = ink;
      col += plast * slab * soffit * depthLight * 0.5;
      col += plast * core * core * 0.7;

      // Handrail: one thin accent line riding each slab edge.
      float rail = smoothstep(0.56, 0.575, r) * (1.0 - smoothstep(0.585, 0.60, r));
      col += lime * rail * depthLight * 0.45 * uEnergy;

      // Skylight flare answers cursor movement.
      col += lime * 0.08 * uMouseStrength * core;

      // Concrete mottle.
      col *= 0.93 + 0.07 * vnoise(q * 7.0 + t);

      col = mix(col * 0.58, col, 0.45 + 0.55 * uEnergy);

      float vig = smoothstep(1.6, 0.3, length(p * vec2(0.9, 1.0)));
      col *= mix(0.5, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
