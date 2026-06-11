import type { ShaderVariant } from "./types";

/**
 * Vaults: arched masonry bays receding toward a lit far end. Painted
 * near-to-far; the first blocked bay sets the surface, otherwise the
 * eye reaches the glow at the end of the passage.
 */

export const vaults: ShaderVariant = {
  id: "vaults",
  name: "Vaults",
  family: "Architecture",
  blurb: "Arched bays receding toward a lit far end.",
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

    // Signed distance to an arch opening: rectangle below, circle cap above.
    float archDist(vec2 q, float halfW, float capY) {
      if (q.y < capY) {
        return abs(q.x) - halfW;
      }
      return length(vec2(q.x, q.y - capY)) - halfW;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * 0.05 + vel * 0.01;

      vec3 ink   = vec3(0.043, 0.043, 0.051);
      vec3 stone = vec3(0.80, 0.80, 0.76);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      // The glow at the far end of the passage, seated right of center
      // so the hero copy keeps the lower-left quadrant.
      vec2 vp = vec2(0.26 + uMouse.x * 0.12, -0.04 + uMouse.y * 0.05);
      float glowD = length((p - vp) * vec2(1.0, 1.35));
      float breathe = 0.9 + 0.1 * sin(uTime * 0.06);
      vec3 col = ink + mix(stone, lime, 0.42) * exp(-glowD * 1.9) * 0.62 * breathe * (0.55 + 0.45 * uEnergy);
      col += lime * 0.05 * uMouseStrength * exp(-glowD * 3.0);

      // Five bays, nearest first. The first wall we hit wins.
      float blocked = 0.0;
      float aaBase = 2.5 / min(uRes.x, uRes.y);

      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float s = pow(0.72, fi);

        // Bay frame in its own scaled space, sliding gently with time.
        vec2 q = (p - vp * (1.0 - s)) / s;
        q.y += 0.18;
        q.x += sin(t * 0.1 + fi * 1.7) * 0.012;

        float d = archDist(q, 0.70, 0.14);
        float aa = aaBase / s + 0.004;

        // Masonry of this bay: everything outside its opening.
        float wall = smoothstep(-aa, aa, d) * (1.0 - blocked);

        if (wall > 0.001) {
          float depthFade = 1.0 - fi * 0.17;
          float grain = 0.92 + 0.10 * vnoise(q * 6.0 + fi * 13.1);

          // Ambient occlusion hugging the opening edge.
          float ao = 1.0 - 0.55 * exp(-max(d, 0.0) * 7.0);

          // Light wraps in from the far glow.
          float wrap = exp(-glowD * 1.6) * 0.5 + 0.10;

          vec3 masonry = ink + stone * wrap * 0.34 * depthFade * grain * ao;

          // Intrados rim: the arch edge catches the light.
          float rim = exp(-abs(d) * 26.0) * wrap;
          masonry += mix(stone, lime, 0.55) * rim * 0.30 * uEnergy * depthFade;

          col = mix(col, masonry, wall);
          blocked = min(blocked + wall, 1.0);
        }
      }

      // Floor reflection of the glow.
      float floorBand = smoothstep(-0.55, -1.1, p.y);
      col += mix(stone, lime, 0.4) * floorBand * exp(-abs(p.x - vp.x) * 2.2) * 0.05 * (0.5 + 0.5 * uEnergy);

      col = mix(col * 0.6, col, 0.45 + 0.55 * uEnergy);

      float vig = smoothstep(1.55, 0.35, length(p * vec2(0.85, 1.0)));
      col *= mix(0.55, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
