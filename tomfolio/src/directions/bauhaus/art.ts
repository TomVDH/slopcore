/**
 * Toolhaus primitive ballet.
 *
 * Algorithmic philosophy: a poster that refuses to sit still. Seven
 * primitives, circle, bar, square, semicircle, hold a composition on
 * warm paper and drift through it on slow individual orbits, each
 * rotating at its own patient rate. The arrangement is anchored, the
 * motion is the choreography between anchors. The cursor is a guest
 * the shapes politely lean toward. Three pigments and ink, hard edges,
 * no gradients: geometry does all the talking.
 */

export const bauhausFrag = /* glsl */ `
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

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  float sdSemi(vec2 p, float r) {
    return max(length(p) - r, p.y);
  }

  // Drift: each shape orbits its anchor and leans toward the cursor.
  vec2 anchor(vec2 base, float seed, float t, vec2 mouse, float lean) {
    vec2 orbit = vec2(
      sin(t * (0.21 + seed * 0.07) + seed * 11.0),
      cos(t * (0.17 + seed * 0.05) + seed * 7.0)
    ) * 0.045;
    vec2 toMouse = (mouse - base) * 0.04 * lean;
    return base + orbit + toMouse;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
    float vel = clamp(abs(uScrollVel), 0.0, 4.0);
    float t = uTime * (0.5 + 0.3 * uEnergy) + vel * 0.015;
    float lean = 0.5 + 0.5 * uMouseStrength;

    vec3 paper  = vec3(0.961, 0.949, 0.918);
    vec3 ink    = vec3(0.078, 0.075, 0.059);
    vec3 red    = vec3(0.824, 0.212, 0.169);
    vec3 blue   = vec3(0.122, 0.290, 0.722);
    vec3 yellow = vec3(0.910, 0.690, 0.133);

    // Paper with the faintest tooth.
    vec3 col = paper * (0.985 + 0.025 * hash(floor(p * 220.0)));

    float aa = 3.0 / min(uRes.x, uRes.y);

    // Painter's order, back to front.

    // Big yellow circle, upper right.
    vec2 c1 = anchor(vec2(0.62, 0.34), 1.0, t, uMouse, lean);
    float d1 = sdCircle(p - c1, 0.34);
    col = mix(col, yellow, 1.0 - smoothstep(-aa, aa, d1));

    // Ink ring around it, offset: the registration slip.
    float d1r = abs(sdCircle(p - c1 - vec2(0.035, -0.025), 0.34)) - 0.006;
    col = mix(col, ink, (1.0 - smoothstep(-aa, aa, d1r)) * 0.85);

    // Cobalt long bar, diagonal through the lower field.
    vec2 c2 = anchor(vec2(-0.25, -0.30), 2.0, t, uMouse, lean);
    vec2 p2 = rot(0.42 + 0.03 * sin(t * 0.23)) * (p - c2);
    float d2 = sdBox(p2, vec2(0.58, 0.045));
    col = mix(col, blue, 1.0 - smoothstep(-aa, aa, d2));

    // Red square, mid left, slowly turning.
    vec2 c3 = anchor(vec2(-0.62, 0.22), 3.0, t, uMouse, lean);
    vec2 p3 = rot(t * 0.11 + 0.6) * (p - c3);
    float d3 = sdBox(p3, vec2(0.16, 0.16));
    col = mix(col, red, 1.0 - smoothstep(-aa, aa, d3));

    // Ink semicircle, resting low center.
    vec2 c4 = anchor(vec2(0.12, -0.52), 4.0, t, uMouse, lean);
    vec2 p4 = rot(0.08 * sin(t * 0.19 + 2.0)) * (p - c4);
    float d4 = sdSemi(p4, 0.20);
    col = mix(col, ink, 1.0 - smoothstep(-aa, aa, d4));

    // Small red circle riding high left.
    vec2 c5 = anchor(vec2(-0.30, 0.58), 5.0, t, uMouse, lean);
    float d5 = sdCircle(p - c5, 0.075);
    col = mix(col, red, 1.0 - smoothstep(-aa, aa, d5));

    // Thin ink bar, vertical, right of center.
    vec2 c6 = anchor(vec2(0.30, -0.06), 6.0, t, uMouse, lean);
    vec2 p6 = rot(-0.18 + 0.02 * sin(t * 0.31)) * (p - c6);
    float d6 = sdBox(p6, vec2(0.018, 0.42));
    col = mix(col, ink, 1.0 - smoothstep(-aa, aa, d6));

    // Small yellow square, lower right, the counterweight.
    vec2 c7 = anchor(vec2(0.78, -0.40), 7.0, t, uMouse, lean);
    vec2 p7 = rot(0.5 + t * 0.07) * (p - c7);
    float d7 = sdBox(p7, vec2(0.07, 0.07));
    col = mix(col, yellow, 1.0 - smoothstep(-aa, aa, d7));

    gl_FragColor = vec4(col, 1.0);
  }
`;
