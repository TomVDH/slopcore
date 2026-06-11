import type { ShaderVariant } from "./types";

/**
 * Cutout: paper shapes cut with scissors, not drawn. Six organic
 * pieces float over dark card, each casting its small honest shadow,
 * each drifting and turning at its own pace. One piece is lime. The
 * cursor pushes parallax through the stack, near pieces moving more.
 */

export const cutout: ShaderVariant = {
  id: "cutout",
  name: "Cutout",
  family: "Collage",
  blurb: "Scissored paper shapes drifting over dark card.",
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

    // A scissored blob: radius wanders around the rim, with optional lobes.
    float piece(vec2 p, vec2 c, float R, float lobes, float seed, float ang, float aa) {
      vec2 rel = rot(ang) * (p - c);
      float a = atan(rel.y, rel.x);
      float rim = vnoise(vec2(cos(a), sin(a)) * 1.8 + seed * 17.0);
      float rad = R * (0.74 + 0.30 * rim + 0.16 * cos(a * lobes + seed));
      return 1.0 - smoothstep(rad - aa * 2.0, rad + aa * 2.0, length(rel));
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * (0.5 + 0.3 * uEnergy) + vel * 0.01;
      float aa = 2.5 / min(uRes.x, uRes.y);

      vec3 card = vec3(0.055, 0.055, 0.063);
      vec3 col = card * (0.96 + 0.06 * vnoise(p * 50.0));

      vec2 shadowOff = vec2(0.030, -0.042);

      // Layer data, painted back to front. Parallax grows with depth.
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float depth = (fi + 1.0) / 6.0;

        vec2 base;
        float R;
        float lobes;
        vec3 tint;
        if (i == 0) { base = vec2(-0.62, 0.30); R = 0.50; lobes = 0.0; tint = vec3(0.165, 0.20, 0.175); }
        else if (i == 1) { base = vec2(0.72, -0.34); R = 0.46; lobes = 0.0; tint = vec3(0.26, 0.26, 0.28); }
        else if (i == 2) { base = vec2(0.18, 0.46); R = 0.34; lobes = 5.0; tint = vec3(0.42, 0.42, 0.40); }
        else if (i == 3) { base = vec2(-0.30, -0.40); R = 0.30; lobes = 0.0; tint = vec3(0.86, 0.86, 0.82); }
        else if (i == 4) { base = vec2(0.52, 0.18); R = 0.24; lobes = 6.0; tint = vec3(0.784, 0.961, 0.259); }
        else { base = vec2(-0.05, 0.02); R = 0.15; lobes = 0.0; tint = vec3(0.64, 0.64, 0.60); }

        vec2 c = base
          + 0.05 * vec2(sin(t * (0.20 + fi * 0.05) + fi * 2.1), cos(t * (0.16 + fi * 0.04) + fi * 1.3))
          + uMouse * depth * 0.07 * (0.5 + uMouseStrength);
        float ang = (hash(vec2(fi, 3.0)) - 0.5) * 0.8 + t * 0.02 * (mod(fi, 2.0) * 2.0 - 1.0);

        // Shadow first, then the paper itself.
        float sh = piece(p - shadowOff * depth, c, R, lobes, fi, ang, aa * 3.0);
        col *= 1.0 - sh * 0.45;

        float m = piece(p, c, R, lobes, fi, ang, aa);
        vec3 paperTint = tint * (0.97 + 0.05 * vnoise(p * 34.0 + fi * 9.0));
        col = mix(col, paperTint, m);
      }

      float vig = smoothstep(2.0, 0.5, length(p * vec2(0.85, 1.0)));
      col *= mix(0.62, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.022;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
