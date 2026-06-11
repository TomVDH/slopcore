import type { ShaderVariant } from "./types";

/**
 * Aurora: curtains of light over a dark ridge. Each curtain keeps the
 * physics of the real thing: a sharp bright lower hem, a long fading
 * tail upward, and vertical rays streaming through the whole sheet.
 * The cursor sways the curtains; energy is how hard the sky works.
 * The page's lime finally gets to be what it always was: aurora green.
 */

export const aurora: ShaderVariant = {
  id: "aurora",
  name: "Aurora",
  family: "Sky",
  blurb: "Curtains of green light, sharp at the hem, streaming rays.",
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
        p *= 2.05;
        amp *= 0.5;
      }
      return v;
    }

    // One curtain: sharp hem, long tail, rays streaming through.
    vec3 curtain(vec2 p, float seed, float t, float sway, float activity) {
      vec3 lime = vec3(0.784, 0.961, 0.259);
      vec3 pale = vec3(0.45, 0.78, 0.52);
      vec3 high = vec3(0.62, 0.72, 0.70);

      // The hem wanders the middle sky.
      float hem = -0.38 + seed * 0.26
        + 0.22 * fbm(vec2(p.x * 0.7 + t * (0.10 + seed * 0.04) + sway, seed * 7.0));

      float above = p.y - hem;
      // Sharp below, long fade above.
      float body = smoothstep(-0.035, 0.012, above) * exp(-max(above, 0.0) * (1.9 - seed * 0.45));

      // Rays: vertical streamers sliding along the sheet.
      float rays = 0.45 + 0.55 * vnoise(vec2(p.x * (11.0 + seed * 7.0) + sway * 2.0 + t * 0.7, seed * 3.0));
      rays *= 0.7 + 0.3 * vnoise(vec2(p.x * 31.0 - t * 0.4, seed * 5.0));

      float glow = body * rays * activity;

      // Color climbs from lime at the hem to thin pale heights.
      float climb = clamp(above * 1.6, 0.0, 1.0);
      vec3 tint = mix(lime, pale, climb);
      tint = mix(tint, high, climb * climb * 0.7);

      // The hem itself burns brightest.
      float hemline = exp(-abs(above) * 26.0);
      return tint * glow * 0.55 + lime * hemline * rays * activity * 0.35;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * 0.5 + vel * 0.02;

      vec3 night = vec3(0.027, 0.031, 0.043);
      vec3 col = night;

      // Stars, hidden where the curtains burn.
      vec2 sq = p * 46.0;
      vec2 cellId = floor(sq);
      vec2 fr = fract(sq) - 0.5;
      vec2 jit = (vec2(hash(cellId + 3.3), hash(cellId + 5.5)) - 0.5) * 0.6;
      float lit = step(0.985, hash(cellId));
      float pt = 1.0 - smoothstep(0.02, 0.13, length(fr - jit));
      float tw = 0.5 + 0.5 * sin(uTime * 1.0 + hash(cellId) * 6.2831);
      col += vec3(0.7, 0.72, 0.75) * lit * pt * tw * 0.4;

      // Three curtains, far to near; the cursor sways them.
      float sway = uMouse.x * (0.4 + 0.6 * uMouseStrength);
      float activity = 0.45 + 0.55 * uEnergy;
      vec3 glow = vec3(0.0);
      glow += curtain(p, 0.4, t, sway * 0.5, activity * 0.55);
      glow += curtain(p, 1.0, t * 1.2, sway * 0.8, activity * 0.8);
      glow += curtain(p, 1.7, t * 1.5, sway, activity);

      col += glow;
      // Strong light drowns the stars behind it.
      col -= vec3(0.4, 0.45, 0.4) * lit * pt * clamp(length(glow), 0.0, 0.6);

      // The ridge holds the bottom of the world.
      float ridgeY = -0.74 + 0.07 * fbm(vec2(p.x * 1.8, 1.0));
      float ground = 1.0 - smoothstep(ridgeY - 0.004, ridgeY + 0.01, p.y);
      col = mix(col, vec3(0.012, 0.014, 0.016), ground);
      // Snowlight: the aurora breathes faintly on the ridge line.
      col += vec3(0.3, 0.4, 0.25) * ground * exp(-abs(p.y - ridgeY) * 18.0) * length(glow) * 0.3;

      float vig = smoothstep(2.0, 0.55, length(p * vec2(0.85, 1.0)));
      col *= mix(0.62, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.02;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
