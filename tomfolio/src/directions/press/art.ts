/**
 * Presswerk dither field.
 *
 * Algorithmic philosophy: a continuous tone field, reproduced the only
 * way a press can: by deciding, dot by dot, ink or no ink. A drifting
 * fbm luminance field is quantized through an ordered 4x4 Bayer matrix
 * at chunky cell size, so the gradient lives entirely in dot density.
 * The cursor presses a highlight into the plate; one aviation-red
 * registration cross holds the corner. Seeded by time alone, tuned so
 * the plate reads as a working proof, not a screensaver.
 */

export const pressFrag = /* glsl */ `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uEnergy;
  uniform float uScrollVel;

  // Editable parameters (defaults reproduce the original plate exactly).
  uniform float uCell;         // cell density divisor
  uniform float uToneBase;     // base luminance of the tone field
  uniform float uToneContrast; // grain contrast
  uniform float uToneScale;    // field scale
  uniform float uDrift;        // drift speed
  uniform float uThreshold;    // dither threshold bias
  uniform float uPress;        // cursor-press strength
  uniform float uPressFalloff; // cursor-press falloff
  uniform float uMotif;        // shape: 0 dots(solid) 1 disc 2 x 3 plus 4 dash
  uniform float uMotifWeight;  // mark thickness / dot radius
  uniform float uMotifAngle;   // rotation of the mark in its cell (0..1 turn)
  uniform float uMotifTone;    // 0 = constant weight, 1 = stroke thickens in darker cells
  uniform float uColorway;     // palette index (see palette block in main)
  uniform float uCrossOn;      // registration cross visible
  uniform float uCrossSize;    // registration cross size
  uniform vec2  uCrossPos;     // registration cross position

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
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return v;
  }

  // 2x2 Bayer cell: (0,0)=0 (1,0)=2 (0,1)=3 (1,1)=1
  float bayer2(vec2 p) {
    return p.x * 2.0 + p.y * 3.0 - p.x * p.y * 4.0;
  }

  // Ordered 4x4 Bayer threshold in [0,1).
  float bayer4(vec2 pix) {
    vec2 p1 = mod(pix, 2.0);
    vec2 p2 = mod(floor(pix / 2.0), 2.0);
    return (bayer2(p1) * 4.0 + bayer2(p2)) / 16.0;
  }

  void main() {
    // Press cells (density editable).
    float cell = max(uRes.y / uCell, 2.0);
    vec2 cellId = floor(gl_FragCoord.xy / cell);
    vec2 local  = fract(gl_FragCoord.xy / cell);
    vec2 p = (cellId * cell * 2.0 - uRes) / min(uRes.x, uRes.y);

    float t = uTime * uDrift;

    // Palette (paper = unlinked stock, ink = the mark, accent = registration).
    // Index order matches the rig's Colorway select.
    vec3 paper  = vec3(0.957, 0.957, 0.941);  // 0 bone / carbon (default)
    vec3 ink    = vec3(0.039, 0.039, 0.039);
    vec3 accent = vec3(0.902, 0.098, 0.098);  // aviation red
    if      (uColorway > 0.5 && uColorway < 1.5) { paper = vec3(0.086,0.227,0.361); ink = vec3(0.863,0.902,0.941); accent = vec3(0.984,0.792,0.310); } // 1 blueprint
    else if (uColorway < 2.5) { paper = vec3(0.910,0.873,0.784); ink = vec3(0.180,0.137,0.090); accent = vec3(0.780,0.180,0.110); } // 2 sepia
    else if (uColorway < 3.5) { paper = vec3(0.082,0.078,0.059); ink = vec3(0.784,0.961,0.259); accent = vec3(0.902,0.098,0.098); } // 3 acid lime
    else if (uColorway < 4.5) { paper = vec3(0.043,0.122,0.180); ink = vec3(0.847,0.910,0.886); accent = vec3(0.957,0.604,0.180); } // 4 cyanotype
    else if (uColorway < 5.5) { paper = vec3(0.961,0.949,0.925); ink = vec3(0.945,0.176,0.451); accent = vec3(0.110,0.110,0.118); } // 5 riso pink
    else if (uColorway < 6.5) { paper = vec3(0.961,0.957,0.933); ink = vec3(0.000,0.267,0.647); accent = vec3(0.945,0.176,0.451); } // 6 riso blue
    else if (uColorway < 7.5) { paper = vec3(0.106,0.118,0.137); ink = vec3(0.722,0.760,0.800); accent = vec3(0.298,0.792,0.886); } // 7 steel
    else if (uColorway < 8.5) { paper = vec3(0.129,0.043,0.051); ink = vec3(0.902,0.871,0.800); accent = vec3(0.851,0.200,0.149); } // 8 oxblood
    else if (uColorway < 9.5) { paper = vec3(0.043,0.043,0.047); ink = vec3(0.953,0.949,0.937); accent = vec3(0.902,0.098,0.098); } // 9 mono invert
    else if (uColorway > 9.5) { paper = vec3(0.255,0.235,0.314); ink = vec3(0.957,0.937,0.867); accent = vec3(0.776,0.553,0.604); } // 10 heather (gray-purple / cream)

    // Tone field: diagonal wash plus drifting grain.
    float lum = uToneBase + uToneContrast * fbm(p * uToneScale + vec2(t * 0.5, -t * 0.3));
    lum += 0.22 * smoothstep(-1.2, 1.2, dot(p, vec2(0.5, 0.85)));

    // The cursor presses a highlight into the plate.
    float md = length(p - uMouse);
    lum += uPress * uMouseStrength * exp(-md * uPressFalloff);

    // Energy is press pressure: contrast around the midpoint.
    lum = 0.5 + (lum - 0.5) * (0.75 + 0.55 * uEnergy);
    lum += clamp(uScrollVel, -4.0, 4.0) * 0.01;

    // The decision: ink or no ink (ordered Bayer threshold).
    float threshold = bayer4(cellId) + uThreshold;
    float on = step(threshold, clamp(lum, 0.0, 1.0)); // 1 = paper, 0 = ink

    // Mark motif: how an inked cell is drawn (0 solid, 1 x, 2 lines).
    // Anti-aliased; stroke weight optionally thickens with cell darkness (uMotifTone).
    float aa   = clamp(0.9 / cell, 0.001, 0.25);
    float dk   = 1.0 - clamp(lum, 0.0, 1.0);
    float wEff = clamp(uMotifWeight, 0.05, 1.0) * 0.5 * (1.0 + uMotifTone * (1.6 * dk - 0.8));
    wEff = clamp(wEff, 0.0, 0.5);

    // Each mark is a distance field tested against wEff: measure a distance
    // from the mark's geometry, ink where it is < wEff, smoothstep across ~1px
    // (aa) to anti-alias. uMotifAngle rotates the cell-local frame so any mark
    // can be spun (a dash becomes a vertical rule, an X becomes a plus, ...).
    vec2  lc  = local - 0.5;                              // cell-local, centered
    float ang = uMotifAngle * 6.2831853;
    float cs  = cos(ang), sn = sin(ang);
    lc = mat2(cs, -sn, sn, cs) * lc;
    vec2  rl = lc + 0.5;

    float rad = length(lc);                              // round dot
    float dia = abs(rl.x - rl.y) * 0.7071;              // main diagonal
    float dib = abs(rl.x + rl.y - 1.0) * 0.7071;        // anti-diagonal
    float dax = abs(lc.x);                              // vertical centerline
    float day = abs(lc.y);                              // horizontal centerline

    float mDisc = 1.0 - smoothstep(wEff - aa, wEff + aa, rad);
    float mX    = 1.0 - smoothstep(wEff - aa, wEff + aa, min(dia, dib));
    float mPlus = 1.0 - smoothstep(wEff - aa, wEff + aa, min(dax, day));
    float mDash = 1.0 - smoothstep(wEff - aa, wEff + aa, day);

    // 0 dots(solid) 1 disc 2 x 3 plus 4 dash
    float motif = 1.0;
    if      (uMotif > 0.5 && uMotif < 1.5) motif = mDisc;
    else if (uMotif < 2.5)                 motif = mX;
    else if (uMotif < 3.5)                 motif = mPlus;
    else if (uMotif > 3.5)                 motif = mDash;

    float inkAmt = (1.0 - on) * motif;
    vec3 col = mix(paper, ink, inkAmt);

    // Aviation-red registration cross (position / size / visibility editable).
    vec2 cd = abs(p - uCrossPos);
    float cross = uCrossOn * step(min(cd.x, cd.y), 0.006) * step(max(cd.x, cd.y), uCrossSize);
    col = mix(col, accent, cross);

    gl_FragColor = vec4(col, 1.0);
  }
`;
