import type { ShaderVariant } from "./types";

/**
 * Escapement: a watchmaker's drawing brought to one-line life. Two
 * wheels mesh and turn continuously; the escape wheel advances in
 * ticks, one tooth at a time, the way time actually moves. Strokes
 * are pale ink on dark; the pivots carry tiny lime jewels. The cursor
 * tilts the whole movement on its bridge.
 */

export const escapement: ShaderVariant = {
  id: "escapement",
  name: "Escapement",
  family: "Machine",
  blurb: "A gear train in line work, the escape wheel ticking.",
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

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    float stroke(float d, float w, float aa) {
      return 1.0 - smoothstep(w - aa, w + aa, abs(d));
    }

    // Line work of one gear: toothed rim, hub, four spokes.
    float gear(vec2 q, float R, float teeth, float phase, float aa) {
      float r = length(q);
      float a = atan(q.y, q.x) + phase;

      float tw = fract(a * teeth / TAU);
      float plateau = smoothstep(0.16, 0.30, tw) * (1.0 - smoothstep(0.70, 0.84, tw));
      float profile = R * (1.0 + 0.12 * plateau);

      float g = stroke(r - profile, 0.0045, aa);

      // Hub.
      g = max(g, stroke(r - R * 0.16, 0.0045, aa));

      // Four spokes between hub and rim.
      float sa = a * 2.0;
      float spoke = stroke(sin(sa) * r, 0.0045, aa * 2.0)
                  * step(R * 0.20, r) * step(r, R * 0.88);
      g = max(g, spoke);

      // Inner rim line.
      g = max(g, stroke(r - R * 0.88, 0.003, aa));

      return g;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      float vel = clamp(abs(uScrollVel), 0.0, 4.0);
      float t = uTime * (0.5 + vel * 0.03);

      vec3 ink   = vec3(0.043, 0.043, 0.051);
      vec3 trace = vec3(0.78, 0.78, 0.74);
      vec3 lime  = vec3(0.784, 0.961, 0.259);

      // The whole movement tilts toward the cursor.
      p = rot(uMouse.x * 0.07) * p;
      float aa = 2.2 / min(uRes.x, uRes.y);

      vec3 col = ink;

      // Bridge plate: two faint structural arcs behind everything.
      float plate = stroke(length(p - vec2(-0.1, -0.5)) - 1.05, 0.002, aa)
                  + stroke(length(p - vec2(0.4, 0.7)) - 0.95, 0.002, aa);
      col += trace * plate * 0.18;

      float bright = 0.55 + 0.45 * uEnergy;

      // Wheel one: the driver.
      vec2 c1 = vec2(-0.42, 0.06);
      float w1 = t * 0.35;
      float g1 = gear(p - c1, 0.34, 12.0, w1, aa);

      // Wheel two meshes with one (ratio 12:8), seated on their line.
      vec2 c2 = c1 + normalize(vec2(1.0, -0.35)) * (0.34 + 0.215 + 0.025);
      float w2 = -w1 * (12.0 / 8.0) + 0.32;
      float g2 = gear(p - c2, 0.215, 8.0, w2, aa);

      // The escape wheel advances one tooth per beat.
      vec2 c3 = c2 + normalize(vec2(0.9, 0.55)) * (0.215 + 0.28 + 0.025);
      float beat = t * 1.5;
      float tick = floor(beat) + smoothstep(0.75, 1.0, fract(beat));
      float w3 = tick * (TAU / 15.0);
      float g3 = gear(p - c3, 0.28, 15.0, -w3, aa);

      float g = max(max(g1, g2), g3);
      col = mix(col, trace, g * bright);

      // Jewels: one lime point at each pivot, glinting on the beat.
      float glint = 0.7 + 0.3 * smoothstep(0.75, 1.0, fract(beat));
      float j = 0.0;
      j = max(j, 1.0 - smoothstep(0.010, 0.018, length(p - c1)));
      j = max(j, 1.0 - smoothstep(0.009, 0.016, length(p - c2)));
      j = max(j, 1.0 - smoothstep(0.010, 0.018, length(p - c3)));
      col = mix(col, lime, j * glint);

      float vig = smoothstep(1.9, 0.45, length(p * vec2(0.85, 1.0)));
      col *= mix(0.6, 1.0, vig);
      col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.022;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
