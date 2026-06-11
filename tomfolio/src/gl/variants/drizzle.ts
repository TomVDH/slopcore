import type { ShaderVariant } from "./types";

/**
 * Drizzle: a rained-on window at night. Out-of-focus lights hang in
 * the dark; static droplets hold sharp little upside-down copies of
 * them; runner drops slide and leave trails. Wiping the cursor across
 * the glass clears it for a moment, and the world outside sharpens.
 */

export const drizzle: ShaderVariant = {
  id: "drizzle",
  name: "Drizzle",
  family: "Weather",
  blurb: "Rain on night glass, bokeh behind, wipe to clear.",
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

    // The city outside: a handful of out-of-focus lights.
    vec3 outside(vec2 q, float blur) {
      vec3 ink  = vec3(0.035, 0.035, 0.047);
      vec3 col = ink + vec3(0.012, 0.012, 0.02) * (q.y + 1.0);

      vec3 tint;
      vec2 c;
      float r;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float h1 = hash(vec2(fi, 1.7));
        float h2 = hash(vec2(fi, 9.3));
        c = vec2(mix(-1.5, 1.5, h1), mix(-0.85, 0.75, h2));
        r = mix(0.05, 0.16, hash(vec2(fi, 4.1)));
        tint = mix(vec3(0.75, 0.74, 0.68), vec3(0.55, 0.58, 0.66), hash(vec2(fi, 6.2)));
        if (i == 3) tint = vec3(0.784, 0.961, 0.259);
        float d = length(q - c);
        float glow = exp(-(d * d) / (r * r * blur)) * 0.55;
        // A faint flicker, each lamp on its own breath.
        glow *= 0.88 + 0.12 * sin(uTime * (0.4 + h1) + fi * 9.0);
        col += tint * glow;
      }
      return col;
    }

    // One droplet layer on a grid; returns offset (xy) and mask (z).
    vec3 drops(vec2 p, float scale, float keep, float seed) {
      vec2 g = p * scale;
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      float rnd = hash(id + seed);
      if (rnd > keep) return vec3(0.0);
      vec2 c = (vec2(hash(id + seed + 1.1), hash(id + seed + 2.2)) - 0.5) * 0.5;
      float r = mix(0.10, 0.22, hash(id + seed + 3.3));
      vec2 rel = f - c;
      float d = length(rel);
      float mask = 1.0 - smoothstep(r * 0.8, r, d);
      vec2 off = rel / max(r, 1e-4);
      return vec3(off * mask, mask);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);

      float density = 0.55 + 0.35 * uEnergy;

      // The wipe: the cursor clears the glass; it fogs back over.
      float md = length(p - uMouse);
      float wipe = exp(-md * 1.6) * clamp(uMouseStrength * 1.4, 0.0, 1.0);

      // Static droplet layers.
      vec3 d1 = drops(p, 7.0, density, 0.0);
      vec3 d2 = drops(p + 31.7, 13.0, density * 0.8, 5.0);

      // Runners: drops sliding down their lanes, faster when it pours.
      float lane = floor(p.x * 9.0);
      float slide = uTime * (0.05 + 0.04 * uEnergy + vel * 0.01) * (0.5 + hash(vec2(lane, 7.7)));
      vec3 d3 = drops(vec2(p.x, p.y + slide), 9.0, density * 0.5, 9.0);

      vec3 d = d1;
      if (d2.z > d.z) d = d2;
      if (d3.z > d.z) d = d3;
      d *= 1.0 - wipe;

      // Behind a droplet the world is sharp and flipped; elsewhere, fog.
      float clarity = mix(6.0, 2.2, wipe);
      vec3 col;
      if (d.z > 0.01) {
        col = outside(p * 0.9 - d.xy * 0.55, 0.55);
        col *= 0.85 + 0.3 * d.z;
        // A bead of rim light on each drop.
        col += vec3(0.8, 0.8, 0.78) * pow(d.z, 6.0) * 0.18;
      } else {
        col = outside(p, clarity);
      }

      // The trail sheen under the runner lanes.
      col += vec3(0.5, 0.5, 0.52) * d3.z * 0.05;

      // Glass grime and vignette.
      col *= 0.94 + 0.06 * hash(floor(p * 240.0));
      float vig = smoothstep(1.9, 0.45, length(p * vec2(0.85, 1.0)));
      col *= mix(0.55, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.022;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
