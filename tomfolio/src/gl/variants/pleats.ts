import type { ShaderVariant } from "./types";

/**
 * Pleats: a paper fan folded from the upper-right corner, hard creases
 * catching slow light. One crease carries a lime thread. The cursor
 * opens and closes the fan a little.
 */

export const pleats: ShaderVariant = {
  id: "pleats",
  name: "Pleats",
  family: "Print & craft",
  blurb: "A folded paper fan with one lime thread.",
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

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

      vec3 ink   = vec3(0.043, 0.043, 0.051);
      vec3 paper = vec3(0.82, 0.81, 0.77);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      // Fan origin well outside the upper right, so the frame shows broad
      // fold faces rather than the convergence point.
      vec2 o = vec2(1.45, 1.20);
      vec2 q = p - o;
      float r = length(q);
      float ang = atan(-q.y, -q.x);

      // Fold density: the cursor opens the fan, scroll shimmers the light.
      float k = 10.0 + uMouse.x * 1.5;
      float lightPhase = uTime * 0.05 + clamp(uScrollVel, -4.0, 4.0) * 0.02;
      float f = ang * k + 0.35 * sin(lightPhase);
      float idx = floor(f);
      float ramp = fract(f);

      // Angular antialias width grows as folds converge near the origin.
      float aa = k * 2.5 / (min(uRes.x, uRes.y) * max(r, 0.06));

      // Sawtooth shading: each pleat lit across its face, hard crease at the wrap.
      float lit = mix(0.06, 0.58, ramp);
      lit *= 0.94 + 0.12 * sin(idx * 7.7);

      // Light pours from the origin and falls off along the fan.
      float fall = smoothstep(3.1, 0.30, r);
      float sheet = lit * fall * (0.82 + 0.18 * sin(lightPhase + idx * 0.7));

      vec3 col = ink + paper * sheet * (0.55 + 0.45 * uEnergy);

      // Paper tooth, finer along the fold direction.
      col *= 0.93 + 0.08 * fbm(vec2(ang * 9.0, r * 5.0));

      // Crease hairlines: bright where the fold returns.
      float crease = 1.0 - smoothstep(0.0, aa * 2.0, min(ramp, 1.0 - ramp));
      col += paper * crease * 0.12 * fall;

      // One lime thread glued into a single crease.
      float thread = crease * (1.0 - smoothstep(0.0, 0.75, abs(idx - 8.0)));
      col += lime * thread * 0.85 * uEnergy * fall;

      // The cursor warms the nearest fold.
      float md = length(p - uMouse);
      col += paper * 0.08 * uMouseStrength * exp(-md * 2.5) * fall;

      float vig = smoothstep(1.75, 0.4, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
