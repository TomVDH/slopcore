import type { ShaderVariant } from "./types";

/**
 * Geode: a cut agate slice. Banded stone wraps a cavity of crystal
 * facets, each facet holding its own angle; a light travels the
 * movement of the cursor and the facets fire in turn as it passes.
 * A few inclusions run lime. The heart of the stone stays dark.
 */

export const geode: ShaderVariant = {
  id: "geode",
  name: "Geode",
  family: "Mineral",
  blurb: "An agate slice, faceted cavity, traveling glint.",
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
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * 0.5;

      vec3 ink   = vec3(0.043, 0.043, 0.051);
      vec3 bone  = vec3(0.80, 0.79, 0.74);
      vec3 smoke = vec3(0.30, 0.30, 0.33);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      vec2 gc = vec2(0.26, 0.0);
      float gr = 0.66;
      vec2 rel = p - gc;
      // The slice is a little irregular, as cut stones are.
      float wob = 1.0 + 0.06 * fbm(normalize(rel + 1e-4) * 2.4 + 5.0);
      float r = length(rel) / wob;

      vec3 col = ink;
      // Shadow under the slice.
      col += vec3(0.0) - 0.0;
      col = mix(col, ink * 0.5, (1.0 - smoothstep(gr, gr * 1.25, length(rel - vec2(-0.05, 0.06)))) * 0.5);

      float aa = 2.5 / min(uRes.x, uRes.y);

      // The light that walks the stone.
      float lightA = t * 0.5 + uMouse.x * 1.6;

      if (r < gr) {
        float band = r / gr;
        if (band > 0.72) {
          // Agate banding: rings wobbling with the stone's grain.
          float ring = fract(band * 16.0 + 2.0 * fbm(rel * 3.0));
          float tone = mix(0.16, 0.42, smoothstep(0.15, 0.85, ring));
          col = vec3(tone * 0.95, tone, tone * 0.92);
          // The outer skin runs darker.
          col *= mix(1.0, 0.55, smoothstep(0.94, 1.0, band));
        } else if (band > 0.26) {
          // Crystal cavity: voronoi facets.
          vec2 q = rel * 7.5;
          vec2 cellId = floor(q);
          vec2 f = fract(q);
          float f1 = 8.0;
          float f2 = 8.0;
          vec2 best = vec2(0.0);
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 g = vec2(float(x), float(y));
              vec2 o = hash2(cellId + g);
              float d = length(g + o - f);
              if (d < f1) { f2 = f1; f1 = d; best = cellId + g; }
              else if (d < f2) { f2 = d; }
            }
          }
          float h = hash(best);

          // Each facet holds an angle; it fires as the light passes.
          float facetA = h * 6.28318;
          float fire = pow(0.5 + 0.5 * cos(lightA - facetA), 8.0);
          fire *= 0.55 + 0.45 * uEnergy;

          vec3 base = mix(ink * 1.6, smoke, h);
          col = base + bone * fire * 0.75;

          // Inclusions: the rare facet runs lime.
          if (h > 0.91) col = mix(col, lime, 0.5 + 0.4 * fire);

          // Crystal edges catch a thin bright line.
          float edge = 1.0 - smoothstep(0.0, 0.05, f2 - f1);
          col += bone * edge * 0.30;

          // Depth: facets darken toward the hollow.
          col *= mix(0.55, 1.0, smoothstep(0.26, 0.7, band));
        } else {
          // The hollow heart: near-black with a breath of dust.
          col = ink * 0.8 + bone * 0.04 * fbm(rel * 14.0 + t * 0.1);
        }

        // Rim line of the whole slice.
        col = mix(col, bone * 0.5, (1.0 - smoothstep(0.0, aa * 2.0, abs(r - gr) - 0.002)) * 0.6);
      }

      // Scroll stirs a faint shimmer across the cavity.
      col += bone * 0.015 * vel * (1.0 - smoothstep(0.0, gr, r));

      float vig = smoothstep(1.9, 0.45, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.022;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
