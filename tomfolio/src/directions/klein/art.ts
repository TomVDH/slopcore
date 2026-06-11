/**
 * Bleu dot lattice.
 *
 * Algorithmic philosophy: a perfect grid of white points on a field of
 * one blue, and a single optical disturbance: the cursor carries a
 * lens that magnifies the lattice it passes over, the way a loupe
 * slides across a printed sheet. One white bar sweeps the field as the
 * reader travels the page, marking progress the modernist way: with a
 * rule, not a number. Nothing else moves. Restraint is the algorithm.
 */

export const kleinFrag = /* glsl */ `
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

    vec3 blue  = vec3(0.043, 0.153, 0.839);
    vec3 deep  = vec3(0.031, 0.110, 0.682);
    vec3 white = vec3(0.965, 0.969, 0.984);

    // The field deepens a little toward the edges.
    float vig = smoothstep(1.9, 0.4, length(p * vec2(0.85, 1.0)));
    vec3 col = mix(deep, blue, vig);

    // The loupe: lattice space bulges gently around the cursor.
    float md = length(p - uMouse);
    float lens = exp(-md * 1.9);
    vec2 q = uMouse + (p - uMouse) * (1.0 - 0.18 * lens);

    // The lattice.
    float cells = 13.0;
    vec2 g = q * cells;
    vec2 cell = fract(g) - 0.5;
    float d = length(cell);

    float aa = cells * 2.0 / min(uRes.x, uRes.y);
    float baseR = 0.085;
    float r = baseR * (1.0 + 1.3 * lens * (0.4 + 0.6 * uMouseStrength));
    float dot_ = 1.0 - smoothstep(r - aa, r + aa, d);

    float brightness = 0.34 + 0.5 * lens;
    // The lattice breathes once a minute, almost imperceptibly.
    brightness *= 0.96 + 0.04 * sin(uTime * 0.1 + (q.x + q.y) * 0.8);
    col = mix(col, white, dot_ * brightness);

    // The sweep: one white rule crossing the field with scroll progress.
    float sweepX = mix(-1.55, 1.55, clamp(uEnergy, 0.0, 1.0));
    float bar = 1.0 - smoothstep(0.012, 0.02, abs(p.x - sweepX));
    float wash = exp(-abs(p.x - sweepX) * 9.0);
    col = mix(col, white, bar * 0.5);
    col += white * wash * 0.05;

    // Scroll velocity stirs the lattice brightness a breath.
    col += white * dot_ * clamp(abs(uScrollVel), 0.0, 4.0) * 0.008;

    col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(13.7, 71.3)) - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`;
