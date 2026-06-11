import type { ShaderVariant } from "./types";

/**
 * Brushwork: three dry-brush strokes swept across dark paper, plus one
 * stamped seal. The strokes breathe; the cursor presses the paper and
 * bends the ink around it.
 */

export const brushwork: ShaderVariant = {
  id: "brushwork",
  name: "Brushwork",
  family: "Print & craft",
  blurb: "Three dry-brush strokes and one stamped seal.",
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

    float sdBox(vec2 p, vec2 b, float r) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
    }

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    // One stroke: spine across the frame, loaded at the start and dry by
    // the end, with bristle streaks tearing the body open.
    float stroke(vec2 p, float y0, float amp, float ph, float w0, float seed) {
      float u = clamp((p.x + 1.35) / 2.7, 0.0, 1.0);
      float spine = y0 + amp * sin(u * 3.05 + ph) * (0.62 + 0.38 * sin(ph * 2.0 + u * 1.8));
      float d = p.y - spine;
      float taper = pow(clamp(u * (1.0 - u) * 4.0, 0.0, 1.0), 0.55) * (1.0 - 0.30 * u);
      float w = w0 * taper * (1.0 + 0.15 * sin(uTime * 0.18 + seed));
      if (w < 1e-4) return 0.0;

      float body = 1.0 - smoothstep(w * 0.45, w, abs(d));

      // Dry brush: fine parallel streaks, biting harder as the ink runs
      // out along the sweep.
      float bristle = fbm(vec2(u * 13.0 + seed * 9.0, d / w * 5.0 + seed * 3.0));
      float dryness = 0.20 + 0.26 * u;
      body *= smoothstep(dryness, dryness + 0.45, bristle + 0.18 * taper);

      // Heavier ink where the brush lands.
      float pool = (1.0 - smoothstep(0.0, 0.10, abs(u - 0.07)))
                 * (1.0 - smoothstep(w * 1.2, w * 1.9, abs(d)));
      return clamp(body + pool * 0.55, 0.0, 1.0);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

      vec3 ink   = vec3(0.043, 0.043, 0.051);
      vec3 paper = vec3(0.86, 0.86, 0.82);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      // Dark paper with tooth.
      vec3 col = ink * (0.93 + 0.09 * fbm(p * 8.0));

      // The cursor presses the sheet; ink bends away from the press.
      vec2 pp = p;
      pp.y -= 0.06 * uMouseStrength * exp(-length(p - uMouse) * 2.4);
      pp.x += clamp(uScrollVel, -4.0, 4.0) * 0.004 * pp.y;

      // Three gestures at crossing angles, each its own grey.
      float s1 = stroke(rot(-0.16) * pp, 0.30, 0.20, 0.4, 0.165, 1.0);
      float s2 = stroke(rot(0.07) * pp, -0.02, 0.26, 2.1, 0.105, 2.0);
      float s3 = stroke(rot(-0.40) * pp, -0.30, 0.16, 4.6, 0.050, 3.0);

      float mark = 0.55 + 0.45 * uEnergy;
      col = mix(col, paper * 0.95, s1 * 0.85 * mark);
      col = mix(col, paper * 1.00, s2 * 0.90 * mark);
      col = mix(col, paper * 0.74, s3 * 0.78 * mark);

      // The seal: one lime stamp, square with a carved counter.
      vec2 sp = p - vec2(0.86, -0.52);
      float seal = 1.0 - smoothstep(0.0, 0.006, sdBox(sp, vec2(0.055, 0.055), 0.008));
      float carve = 1.0 - smoothstep(0.0, 0.005, sdBox(sp - vec2(0.0, 0.0), vec2(0.026, 0.026), 0.003));
      float sealTex = 0.85 + 0.15 * vnoise(sp * 60.0);
      col = mix(col, lime * sealTex, seal * (1.0 - carve * 0.9) * 0.95);

      float vig = smoothstep(1.7, 0.4, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.032;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
