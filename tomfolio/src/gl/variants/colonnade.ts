import type { ShaderVariant } from "./types";

/**
 * Colonnade: three rows of fluted columns in raking light. The mouse
 * steers the sun azimuth; energy lifts the lit rims.
 */

export const colonnade: ShaderVariant = {
  id: "colonnade",
  name: "Colonnade",
  family: "Architecture",
  blurb: "Fluted columns in raking light, three rows deep.",
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
      float t = uTime * 0.05 + vel * 0.01;

      // Sun: clearly lateral, drifting slowly, nudged by the cursor.
      float lightA = 1.18 + 0.15 * sin(uTime * 0.03) + uMouse.x * 0.35;
      vec2 L = vec2(sin(lightA), cos(lightA));
      float sun = (0.8 + 0.2 * sin(uTime * 0.021)) * (1.0 + 0.18 * uMouseStrength);

      vec3 ink   = vec3(0.043, 0.043, 0.051);
      vec3 stone = vec3(0.86, 0.86, 0.82);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      // Faint light shaft behind the colonnade.
      vec3 col = ink;
      float shaft = exp(-(p.x - 0.3) * (p.x - 0.3) * 1.6) * smoothstep(-0.9, 1.1, p.y);
      col += stone * shaft * 0.07 * sun;

      // Three rows of columns, painted back to front.
      for (int i = 2; i >= 0; i--) {
        float fi = float(i);
        float freq = 1.7 - fi * 0.35;
        float drift = t * 0.05 * (fi * 0.6 + 0.25) + fi * 0.41;
        float xx = p.x * freq + drift + uMouse.x * 0.04 * (2.0 - fi);
        float cx = fract(xx) - 0.5;
        float half_ = 0.36 - fi * 0.04;
        float aa = freq * 3.0 / min(uRes.x, uRes.y);
        float inCol = 1.0 - smoothstep(half_ - aa, half_ + aa, abs(cx));

        // Cylindrical shading from a fake normal across the shaft.
        float nx = clamp(cx / half_, -1.0, 1.0);
        float nz = sqrt(max(1.0 - nx * nx, 0.0));
        float diffClean = max(dot(vec2(nx, nz), L), 0.0);

        // Flutes: the faintest vertical ridges riding the curvature.
        float diff = diffClean * (0.96 + 0.04 * sin(nx * 14.0));

        float fade = 1.0 - fi * 0.42;
        float vGrad = 0.70 + 0.30 * smoothstep(-1.1, 1.0, p.y);
        vec3 colCol = ink + stone * diff * 0.48 * fade * vGrad * sun;

        // Lit rim, front row only, kissed with the accent.
        if (i == 0) {
          float rim = pow(diffClean, 18.0);
          colCol += lime * rim * 0.26 * uEnergy * sun;
        }

        // Entasis shadow at column foot.
        colCol *= 0.82 + 0.18 * smoothstep(-1.05, -0.55, p.y);

        col = mix(col, colCol, inCol * (0.96 - fi * 0.22));
      }

      // Polished floor: dim mirrored wash at the bottom.
      float floorBand = smoothstep(-0.72, -1.05, p.y);
      col = mix(col, col * 0.45 + ink, floorBand * 0.7);

      // Atmosphere.
      col *= 0.92 + 0.08 * fbm(p * 3.0 + t * 0.2);
      col = mix(col * 0.6, col, 0.45 + 0.55 * uEnergy);

      float vig = smoothstep(1.55, 0.35, length(p * vec2(0.85, 1.0)));
      col *= mix(0.55, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
