/**
 * Presswerk dither field.
 *
 * Algorithmic philosophy: a continuous tone field, reproduced the only
 * way a press can: by deciding, dot by dot, ink or no ink. A drifting
 * fbm luminance field is quantized through an ordered 4x4 Bayer matrix
 * at chunky cell size, so the gradient lives entirely in dot density.
 * The tone source is either that field or a sampled image (uImageOn) the
 * dither engine treats identically, so the plate doubles as a halftone
 * printer for photos. The cursor presses a highlight into the plate; one
 * aviation-red registration cross holds the corner. Tuned so the plate
 * reads as a working proof, not a screensaver.
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
  uniform float uPress;        // cursor-press strength (legacy; kept for back-compat)
  uniform float uPressFalloff; // cursor-press falloff (legacy)
  uniform float uCursorMode;   // 0 off, 1 clear, 2 ink, 3 bias, 4 negative, 5 develop
  uniform float uCursorAmp;    // cursor effect strength
  uniform float uCursorRadius; // cursor disc falloff rate (larger = tighter)
  uniform float uHold;         // static floor under the decaying cursor strength
  uniform float uCursorEdge;   // negative-mode disc hardness
  uniform float uDevFine;      // develop-mode cell multiplier (sub-grid = cell / uDevFine)
  uniform float uDevColor;     // develop: 1 resolve to true-colour photo, 0 stay monotone
  uniform float uMotif;        // shape: 0 dots(solid) 1 disc 2 x 3 plus 4 dash
  uniform float uMotifWeight;  // mark thickness / dot radius
  uniform float uMotifAngle;   // rotation of the mark in its cell (0..1 turn)
  uniform float uMotifTone;    // 0 = constant weight, 1 = stroke thickens in darker cells
  uniform float uColorway;     // palette index (see palette block in main)
  uniform float uCrossOn;      // registration cross visible
  uniform float uCrossSize;    // registration cross size
  uniform vec2  uCrossPos;     // registration cross position
  uniform sampler2D uImage;    // source image to dither (when uImageOn > 0.5)
  uniform float uImageOn;      // 0 procedural tone field, 1 dither the image
  uniform vec2  uImageRes;     // source image pixel size, for cover-fit aspect
  uniform sampler2D uImage2;   // second image slot, for image->image crossfade
  uniform vec2  uImage2Res;    // second image pixel size
  uniform float uXfade;        // 0 sample uImage, 1 sample uImage2 (no field dip)
  uniform float uImageState;   // dev: show the adjusted continuous-tone source, undithered
  uniform float uInvert;          // 0 normal, 1 invert tone polarity (ink <-> paper)
  uniform float uImageBrightness; // added to the sampled image luminance
  uniform float uImageContrast;   // contrast of the sampled image around mid-grey
  uniform float uFadeMode;        // 0 off, 1 simple radial gradient, 2 cloud (fbm-textured)
  uniform float uFadeScale;       // cloud-noise frequency for fade mode 2 (smaller = bigger billows)
  uniform float uReveal;          // 0 dithered, 1 full-res photo; crossfades the dither -> source
  uniform float uColorDither;     // 0 duotone (paper/ink), 1 full-colour ordered dither of the photo
  uniform float uColorLevels;     // posterise steps per RGB channel in colour mode (2 = heavy dither)

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
    if      (uColorway < 0.5) {} // 0 bone — keeps the defaults set above (was falling through to sepia)
    else if (uColorway < 1.5) { paper = vec3(0.086,0.227,0.361); ink = vec3(0.863,0.902,0.941); accent = vec3(0.984,0.792,0.310); } // 1 blueprint
    else if (uColorway < 2.5) { paper = vec3(0.910,0.873,0.784); ink = vec3(0.180,0.137,0.090); accent = vec3(0.780,0.180,0.110); } // 2 sepia
    else if (uColorway < 3.5) { paper = vec3(0.082,0.078,0.059); ink = vec3(0.784,0.961,0.259); accent = vec3(0.902,0.098,0.098); } // 3 acid lime
    else if (uColorway < 4.5) { paper = vec3(0.043,0.122,0.180); ink = vec3(0.847,0.910,0.886); accent = vec3(0.957,0.604,0.180); } // 4 cyanotype
    else if (uColorway < 5.5) { paper = vec3(0.961,0.949,0.925); ink = vec3(0.945,0.176,0.451); accent = vec3(0.110,0.110,0.118); } // 5 riso pink
    else if (uColorway < 6.5) { paper = vec3(0.961,0.957,0.933); ink = vec3(0.000,0.267,0.647); accent = vec3(0.945,0.176,0.451); } // 6 riso blue
    else if (uColorway < 7.5) { paper = vec3(0.106,0.118,0.137); ink = vec3(0.722,0.760,0.800); accent = vec3(0.298,0.792,0.886); } // 7 steel
    else if (uColorway < 8.5) { paper = vec3(0.129,0.043,0.051); ink = vec3(0.902,0.871,0.800); accent = vec3(0.851,0.200,0.149); } // 8 oxblood
    else if (uColorway < 9.5) { paper = vec3(0.043,0.043,0.047); ink = vec3(0.953,0.949,0.937); accent = vec3(0.902,0.098,0.098); } // 9 mono invert
    else if (uColorway < 10.5) { paper = vec3(0.165,0.149,0.212); ink = vec3(0.957,0.937,0.867); accent = vec3(0.776,0.553,0.604); } // 10 heather (deep gray-purple / cream)
    else if (uColorway < 11.5) { paper = vec3(0.031,0.031,0.039); ink = vec3(0.910,0.910,0.918); accent = vec3(1.000,0.231,0.188); } // 11 noir
    else if (uColorway < 12.5) { paper = vec3(0.851,0.831,0.780); ink = vec3(0.102,0.098,0.086); accent = vec3(0.541,0.169,0.122); } // 12 newsprint
    else if (uColorway < 13.5) { paper = vec3(0.016,0.071,0.039); ink = vec3(0.235,1.000,0.478); accent = vec3(0.839,1.000,0.000); } // 13 terminal
    else if (uColorway < 14.5) { paper = vec3(0.063,0.039,0.008); ink = vec3(1.000,0.690,0.000); accent = vec3(1.000,0.369,0.227); } // 14 amber crt
    else if (uColorway < 15.5) { paper = vec3(0.769,0.812,0.631); ink = vec3(0.118,0.176,0.102); accent = vec3(0.353,0.478,0.227); } // 15 gameboy
    else if (uColorway < 16.5) { paper = vec3(0.071,0.039,0.141); ink = vec3(0.851,0.761,1.000); accent = vec3(1.000,0.353,0.851); } // 16 ultraviolet
    else if (uColorway < 17.5) { paper = vec3(0.027,0.192,0.184); ink = vec3(0.843,0.941,0.918); accent = vec3(1.000,0.478,0.349); } // 17 lagoon
    else if (uColorway < 18.5) { paper = vec3(0.102,0.078,0.027); ink = vec3(1.000,0.824,0.290); accent = vec3(1.000,0.478,0.000); } // 18 marigold
    else if (uColorway < 19.5) { paper = vec3(0.078,0.090,0.102); ink = vec3(0.749,0.914,0.816); accent = vec3(0.212,0.878,0.627); } // 19 mint iron
    else if (uColorway < 20.5) { paper = vec3(0.169,0.078,0.188); ink = vec3(0.941,0.886,0.816); accent = vec3(0.906,0.635,0.235); } // 20 plum
    else if (uColorway < 21.5) { paper = vec3(0.110,0.145,0.188); ink = vec3(0.902,0.941,0.969); accent = vec3(0.353,0.820,1.000); } // 21 slate ice
    else if (uColorway < 22.5) { paper = vec3(0.941,0.890,0.812); ink = vec3(0.353,0.141,0.063); accent = vec3(0.761,0.286,0.114); } // 22 rust sand
    else if (uColorway < 23.5) { paper = vec3(0.059,0.075,0.251); ink = vec3(0.910,0.902,1.000); accent = vec3(1.000,0.824,0.247); } // 23 indigo sun
    else if (uColorway < 24.5) { paper = vec3(0.031, 0.075, 0.055); ink = vec3(0.204, 0.91, 0.62); accent = vec3(0.949, 0.788, 0.298); } // 24 emerald
    else if (uColorway < 25.5) { paper = vec3(0.102, 0.02, 0.031); ink = vec3(1.0, 0.302, 0.427); accent = vec3(1.0, 0.839, 0.647); } // 25 ruby
    else if (uColorway < 26.5) { paper = vec3(0.02, 0.043, 0.102); ink = vec3(0.302, 0.541, 1.0); accent = vec3(0.878, 0.984, 0.988); } // 26 sapphire
    else if (uColorway < 27.5) { paper = vec3(0.078, 0.039, 0.122); ink = vec3(0.78, 0.49, 1.0); accent = vec3(0.502, 1.0, 0.859); } // 27 amethyst
    else if (uColorway < 28.5) { paper = vec3(0.102, 0.075, 0.012); ink = vec3(1.0, 0.839, 0.039); accent = vec3(1.0, 0.482, 0.0); } // 28 topaz
    else if (uColorway < 29.5) { paper = vec3(0.024, 0.078, 0.059); ink = vec3(0.0, 0.788, 0.655); accent = vec3(0.965, 0.969, 0.843); } // 29 jade
    else if (uColorway < 30.5) { paper = vec3(1.0, 0.941, 0.965); ink = vec3(1.0, 0.18, 0.533); accent = vec3(0.227, 0.718, 0.949); } // 30 bubblegum
    else if (uColorway < 31.5) { paper = vec3(0.925, 1.0, 0.965); ink = vec3(0.055, 0.62, 0.408); accent = vec3(1.0, 0.365, 0.561); } // 31 mint cream
    else if (uColorway < 32.5) { paper = vec3(1.0, 0.984, 0.902); ink = vec3(0.176, 0.165, 0.141); accent = vec3(0.957, 0.635, 0.349); } // 32 butter
    else if (uColorway < 33.5) { paper = vec3(0.937, 0.945, 1.0); ink = vec3(0.227, 0.2, 0.753); accent = vec3(1.0, 0.478, 0.659); } // 33 periwinkle
    else if (uColorway < 34.5) { paper = vec3(1.0, 0.933, 0.886); ink = vec3(0.698, 0.227, 0.118); accent = vec3(0.122, 0.62, 0.561); } // 34 peach
    else if (uColorway < 35.5) { paper = vec3(0.961, 0.941, 1.0); ink = vec3(0.427, 0.157, 0.851); accent = vec3(0.169, 0.831, 0.627); } // 35 lilac
    else if (uColorway < 36.5) { paper = vec3(0.039, 0.024, 0.063); ink = vec3(1.0, 0.18, 0.769); accent = vec3(0.0, 0.941, 1.0); } // 36 hot pink
    else if (uColorway < 37.5) { paper = vec3(0.016, 0.035, 0.047); ink = vec3(0.098, 0.969, 0.969); accent = vec3(1.0, 0.235, 0.675); } // 37 cyber
    else if (uColorway < 38.5) { paper = vec3(0.043, 0.055, 0.016); ink = vec3(0.776, 1.0, 0.0); accent = vec3(1.0, 0.0, 0.549); } // 38 volt
    else if (uColorway < 39.5) { paper = vec3(0.063, 0.024, 0.016); ink = vec3(1.0, 0.353, 0.0); accent = vec3(1.0, 0.816, 0.0); } // 39 laser
    else if (uColorway < 40.5) { paper = vec3(0.012, 0.02, 0.102); ink = vec3(0.227, 0.525, 1.0); accent = vec3(1.0, 0.745, 0.043); } // 40 electric
    else if (uColorway < 41.5) { paper = vec3(0.078, 0.094, 0.051); ink = vec3(0.773, 0.847, 0.427); accent = vec3(0.878, 0.478, 0.373); } // 41 moss
    else if (uColorway < 42.5) { paper = vec3(0.906, 0.843, 0.761); ink = vec3(0.353, 0.243, 0.169); accent = vec3(0.737, 0.294, 0.165); } // 42 clay
    else if (uColorway < 43.5) { paper = vec3(0.11, 0.078, 0.008); ink = vec3(0.957, 0.706, 0.0); accent = vec3(0.886, 0.447, 0.357); } // 43 saffron
    else if (uColorway < 44.5) { paper = vec3(0.047, 0.102, 0.071); ink = vec3(0.533, 0.831, 0.596); accent = vec3(0.949, 0.757, 0.306); } // 44 fernway
    else if (uColorway < 45.5) { paper = vec3(0.925, 0.878, 0.784); ink = vec3(0.42, 0.227, 0.18); accent = vec3(0.29, 0.486, 0.349); } // 45 dune
    else if (uColorway < 46.5) { paper = vec3(0.051, 0.106, 0.165); ink = vec3(1.0, 0.416, 0.835); accent = vec3(0.255, 0.918, 0.831); } // 46 miami
    else if (uColorway < 47.5) { paper = vec3(0.102, 0.043, 0.18); ink = vec3(1.0, 0.443, 0.808); accent = vec3(0.004, 0.804, 0.996); } // 47 vaporwave
    else if (uColorway < 48.5) { paper = vec3(0.043, 0.047, 0.063); ink = vec3(0.773, 0.776, 0.78); accent = vec3(0.4, 0.988, 0.945); } // 48 chrome
    else if (uColorway < 49.5) { paper = vec3(0.086, 0.059, 0.161); ink = vec3(1.0, 0.62, 0.392); accent = vec3(0.969, 0.145, 0.522); } // 49 dusk grid
    else if (uColorway < 50.5) { paper = vec3(0.0, 0.2, 0.627); ink = vec3(1.0, 0.89, 0.847); accent = vec3(1.0, 0.361, 0.286); } // 50 cobalt
    else if (uColorway < 51.5) { paper = vec3(0.063, 0.165, 0.11); ink = vec3(0.918, 1.0, 0.235); accent = vec3(1.0, 0.549, 0.259); } // 51 forest lemon
    else if (uColorway < 52.5) { paper = vec3(0.169, 0.039, 0.039); ink = vec3(0.961, 0.776, 0.69); accent = vec3(1.0, 0.231, 0.122); } // 52 oxide
    else if (uColorway < 53.5) { paper = vec3(0.039, 0.071, 0.78); ink = vec3(0.965, 0.969, 0.984); accent = vec3(1.0, 0.91, 0.0); } // 53 klein pop

    // Tone source: crossfade the procedural field and a sampled image by
    // uImageOn (0 field, 1 image). Animating uImageOn lets the dots flow
    // from the drifting field into a photo (particles forming an image).
    float field = uToneBase + uToneContrast * fbm(p * uToneScale + vec2(t * 0.5, -t * 0.3));
    field += 0.22 * smoothstep(-1.2, 1.2, dot(p, vec2(0.5, 0.85)));

    // Sample at the cell center, cover-fitting each image to the plate so it
    // fills without distortion (crop the overflowing dimension). Both slots are
    // sampled and blended by uXfade, so an image->image swap crossfades directly
    // with no procedural-field flash in between.
    vec2 baseUv = (cellId + 0.5) * cell / uRes;
    float plateA = uRes.x / uRes.y;
    float imgA0 = uImageRes.x / max(uImageRes.y, 1.0);
    vec2 isc0 = imgA0 > plateA ? vec2(plateA / imgA0, 1.0) : vec2(1.0, imgA0 / plateA);
    vec2 iuv = (baseUv - 0.5) * isc0 + 0.5;
    float imgA1 = uImage2Res.x / max(uImage2Res.y, 1.0);
    vec2 isc1 = imgA1 > plateA ? vec2(plateA / imgA1, 1.0) : vec2(1.0, imgA1 / plateA);
    vec2 iuv2 = (baseUv - 0.5) * isc1 + 0.5;
    vec3 imgRGB = mix(texture2D(uImage, iuv).rgb, texture2D(uImage2, iuv2).rgb, clamp(uXfade, 0.0, 1.0));
    float img = dot(imgRGB, vec3(0.299, 0.587, 0.114));
    img = clamp((img - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);

    // Polarity invert is manual (uInvert): on a dark-paper stock a natural photo
    // reads as a negative until you toggle Invert. Applies to the field + image
    // tone together.
    float lum = mix(field, img, clamp(uImageOn, 0.0, 1.0));
    lum = mix(lum, 1.0 - lum, uInvert);

    // The interactive cursor. One shared local-influence scalar (infl) (a soft
    // disc of cursor energy) drives every mode; it is built only from p (one
    // value per cell, never local/gl_FragCoord), so a whole cell agrees and the
    // marks reorganize under the pointer instead of shattering. uHold is a
    // static floor so the effect can persist while the pointer is still.
    float md = length(p - uMouse);
    float infl = max(uMouseStrength, uHold) * exp(-md * uCursorRadius);
    if (uCursorMode > 0.5 && uCursorMode < 1.5) {
      lum += uCursorAmp * infl;            // Clear: lift ink, open paper
    } else if (uCursorMode > 1.5 && uCursorMode < 2.5) {
      lum -= uCursorAmp * infl;            // Ink: press ink in (tone half; weight below)
    } else if (uCursorMode > 3.5 && uCursorMode < 4.5) {
      float flip = smoothstep(uCursorEdge, uCursorEdge + 0.12, infl);
      lum = mix(lum, 1.0 - lum, flip);     // Negative: local polarity flip
    }

    // Energy is press pressure: contrast around the midpoint.
    lum = 0.5 + (lum - 0.5) * (0.75 + 0.55 * uEnergy);
    lum += clamp(uScrollVel, -4.0, 4.0) * 0.01;

    // Edge dissolve. The marks fade toward the ground from the near
    // (bottom-left) corner outward. uFadeMode: 0 off (full-bleed); 1 simple
    // radial gradient; 2 cloud — the boundary is perturbed by a slowly drifting
    // fbm at uFadeScale, so it reads wispy and alive. (An image-endemic "blob"
    // mask lived here briefly; reverted to this cloud while we work out a more
    // graceful organic edge for dithered photos.) Mode 0 leaves the
    // letterpress / rig plates untouched.
    float cov = 1.0;
    if (uFadeMode > 0.5) {
      vec2 cuv = (cellId + 0.5) * cell / uRes;
      vec2 fq  = vec2(cuv.x * uRes.x / max(uRes.y, 1.0), cuv.y);
      float fd = length(fq);
      if (uFadeMode > 1.5) {
        fd += (fbm(cuv * uFadeScale + vec2(t * 0.6, -t * 0.4)) - 0.5) * 0.95;
      }
      cov = 1.0 - smoothstep(0.3, 1.45, fd);
    }

    // The decision: ink or no ink (ordered Bayer threshold).
    // Bias (cursor mode 3): rub the ordered-dither threshold locally so marks
    // fill in/clear in the plate's own Bayer order, not as a smooth tonal disc.
    float threshold = bayer4(cellId) + uThreshold
      - ((uCursorMode > 2.5 && uCursorMode < 3.5) ? 0.6 * uCursorAmp * infl : 0.0);
    float on = step(threshold, clamp(lum, 0.0, 1.0)); // 1 = paper, 0 = ink

    // Mark motif: how an inked cell is drawn (0 solid, 1 x, 2 lines).
    // Anti-aliased; stroke weight optionally thickens with cell darkness (uMotifTone).
    float aa   = clamp(0.9 / cell, 0.001, 0.25);
    float dk   = 1.0 - clamp(lum, 0.0, 1.0);
    float wEff = clamp(uMotifWeight, 0.05, 1.0) * 0.5 * (1.0 + uMotifTone * (1.6 * dk - 0.8));
    wEff = clamp(wEff, 0.0, 0.5);
    // Ink (cursor mode 2): thicken the mark under the pointer (re-clamp is
    // mandatory so the grid spacing is preserved).
    if (uCursorMode > 1.5 && uCursorMode < 2.5) {
      wEff = clamp(wEff + 0.30 * infl, 0.0, 0.5);
    }

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
    vec3 col;
    if (uColorDither > 0.5 && uImageOn > 0.5) {
      // Full-colour ordered dither: the mark carries the image's actual RGB,
      // posterised per channel with the cell's Bayer value so it still reads as
      // a dither. Solid motif -> full-colour field; disc/X/etc -> colour halftone
      // marks. The colorway's paper stays the ground between marks.
      vec3 src = clamp((imgRGB - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
      src = mix(src, 1.0 - src, uInvert);
      float L = max(uColorLevels, 2.0);
      vec3 q = floor(src * (L - 1.0) + bayer4(cellId)) / (L - 1.0);
      col = mix(paper, q, motif);
    } else {
      col = mix(paper, ink, inkAmt);
    }
    col = mix(paper, col, cov); // organic cloud fade of the marks into the ground

    // Aviation-red registration cross (position / size / visibility editable).
    vec2 cd = abs(p - uCrossPos);
    float cross = uCrossOn * step(min(cd.x, cd.y), 0.006) * step(max(cd.x, cd.y), uCrossSize);
    col = mix(col, accent, cross);

    // Reveal / Develop. Global Reveal (uReveal) resolves the whole plate to the
    // full-res photo in NATURAL light (true source, no invert/brightness/contrast)
    // so it never passes through a negative. Develop (cursor mode 5) does the same
    // locally under the pointer AND first raises the cell count there: a finer
    // sub-dither blends in as you press, then resolves to the photo. The sub-grid
    // is a clean uniform divisor of gl_FragCoord (cell / 3) — every fragment in a
    // cell agrees, so the finer marks stay crisp and never shatter.
    float localRev = (uCursorMode > 4.5 && uCursorMode < 5.5)
      ? clamp(uCursorAmp * infl, 0.0, 1.0) : 0.0;

    if (localRev > 0.001 && uImageOn > 0.5) {
      float fcell = max(cell / max(uDevFine, 1.0), 2.0);
      vec2 fId = floor(gl_FragCoord.xy / fcell);
      vec2 fLocal = fract(gl_FragCoord.xy / fcell);
      vec2 fBase = (fId + 0.5) * fcell / uRes;
      vec3 fRGB = mix(texture2D(uImage, (fBase - 0.5) * isc0 + 0.5).rgb,
                      texture2D(uImage2, (fBase - 0.5) * isc1 + 0.5).rgb,
                      clamp(uXfade, 0.0, 1.0));
      float faa = clamp(0.9 / fcell, 0.001, 0.25);
      vec2 flc = fLocal - 0.5;
      float fang = uMotifAngle * 6.2831853;
      float fcs = cos(fang), fsn = sin(fang);
      flc = mat2(fcs, -fsn, fsn, fcs) * flc;
      vec2 frl = flc + 0.5;
      float fDisc = 1.0 - smoothstep(wEff - faa, wEff + faa, length(flc));
      float fX    = 1.0 - smoothstep(wEff - faa, wEff + faa, min(abs(frl.x - frl.y), abs(frl.x + frl.y - 1.0)) * 0.7071);
      float fPlus = 1.0 - smoothstep(wEff - faa, wEff + faa, min(abs(flc.x), abs(flc.y)));
      float fDash = 1.0 - smoothstep(wEff - faa, wEff + faa, abs(flc.y));
      float fmotif = 1.0;
      if      (uMotif > 0.5 && uMotif < 1.5) fmotif = fDisc;
      else if (uMotif < 2.5)                 fmotif = fX;
      else if (uMotif < 3.5)                 fmotif = fPlus;
      else if (uMotif > 3.5)                 fmotif = fDash;
      vec3 fineCol;
      if (uColorDither > 0.5) {
        vec3 fsrc = clamp((fRGB - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
        fsrc = mix(fsrc, 1.0 - fsrc, uInvert);
        float fL = max(uColorLevels, 2.0);
        vec3 fq = floor(fsrc * (fL - 1.0) + bayer4(fId)) / (fL - 1.0);
        fineCol = mix(paper, fq, fmotif);
      } else {
        float fLum = dot(fRGB, vec3(0.299, 0.587, 0.114));
        fLum = clamp((fLum - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
        fLum = mix(fLum, 1.0 - fLum, uInvert);
        float fon = step(bayer4(fId) + uThreshold, clamp(fLum, 0.0, 1.0));
        fineCol = mix(paper, ink, (1.0 - fon) * fmotif);
      }
      col = mix(col, fineCol, smoothstep(0.04, 0.55, localRev)); // marks refine first
    }

    // Resolve to the true-colour photo: the global Reveal always does; Develop
    // does only when Colorize is on (uDevColor) — otherwise it stays monotone
    // (just the finer sub-dither in the palette's own colours).
    float devPhoto = (uDevColor > 0.5) ? smoothstep(0.45, 1.0, localRev) : 0.0;
    float photoT = max(clamp(uReveal, 0.0, 1.0), devPhoto);
    if (photoT > 0.001 && uImageOn > 0.5) {
      col = mix(col, clamp(imgRGB, 0.0, 1.0), photoT);
    }

    // Image state (dev): the continuous-tone source the dither reads — current
    // brightness / contrast / invert applied (colour shows RGB, duotone shows the
    // luminance the screen reads), but NOT dithered or dissolved.
    if (uImageState > 0.5 && uImageOn > 0.5) {
      vec3 s = clamp((imgRGB - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
      if (uColorDither > 0.5) {
        col = mix(s, 1.0 - s, uInvert);
      } else {
        float sl = dot(s, vec3(0.299, 0.587, 0.114));
        col = vec3(mix(sl, 1.0 - sl, uInvert));
      }
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * The same palettes the shader's `uColorway` switch uses, as CSS colors, so a
 * page's chrome (ground, text, accent) can follow the colorway. Index order
 * matches the palette block in pressFrag's main() and the rig's Colorway
 * select — KEEP ALL THREE IN LOCKSTEP.
 */
export interface Palette {
  paper: string;
  ink: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { paper: "#f4f4f0", ink: "#0a0a0a", accent: "#e61919" }, // 0  Bone / Carbon
  { paper: "#163a5c", ink: "#dce6f0", accent: "#fbca4f" }, // 1  Blueprint
  { paper: "#e8dfc8", ink: "#2e2317", accent: "#c72e1c" }, // 2  Sepia
  { paper: "#15140f", ink: "#c8f542", accent: "#e61919" }, // 3  Acid Lime
  { paper: "#0b1f2e", ink: "#d8e8e2", accent: "#f49a2e" }, // 4  Cyanotype
  { paper: "#f5f2ec", ink: "#f12d73", accent: "#1c1c1e" }, // 5  Riso Pink
  { paper: "#f5f4ee", ink: "#0044a5", accent: "#f12d73" }, // 6  Riso Blue
  { paper: "#1b1e23", ink: "#b8c2cc", accent: "#4ccae2" }, // 7  Steel
  { paper: "#210b0d", ink: "#e6decc", accent: "#d93326" }, // 8  Oxblood
  { paper: "#0b0b0c", ink: "#f3f2ef", accent: "#e61919" }, // 9  Mono Invert
  { paper: "#2a2636", ink: "#f4efdd", accent: "#c68d9a" }, // 10 Heather
  { paper: "#08080a", ink: "#e8e8ea", accent: "#ff3b30" }, // 11 Noir
  { paper: "#d9d4c7", ink: "#1a1916", accent: "#8a2b1f" }, // 12 Newsprint
  { paper: "#04120a", ink: "#3cff7a", accent: "#d6ff00" }, // 13 Terminal
  { paper: "#100a02", ink: "#ffb000", accent: "#ff5e3a" }, // 14 Amber CRT
  { paper: "#c4cfa1", ink: "#1e2d1a", accent: "#5a7a3a" }, // 15 Gameboy
  { paper: "#120a24", ink: "#d9c2ff", accent: "#ff5ad9" }, // 16 Ultraviolet
  { paper: "#07312f", ink: "#d7f0ea", accent: "#ff7a59" }, // 17 Lagoon
  { paper: "#1a1407", ink: "#ffd24a", accent: "#ff7a00" }, // 18 Marigold
  { paper: "#14171a", ink: "#bfe9d0", accent: "#36e0a0" }, // 19 Mint Iron
  { paper: "#2b1430", ink: "#f0e2d0", accent: "#e7a23c" }, // 20 Plum
  { paper: "#1c2530", ink: "#e6f0f7", accent: "#5ad1ff" }, // 21 Slate Ice
  { paper: "#f0e3cf", ink: "#5a2410", accent: "#c2491d" }, // 22 Rust Sand
  { paper: "#0f1340", ink: "#e8e6ff", accent: "#ffd23f" }, // 23 Indigo Sun
  { paper: "#08130e", ink: "#34e89e", accent: "#f2c94c" }, // 24 Emerald
  { paper: "#1a0508", ink: "#ff4d6d", accent: "#ffd6a5" }, // 25 Ruby
  { paper: "#050b1a", ink: "#4d8aff", accent: "#e0fbfc" }, // 26 Sapphire
  { paper: "#140a1f", ink: "#c77dff", accent: "#80ffdb" }, // 27 Amethyst
  { paper: "#1a1303", ink: "#ffd60a", accent: "#ff7b00" }, // 28 Topaz
  { paper: "#06140f", ink: "#00c9a7", accent: "#f6f7d7" }, // 29 Jade
  { paper: "#fff0f6", ink: "#ff2e88", accent: "#3ab7f2" }, // 30 Bubblegum
  { paper: "#ecfff6", ink: "#0e9e68", accent: "#ff5d8f" }, // 31 Mint Cream
  { paper: "#fffbe6", ink: "#2d2a24", accent: "#f4a259" }, // 32 Butter
  { paper: "#eff1ff", ink: "#3a33c0", accent: "#ff7aa8" }, // 33 Periwinkle
  { paper: "#ffeee2", ink: "#b23a1e", accent: "#1f9e8f" }, // 34 Peach
  { paper: "#f5f0ff", ink: "#6d28d9", accent: "#2bd4a0" }, // 35 Lilac
  { paper: "#0a0610", ink: "#ff2ec4", accent: "#00f0ff" }, // 36 Hot Pink
  { paper: "#04090c", ink: "#19f7f7", accent: "#ff3cac" }, // 37 Cyber
  { paper: "#0b0e04", ink: "#c6ff00", accent: "#ff008c" }, // 38 Volt
  { paper: "#100604", ink: "#ff5a00", accent: "#ffd000" }, // 39 Laser
  { paper: "#03051a", ink: "#3a86ff", accent: "#ffbe0b" }, // 40 Electric
  { paper: "#14180d", ink: "#c5d86d", accent: "#e07a5f" }, // 41 Moss
  { paper: "#e7d7c2", ink: "#5a3e2b", accent: "#bc4b2a" }, // 42 Clay
  { paper: "#1c1402", ink: "#f4b400", accent: "#e2725b" }, // 43 Saffron
  { paper: "#0c1a12", ink: "#88d498", accent: "#f2c14e" }, // 44 Fernway
  { paper: "#ece0c8", ink: "#6b3a2e", accent: "#4a7c59" }, // 45 Dune
  { paper: "#0d1b2a", ink: "#ff6ad5", accent: "#41ead4" }, // 46 Miami
  { paper: "#1a0b2e", ink: "#ff71ce", accent: "#01cdfe" }, // 47 Vaporwave
  { paper: "#0b0c10", ink: "#c5c6c7", accent: "#66fcf1" }, // 48 Chrome
  { paper: "#160f29", ink: "#ff9e64", accent: "#f72585" }, // 49 Dusk Grid
  { paper: "#0033a0", ink: "#ffe3d8", accent: "#ff5c49" }, // 50 Cobalt
  { paper: "#102a1c", ink: "#eaff3c", accent: "#ff8c42" }, // 51 Forest Lemon
  { paper: "#2b0a0a", ink: "#f5c6b0", accent: "#ff3b1f" }, // 52 Oxide
  { paper: "#0a12c7", ink: "#f6f7fb", accent: "#ffe800" }, // 53 Klein Pop
];
