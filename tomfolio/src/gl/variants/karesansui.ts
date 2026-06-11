import type { ShaderVariant } from "./types";

/**
 * Karesansui: a raked dry garden. Straight grooves cross the sand
 * until they meet the stones, where the rake turned and circled.
 * The cursor is an invisible third stone: the sand re-combs around
 * wherever it rests. A little moss keeps one stone company. Almost
 * nothing moves, and that is the point.
 */

export const karesansui: ShaderVariant = {
  id: "karesansui",
  name: "Karesansui",
  family: "Land art",
  blurb: "Raked sand circling two stones, moss at one foot.",
  frag: /* glsl */ `
    precision highp float;

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uMouse;
    uniform float uMouseStrength;
    uniform float uEnergy;
    uniform float uScrollVel;

    const float TAU = 6.28318530;

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

    // A stone: an irregular blob, distance to its rim.
    float stoneDist(vec2 p, vec2 c, float R, float seed) {
      vec2 rel = p - c;
      float a = atan(rel.y, rel.x);
      float rad = R * (0.82 + 0.22 * vnoise(vec2(cos(a), sin(a)) * 1.6 + seed * 13.0));
      return length(rel) - rad;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);

      vec3 sand  = vec3(0.78, 0.77, 0.72);
      vec3 rock  = vec3(0.21, 0.21, 0.23);
      vec3 lime  = vec3(0.55, 0.70, 0.18);

      vec2 s1 = vec2(0.38, 0.16);
      vec2 s2 = vec2(-0.46, -0.30);
      float d1 = stoneDist(p, s1, 0.26, 1.0);
      float d2 = stoneDist(p, s2, 0.17, 2.0);

      // The rake: straight lines far from the stones, circles near them.
      float K = 30.0;
      float near1 = exp(-max(d1, 0.0) * 2.6);
      float near2 = exp(-max(d2, 0.0) * 2.6);

      // The cursor rests like a third, invisible stone.
      float dm = length(p - uMouse) - 0.10;
      float nearM = exp(-max(dm, 0.0) * 3.0) * clamp(uMouseStrength * 1.3, 0.0, 1.0);

      float phase = p.y * K;
      phase = mix(phase, (d1 + 0.0) * K, near1);
      phase = mix(phase, (d2 + 0.0) * K, near2);
      phase = mix(phase, dm * K, nearM);

      // Groove shading: ridges lit from the northwest.
      float contrast = 0.10 + 0.10 * uEnergy;
      float g = sin(phase * TAU / 4.0);
      vec3 col = sand * (0.90 + contrast * g);
      // The shadowed wall of each groove.
      col *= 1.0 - 0.10 * smoothstep(0.2, 0.9, -g);

      // Sand grain, and the rare glint of a quartz fleck.
      col *= 0.95 + 0.07 * vnoise(p * 110.0);
      float fleck = step(0.9975, hash(floor(p * 260.0)));
      col += vec3(0.5) * fleck * (0.4 + 0.3 * sin(uTime * 0.7 + hash(floor(p * 260.0) + 1.0) * 9.0));

      // Settling shadow around each stone.
      col *= 1.0 - 0.28 * exp(-max(d1, 0.0) * 9.0);
      col *= 1.0 - 0.28 * exp(-max(d2, 0.0) * 9.0);

      float aa = 2.5 / min(uRes.x, uRes.y);

      // The stones themselves: domed, lit from the northwest.
      vec2 L = normalize(vec2(-0.6, 0.85));
      float in1 = 1.0 - smoothstep(-aa, aa, d1);
      float in2 = 1.0 - smoothstep(-aa, aa, d2);
      float dome1 = clamp(dot(normalize(p - s1 + 1e-4), L) * -0.5 + 0.5, 0.0, 1.0);
      float dome2 = clamp(dot(normalize(p - s2 + 1e-4), L) * -0.5 + 0.5, 0.0, 1.0);
      vec3 stone1 = rock * (0.7 + 0.7 * dome1) * (0.92 + 0.12 * vnoise(p * 40.0));
      vec3 stone2 = rock * (0.7 + 0.7 * dome2) * (0.92 + 0.12 * vnoise(p * 40.0 + 9.0));
      col = mix(col, stone1, in1);
      col = mix(col, stone2, in2);

      // Moss keeping the small stone company, at its shaded foot.
      vec2 mossC = s2 + vec2(0.13, -0.13);
      float mossField = vnoise((p - mossC) * 26.0) * exp(-length(p - mossC) * 9.0);
      float moss = smoothstep(0.10, 0.30, mossField);
      col = mix(col, lime * (0.8 + 0.3 * vnoise(p * 80.0)), moss * 0.85);

      // Scroll breathes the faintest heat shimmer over the garden.
      col *= 1.0 + 0.01 * vel * sin(p.x * 30.0 + uTime);

      float vig = smoothstep(2.0, 0.5, length(p * vec2(0.85, 1.0)));
      col *= mix(0.66, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.02;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
