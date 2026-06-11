import type { ShaderVariant } from "./types";

/**
 * Vasarely: a strict ink-and-paper checkerboard with one spherical
 * swelling drifting through it, cells stretching over the bulge the
 * way the op masters drew volume with nothing but a grid. The cursor
 * pulls the sphere; energy is its size. One lime cell rides the
 * lattice and warps with everything else.
 */

export const vasarely: ShaderVariant = {
  id: "vasarely",
  name: "Vasarely",
  family: "Optical",
  blurb: "A checkerboard swelling into a sphere, one lime cell.",
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

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * (0.5 + vel * 0.05);

      vec3 ink   = vec3(0.055, 0.055, 0.063);
      vec3 paper = vec3(0.91, 0.91, 0.89);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      // The swelling drifts; the cursor pulls it over.
      vec2 c = vec2(0.30 * sin(t * 0.20), 0.22 * sin(t * 0.16 + 1.3));
      c = mix(c, uMouse, clamp(uMouseStrength, 0.0, 1.0) * 0.65);

      float R = 0.62 * (0.75 + 0.35 * uEnergy);
      vec2 rel = p - c;
      float d = length(rel);

      // Cells magnify over the bulge: inverse-scale the lattice lookup.
      float bell = exp(-(d * d) / (R * R) * 2.2);
      float mag = 1.0 + 1.35 * bell;
      vec2 q = c + rel / mag;

      // The checker, antialiased by distance to the nearest cell edge.
      float N = 7.0;
      vec2 g = q * N + 0.5;
      vec2 cell = floor(g);
      vec2 f = fract(g);
      float checker = mod(cell.x + cell.y, 2.0);

      // Edge softness in screen space, wider where magnified.
      float aa = N * 1.8 / (min(uRes.x, uRes.y) * mag);
      vec2 e = min(f, 1.0 - f);
      float edge = smoothstep(0.0, aa * 2.0, min(e.x, e.y));

      vec3 a = ink;
      vec3 b = paper;
      vec3 col = mix(a, b, checker);

      // One lime cell, living at a fixed lattice address.
      if (cell.x == 5.0 && cell.y == 1.0) col = lime;

      // Hairline grid where cells meet, fading off the bulge.
      col = mix(mix(a, b, 0.5), col, clamp(edge, 0.35, 1.0));

      // Sphere lighting: the swelling catches light from upper left.
      float z = sqrt(max(1.0 - (d / max(R, 1e-3)) * (d / max(R, 1e-3)), 0.0)) * bell;
      float shade = 1.0 + 0.30 * z * (0.4 - dot(normalize(rel + 1e-4), vec2(0.6, 0.75)));
      col *= clamp(shade, 0.7, 1.35);

      float vig = smoothstep(2.0, 0.5, length(p * vec2(0.85, 1.0)));
      col *= mix(0.72, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.02;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
