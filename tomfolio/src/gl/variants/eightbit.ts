import type { ShaderVariant } from "./types";

/**
 * Eightbit: the overworld at dusk. A hard pixel grid, a banded sky
 * dithered the old way, a blocky sun, two ridges of parallax
 * mountains and drifting cloud sprites. Sixteen colors would have
 * been a luxury. The cursor pans the parallax; energy is sunset.
 */

export const eightbit: ShaderVariant = {
  id: "eightbit",
  name: "Eightbit",
  family: "Pixel",
  blurb: "A dusk overworld: dithered sky, blocky sun, parallax ridges.",
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
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }

    // 2x2 Bayer for band dithering.
    float bayer2(vec2 pix) {
      vec2 m = mod(pix, 2.0);
      return (m.x * 2.0 + m.y * 3.0 - m.x * m.y * 4.0) / 4.0;
    }

    void main() {
      // The pixel grid: everything snaps to it.
      float cols = 120.0;
      float px = uRes.x / cols;
      vec2 pix = floor(gl_FragCoord.xy / px);
      vec2 p = (pix * px * 2.0 - uRes) / min(uRes.x, uRes.y);

      float t = uTime * (0.5 + 0.2 * uEnergy) + clamp(abs(uScrollVel), 0.0, 4.0) * 0.04;
      float pan = uMouse.x * 0.3;

      // The cartridge palette.
      vec3 skyHi   = vec3(0.13, 0.09, 0.31);
      vec3 skyMid  = vec3(0.42, 0.16, 0.42);
      vec3 skyLow  = vec3(0.85, 0.38, 0.26);
      vec3 sunGold = vec3(0.99, 0.78, 0.22);
      vec3 farMt   = vec3(0.25, 0.12, 0.34);
      vec3 nearMt  = vec3(0.11, 0.06, 0.18);
      vec3 ground  = vec3(0.06, 0.10, 0.09);
      vec3 grass   = vec3(0.13, 0.26, 0.14);

      // Sky: three bands, dithered at their seams.
      float sunset = 0.5 + 0.5 * uEnergy;
      float band = (p.y + 1.0) * 0.5 + (bayer2(pix) - 0.5) * 0.10;
      vec3 col;
      if (band > 0.72) col = skyHi;
      else if (band > 0.52) col = mix(skyMid, skyHi, step(0.62, band));
      else col = mix(skyLow, skyMid, step(0.42, band));
      col = mix(skyMid, col, clamp(sunset + 0.4, 0.0, 1.0));

      // Stars in the high band, two-frame twinkle.
      float star = step(0.993, hash(pix * 0.5)) * step(0.72, band);
      star *= step(0.5, fract(uTime * 0.5 + hash(pix) * 2.0));
      col = mix(col, vec3(0.95), star);

      // The sun: a blocky disc with a notch of stripes.
      vec2 sunC = vec2(0.44 + pan * 0.1, 0.16);
      float sd = length((p - sunC) * vec2(1.0, 1.1));
      if (sd < 0.30) {
        float stripe = step(0.5, fract((p.y - sunC.y) * 14.0));
        float low = step(p.y, sunC.y - 0.06);
        col = mix(sunGold, skyLow, low * stripe);
      }

      // Far ridge, parallax-light.
      float fy = -0.06 + 0.22 * floor(vnoise(vec2((p.x + pan * 0.4) * 1.4 + 7.0, 1.0)) * 5.0) / 5.0;
      if (p.y < fy) col = farMt;

      // Near ridge, parallax-heavy, with snowcap pixels.
      float ny = -0.34 + 0.30 * floor(vnoise(vec2((p.x + pan) * 1.9 + 2.0, 5.0)) * 6.0) / 6.0;
      if (p.y < ny) {
        col = nearMt;
        if (p.y > ny - 0.03) col = mix(nearMt, vec3(0.8, 0.75, 0.8), 0.6);
      }

      // Clouds: blocky sprites sliding by.
      float cl = vnoise(vec2(p.x * 2.0 - t * 0.20, floor(p.y * 6.0) / 6.0 * 3.0 + 9.0));
      float cloud = step(0.74, cl) * step(0.30, p.y) * step(p.y, 0.62);
      col = mix(col, vec3(0.93, 0.78, 0.74), cloud * 0.9);

      // The ground strip: grass rows with a dithered shore.
      if (p.y < -0.62) {
        col = ground;
        float tuft = step(0.82, hash(vec2(pix.x, floor(pix.y / 2.0))));
        col = mix(col, grass, tuft);
        if (p.y > -0.66 && bayer2(pix) > 0.4) col = nearMt;
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
