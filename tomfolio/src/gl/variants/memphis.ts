import type { ShaderVariant } from "./types";

/**
 * Memphis: 1986 on purpose. Cream ground flecked with terrazzo, one
 * pink squiggle, a teal triangle in outline, a solid yellow ball, a
 * black zigzag and a lavender slab in polka dots, all drifting like
 * a shop window display. The cursor scatters the nearest confetti.
 */

export const memphis: ShaderVariant = {
  id: "memphis",
  name: "Memphis",
  family: "Memphis",
  blurb: "Terrazzo, squiggle, zigzag: 1986 on purpose.",
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

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    // Distance to a segment.
    float seg(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float t = uTime * (0.5 + 0.2 * uEnergy) * 0.4;
      float aa = 2.5 / min(uRes.x, uRes.y);

      vec3 cream    = vec3(0.965, 0.945, 0.90);
      vec3 inkB     = vec3(0.10, 0.10, 0.12);
      vec3 pink     = vec3(0.96, 0.45, 0.65);
      vec3 teal     = vec3(0.13, 0.71, 0.65);
      vec3 yellow   = vec3(0.99, 0.80, 0.18);
      vec3 lavender = vec3(0.70, 0.62, 0.88);

      vec3 col = cream;

      // Terrazzo: three sizes of confetti chips, scattering near the cursor.
      for (int s = 0; s < 3; s++) {
        float fs = float(s);
        float scale = 9.0 + fs * 8.0;
        vec2 id = floor(p * scale + fs * 7.0);
        vec2 f = fract(p * scale + fs * 7.0) - 0.5;
        float rnd = hash(id + fs);
        if (rnd > 0.82) {
          vec2 jit = (vec2(hash(id + 1.1), hash(id + 2.2)) - 0.5) * 0.6;
          float scatter = exp(-length(id / scale - uMouse) * 2.0) * uMouseStrength;
          jit += vec2(sin(rnd * 40.0), cos(rnd * 30.0)) * scatter * 0.4;
          vec2 q = rot(rnd * 6.28) * (f - jit);
          float chip = step(abs(q.x), 0.13) * step(abs(q.y), 0.05);
          vec3 chipCol = rnd > 0.95 ? teal : (rnd > 0.89 ? pink : inkB);
          col = mix(col, chipCol, chip * 0.85);
        }
      }

      // The lavender slab, dotted, leaning back right.
      vec2 q4 = rot(-0.18 + 0.02 * sin(t)) * (p - vec2(0.78, 0.30));
      float slab = step(abs(q4.x), 0.34) * step(abs(q4.y), 0.50);
      float polka = 1.0 - smoothstep(0.05, 0.07, length(fract(q4 * 9.0) - 0.5));
      col = mix(col, lavender, slab);
      col = mix(col, cream, slab * polka * 0.9);

      // The yellow ball, bouncing very slowly.
      vec2 ballC = vec2(-0.62, -0.22 + 0.08 * abs(sin(t * 1.7)));
      float ball = 1.0 - smoothstep(0.26 - aa, 0.26 + aa, length(p - ballC));
      col = mix(col, yellow, ball);
      // Its half-moon shadow.
      float crescent = 1.0 - smoothstep(0.26, 0.30, length(p - ballC - vec2(0.05, -0.05)));
      col = mix(col, inkB, clamp(crescent - ball, 0.0, 1.0) * 0.18);

      // The teal triangle, outline only, spinning like a sign.
      vec2 q2 = rot(t * 0.3) * (p - vec2(0.05, 0.42));
      float tri = max(max(dot(q2, vec2(0.0, -1.0)) - 0.18,
                          dot(q2, vec2(0.87, 0.5)) - 0.18),
                      dot(q2, vec2(-0.87, 0.5)) - 0.18);
      float triLine = 1.0 - smoothstep(0.020 - aa, 0.020 + aa, abs(tri));
      col = mix(col, teal, triLine);

      // The pink squiggle: a fat sine tube wandering the lower field.
      float sq = abs(p.y + 0.62 - 0.10 * sin(p.x * 5.0 + t * 1.2));
      float squiggle = 1.0 - smoothstep(0.045 - aa, 0.045 + aa, sq);
      squiggle *= step(abs(p.x), 1.1);
      col = mix(col, pink, squiggle);

      // The black zigzag, top left, three strokes.
      float zz = 1e3;
      zz = min(zz, seg(p, vec2(-1.15, 0.55), vec2(-0.95, 0.78)));
      zz = min(zz, seg(p, vec2(-0.95, 0.78), vec2(-0.75, 0.55)));
      zz = min(zz, seg(p, vec2(-0.75, 0.55), vec2(-0.55, 0.78)));
      float zig = 1.0 - smoothstep(0.022 - aa, 0.022 + aa, zz);
      col = mix(col, inkB, zig);

      // Scroll nudges the whole display.
      col *= 1.0 - 0.01 * clamp(abs(uScrollVel), 0.0, 4.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
