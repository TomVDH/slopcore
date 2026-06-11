import type { ShaderVariant } from "./types";

/**
 * Eclipse: an occluded disc seated right of center, corona streaming
 * around it, one bright bead orbiting the rim. The corona leans toward
 * the cursor; a sparse starfield scintillates behind.
 */

export const eclipse: ShaderVariant = {
  id: "eclipse",
  name: "Eclipse",
  family: "Light & nature",
  blurb: "Occluded disc, streaming corona, one bright bead.",
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
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);

      vec3 ink  = vec3(0.043, 0.043, 0.051);
      vec3 bone = vec3(0.88, 0.88, 0.84);
      vec3 lime = vec3(0.784, 0.961, 0.259);

      vec2 c = vec2(0.30, 0.10);
      float R = 0.44;
      vec2 rel = p - c;
      float d = length(rel);
      vec2 nrel = rel / max(d, 1e-4);

      // Sparse starfield, scintillating slowly, hidden near the disc.
      vec3 col = ink;
      vec2 sq = p * 42.0;
      vec2 cellId = floor(sq);
      vec2 fr = fract(sq) - 0.5;
      vec2 jitter = (vec2(hash(cellId + 3.3), hash(cellId + 5.5)) - 0.5) * 0.6;
      float lit2 = step(0.986, hash(cellId));
      float pt = 1.0 - smoothstep(0.02, 0.14, length(fr - jitter));
      float tw = 0.5 + 0.5 * sin(uTime * 1.1 + hash(cellId + 0.5) * 6.2831);
      col += bone * lit2 * pt * tw * 0.5 * smoothstep(R * 1.1, R * 1.9, d);

      // Corona: angular streamers, seamless around the rim.
      float n = fbm(nrel * 1.9 + vec2(uTime * 0.015, -uTime * 0.011));
      float streamer = pow(clamp(n * 1.30, 0.0, 1.0), 2.6);

      // It leans toward the cursor when the cursor moves.
      vec2 mrel = uMouse - c;
      float lean = 0.5 + 0.5 * dot(nrel, mrel / max(length(mrel), 1e-3));
      streamer *= 1.0 + 0.8 * lean * uMouseStrength;

      float glow = exp(-max(d - R, 0.0) * (6.5 - 4.0 * streamer));
      float breathe = 0.92 + 0.08 * sin(uTime * 0.07 + vel * 0.1);
      col += bone * glow * 0.50 * breathe * (0.50 + 0.50 * uEnergy);

      // Chromosphere: a razor rim, lime-warmed.
      float rim = exp(-abs(d - R) * 70.0);
      col += mix(bone, lime, 0.55) * rim * 0.85 * (0.6 + 0.4 * uEnergy);

      // The bead: one brilliant point orbiting the rim very slowly.
      float ba = uTime * 0.05;
      vec2 bead = c + R * vec2(cos(ba), sin(ba));
      float bd = length(p - bead);
      col += mix(bone, lime, 0.35) * exp(-bd * 26.0) * 1.1 * (0.7 + 0.3 * sin(uTime * 0.9));

      // The occluder reads as a void: darker than the sky.
      float disc = 1.0 - smoothstep(R - 0.006, R - 0.002, d);
      col = mix(col, ink * 0.52, disc);

      float vig = smoothstep(1.8, 0.45, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.028;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
