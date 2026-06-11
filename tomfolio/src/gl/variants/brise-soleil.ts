import type { ShaderVariant } from "./types";

/**
 * Brise-soleil: angled concrete louvers slicing hard sun into measured
 * bands. The cursor tilts the fins; a faint mullion grid crosses them.
 */

export const briseSoleil: ShaderVariant = {
  id: "brise-soleil",
  name: "Brise-soleil",
  family: "Architecture",
  blurb: "Concrete louvers cutting hard sun into measured slices.",
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
      float t = uTime * 0.05 + vel * 0.012;

      // Fin direction: a steep diagonal the cursor can lean on.
      float ang = -0.62 + uMouse.x * 0.10 + 0.03 * sin(uTime * 0.02);
      vec2 dir = vec2(cos(ang), sin(ang));
      vec2 prp = vec2(-dir.y, dir.x);

      float freq = 6.5;
      float s = dot(p, dir) * freq + t * 0.3;
      float b = fract(s);
      float aa = freq * 2.0 / min(uRes.x, uRes.y);

      // Day cycle, lifted briefly by cursor movement.
      float sun = (0.72 + 0.28 * sin(uTime * 0.045)) * (1.0 + 0.2 * uMouseStrength);

      vec3 ink      = vec3(0.043, 0.043, 0.051);
      vec3 concrete = vec3(0.78, 0.78, 0.74);
      vec3 lime     = vec3(0.784, 0.961, 0.259);

      // Each fin: a lit ramp climbing to a crisp edge, then a shadow gap.
      float ramp = pow(smoothstep(0.04, 0.55, b), 1.5);
      float fin = smoothstep(0.02, 0.02 + aa * 2.0, b) * (1.0 - smoothstep(0.58, 0.58 + aa * 2.0, b));
      float shade = mix(0.05, 0.52, ramp) * fin;

      // Concrete grain per fin.
      float cell = floor(s);
      shade *= 0.90 + 0.16 * fbm(p * 5.5 + cell * 1.7);

      vec3 col = ink + concrete * shade * sun;

      // Razor highlight on the lit edge of every fin.
      float edge = smoothstep(0.55, 0.565, b) * (1.0 - smoothstep(0.575, 0.59, b));
      col += lime * edge * 0.42 * uEnergy * sun;

      // Faint perpendicular mullions crossing the fins.
      float m = fract(dot(p, prp) * 1.7 + 0.25);
      float mull = 1.0 - smoothstep(0.0, 0.018, abs(m - 0.5) - 0.004);
      col *= 1.0 - mull * 0.35;

      // Soft sky bleed at the top corner.
      col += concrete * 0.05 * smoothstep(0.2, 1.2, p.y + p.x * 0.3) * sun;

      col = mix(col * 0.58, col, 0.45 + 0.55 * uEnergy);

      float vig = smoothstep(1.55, 0.35, length(p * vec2(0.85, 1.0)));
      col *= mix(0.55, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
