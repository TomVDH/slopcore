import type { ShaderVariant } from "./types";

/**
 * Caustics: refracted light webbing across a dark pool floor, two
 * scales of cells slipping over each other. The cursor drops a ripple
 * that bends the web around it.
 */

export const caustics: ShaderVariant = {
  id: "caustics",
  name: "Caustics",
  family: "Light & nature",
  blurb: "Pool light webbing across a dark floor.",
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

    // Caustic web: bright filaments along voronoi cell borders, with a
    // little extra shine where the cells pinch tight.
    float web(vec2 q, float t) {
      vec2 i = floor(q);
      vec2 f = fract(q);
      float f1 = 8.0;
      float f2 = 8.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash2(i + g);
          o = 0.5 + 0.45 * sin(t + 6.2831 * o);
          float d = length(g + o - f);
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }
      float border = 1.0 - smoothstep(0.0, 0.22, f2 - f1);
      return pow(border, 3.0) * (0.40 + 0.60 * pow(clamp(1.0 - f1, 0.0, 1.0), 2.0));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * (0.4 + 0.05 * vel);

      vec3 ink  = vec3(0.043, 0.043, 0.051);
      vec3 deep = vec3(0.045, 0.085, 0.085);
      vec3 bone = vec3(0.80, 0.80, 0.76);
      vec3 lime = vec3(0.784, 0.961, 0.259);

      // Pool floor: darker with depth.
      vec3 col = mix(deep, ink, smoothstep(0.9, -1.0, p.y));

      // The cursor drops a ripple; the web refracts around it.
      vec2 q = p;
      float md = length(p - uMouse);
      vec2 dir = (p - uMouse) / max(md, 1e-3);
      q += dir * sin(md * 20.0 - uTime * 2.2) * exp(-md * 2.4) * 0.045 * uMouseStrength;

      // Two scales of light web slipping over each other.
      float w1 = web(q * 2.9 + vec2(t * 0.10, t * 0.04), t * 1.35);
      float w2 = web(q * 5.3 - vec2(t * 0.06, t * 0.09), t * 1.05 + 3.0);
      float light = w1 + 0.55 * w2;

      // A whisper of dispersion on the bright web.
      float wShift = web((q + vec2(0.012, 0.0)) * 2.9 + vec2(t * 0.10, t * 0.04), t * 1.35);

      float depth = 0.55 + 0.45 * smoothstep(-1.0, 0.7, p.y);
      col += mix(bone, lime, 0.30) * light * depth * (0.26 + 0.42 * uEnergy);
      col += lime * max(wShift - w1, 0.0) * 0.35 * uEnergy;

      // Faint slanted light shafts reaching the floor.
      float shaft = pow(max(sin(dot(p, vec2(0.35, 1.0)) * 2.6 + t * 0.3), 0.0), 3.0);
      col += bone * shaft * 0.035 * (0.5 + 0.5 * uEnergy);

      float vig = smoothstep(1.7, 0.4, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
