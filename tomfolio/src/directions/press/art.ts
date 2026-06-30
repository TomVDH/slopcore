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

import { generatePaletteGLSL } from "../../palettes";
import { TRAIL_N } from "../../gl/constants";

export const pressFrag = /* glsl */ `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uEnergy;
  uniform float uScrollVel;

  // Cursor trail: the recent pointer path in shader space, newest first
  // (uTrail[0] = current). Driven by scene.ts on a fixed time cadence; the
  // cursor influence is the distance to this polyline, fading with age, so the
  // effect follows the actual path and tapers behind the pointer.
  const int TRAIL_N = ${TRAIL_N};
  uniform vec2 uTrail[TRAIL_N];

  // Editable parameters (defaults reproduce the original plate exactly).
  uniform float uCell;         // cell density divisor
  uniform float uToneBase;     // base luminance of the tone field
  uniform float uToneContrast; // grain contrast
  uniform float uToneScale;    // field scale
  uniform float uDrift;        // drift speed
  uniform float uThreshold;    // dither threshold bias
  uniform float uCursorMode;   // 0 off, 1 clear, 2 ink, 3 bias, 4 negative, 5 develop
  uniform float uCursorAmp;    // cursor effect strength
  uniform float uCursorRadius; // cursor disc falloff rate (larger = tighter)
  uniform float uHold;         // static floor under the decaying cursor strength
  uniform float uCursorEdge;   // negative-mode disc hardness
  uniform float uDevCell;      // develop sub-grid cell count (same units as uCell)
  uniform float uDevColor;     // develop colorize amount: 0 monochrome .. 1 full colour
  uniform float uDevStage;     // develop: press point where grain hands off to photo (0..1)
  uniform float uDevResolve;   // develop: how far a full press resolves toward the photo (0..1)
  uniform float uDevSat;       // develop: saturation of the resolved colour (0 gray .. 2 boost)
  uniform float uDevSharp;     // develop: local-contrast / unsharp pop in the develop region
  uniform float uDevLevels;    // develop: posterise steps per RGB channel (own, vs uColorLevels)
  uniform float uDevBright;    // develop: brightness offset on the develop source (on top of image B)
  uniform float uDevContrast;  // develop: contrast on the develop source (on top of image C)
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
  uniform float uFit;             // image fit: 0 cover (crop), 1 contain (letterbox)
  uniform vec2  uImgAlign;        // image anchor (0.5,0.5 = centred); negative / >1 bleeds off-edge
  uniform float uImgScale;        // image zoom within the plate (1 = fit, >1 in, <1 out)
  uniform float uEdgeFade;        // edge taper: width of the right-edge dissolve (plate fraction)
  uniform float uEdgeCurve;       // edge taper: ramp shape (higher = more gradual, lower = harder)
  uniform float uEdgeDepth;       // edge taper: dissolve amount (1 = to ground, <1 = partial veil)
  uniform float uFadeMode;        // 0 off, 1 simple radial gradient, 2 cloud (fbm-textured)
  uniform float uFadeScale;       // cloud-noise frequency X for fade mode 2 (smaller = bigger billows)
  uniform float uFadeScaleY;      // cloud-noise frequency Y (independent stretch of the cloud)
  uniform float uNoiseType;       // cloud noise: 0 fbm 1 ridged 2 voronoi 3 turbulence 4 cracks
  uniform float uFadeWarp;        // domain-warp amount applied to the cloud noise (0 = none)
  uniform float uCloudWidth;      // cloud horizontal extent, independent of the image (1 = plate)
  uniform float uCloudSpeed;      // cloud mode 2: sideways scroll speed of the fbm (0 = static)
  uniform vec2  uFadePos;         // dissolve anchor in [0,1] plate space (0,0 = bottom-left, default)
  uniform float uFadeReach;       // dissolve reach: distance from the anchor at which the fade completes
  uniform float uFadeSoft;        // dissolve softness: width of the gradient band before the reach
  uniform float uMaskView;        // dev: 1 = show the raw fade mask (cov) as grayscale, undithered
  uniform float uCursorView;      // dev: 1 = show raw cursor influence (infl) as grayscale
  uniform float uShowCanvas;      // dev: 1 = fluo border on the canvas/plate edge (green)
  uniform float uShowImage;       // dev: 1 = fluo border on the fitted image's edge (magenta)
  uniform float uShowCloud;       // dev: 1 = fluo line on the mask contour, cov~0.5 (yellow)
  uniform float uReveal;          // 0 dithered, 1 full-res photo; crossfades the dither -> source
  uniform float uColorDither;     // 0 duotone (paper/ink), 1 full-colour ordered dither of the photo
  uniform float uColorLevels;     // posterise steps per RGB channel in colour mode (2 = heavy dither)
  uniform float uMarkBright;      // mark-colour brightness, scaled by the mark's own sqrt(value) — lifts bright marks, leaves shadows (not the source, not a flat shift)

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

  // Ridged multifractal (Musgrave-ish): creased, filament-like billows.
  float ridged(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
      v += amp * n * n;
      p *= 2.02;
      amp *= 0.5;
    }
    return v;
  }

  // Voronoi (cellular): distance to the nearest feature point — blobby cells.
  float voronoi(vec2 p) {
    vec2 g = floor(p);
    vec2 f = fract(p);
    float md = 1.5;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 fp = vec2(hash(g + o), hash(g + o + 31.7));
        md = min(md, length(o + fp - f));
      }
    }
    return clamp(md, 0.0, 1.0);
  }

  // Turbulence: abs-valued fbm — smokier, sharper billows than plain fbm.
  float turbulence(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      v += amp * abs(vnoise(p) * 2.0 - 1.0);
      p *= 2.02;
      amp *= 0.5;
    }
    return v;
  }

  // Worley cracks (F2 - F1): the gap between the two nearest feature points —
  // bright veins / cracks running along the cell boundaries.
  float worleyEdge(vec2 p) {
    vec2 g = floor(p);
    vec2 f = fract(p);
    float f1 = 1.5, f2 = 1.5;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 fp = vec2(hash(g + o), hash(g + o + 31.7));
        float d = length(o + fp - f);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
      }
    }
    return clamp((f2 - f1) * 1.4, 0.0, 1.0);
  }

  // Fade-mask noise selector + universal domain WARP: uFadeWarp swirls the sample
  // coords through fbm before evaluating, so ANY type reads more organic/turbulent.
  // 0 fbm, 1 ridged (Musgrave-like), 2 voronoi, 3 turbulence, 4 cracks (Worley F2-F1).
  float fadeNoise(vec2 p, float type) {
    if (uFadeWarp > 0.001) {
      vec2 w = vec2(fbm(p + vec2(1.7, 9.2)), fbm(p + vec2(8.3, 2.8)));
      p += (w - 0.5) * (uFadeWarp * 2.0);
    }
    if (type > 3.5) return worleyEdge(p);
    if (type > 2.5) return turbulence(p);
    if (type > 1.5) return voronoi(p);
    if (type > 0.5) return ridged(p);
    return fbm(p);
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
    ${generatePaletteGLSL()}

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
    float r0 = imgA0 / plateA;
    // Fit: 0 cover (fill, crop the overflow) / 1 contain (fit whole image, letterbox).
    // uImgAlign anchors the crop window / letterbox position (0.5,0.5 = centered).
    float zoom = max(uImgScale, 0.05); // Zoom: >1 samples a smaller region (in), <1 larger (out)
    vec2 isc0 = uFit < 0.5
      ? (r0 > 1.0 ? vec2(1.0 / r0, 1.0) : vec2(1.0, r0))
      : (r0 > 1.0 ? vec2(1.0, r0) : vec2(1.0 / r0, 1.0));
    isc0 /= zoom;
    vec2 iuv = (baseUv - uImgAlign) * isc0 + uImgAlign;
    float imgA1 = uImage2Res.x / max(uImage2Res.y, 1.0);
    float r1 = imgA1 / plateA;
    vec2 isc1 = uFit < 0.5
      ? (r1 > 1.0 ? vec2(1.0 / r1, 1.0) : vec2(1.0, r1))
      : (r1 > 1.0 ? vec2(1.0, r1) : vec2(1.0 / r1, 1.0));
    isc1 /= zoom;
    vec2 iuv2 = (baseUv - uImgAlign) * isc1 + uImgAlign;
    // Contain letterbox: 1 inside the image, 0 in the bars (rendered as ground below).
    float inImg = step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
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
    // Cursor influence as a TRAIL: the distance from this cell to the recent
    // pointer path (the uTrail polyline, newest at [0]). Each segment's
    // contribution fades with age, so the trail tapers behind the pointer and
    // reads as a wipe that follows the actual motion — not a stretched disc.
    // At rest the samples converge to one point, so it collapses to a disc and
    // then fades out as uMouseStrength decays. Built only from p (cell center),
    // so the whole cell agrees and the grid never shatters.
    float infl = 0.0;
    for (int i = 0; i < TRAIL_N - 1; i++) {
      vec2 a  = uTrail[i];
      vec2 b  = uTrail[i + 1];
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h    = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      float dseg = length(pa - ba * h);          // distance to this path segment
      float age  = 1.0 - float(i) / float(TRAIL_N - 1); // 1 newest .. 0 oldest
      age *= age;                                 // taper the tail faster
      infl = max(infl, age * exp(-dseg * uCursorRadius));
    }
    infl *= clamp(max(uMouseStrength, uHold), 0.0, 1.0);
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
      // Cloud width: scale the cloud's horizontal coordinate (around centre)
      // independent of the image/plate, so the dissolve + texture can be set
      // wider/narrower than the photo box. 1 = locked to the plate.
      cuv.x = 0.5 + (cuv.x - 0.5) / max(uCloudWidth, 0.05);
      float aspectF = uRes.x / max(uRes.y, 1.0);
      vec2 anchor = vec2(uFadePos.x * aspectF, uFadePos.y); // move the dissolve origin
      vec2 fq  = vec2(cuv.x * aspectF, cuv.y) - anchor;
      float fd = length(fq);
      if (uFadeMode > 1.5) {
        // Sideways scroll of the fbm field (decoupled from uDrift). A continuous
        // horizontal offset of an infinite noise field reads as a seamless,
        // never-repeating cloud drift; uCloudSpeed 0 = static.
        fd += (fadeNoise(cuv * vec2(uFadeScale, uFadeScaleY) + vec2(uTime * uCloudSpeed, 0.0), uNoiseType) - 0.5) * 0.95;
      }
      cov = 1.0 - smoothstep(uFadeReach - uFadeSoft, uFadeReach, fd);
      // Right-edge taper — PART OF THE MASK (only runs when a fade is on). Dissolves the
      // visible RIGHT edge of the plate into the ground over the last uEdgeFade of the
      // plate width. Anchored to baseUv (plate), not the photo (off-plate when cropped).
      if (uImageOn > 0.5 && uEdgeFade > 0.001) {
        float et = smoothstep(0.0, uEdgeFade, 1.0 - baseUv.x); // 0 at the right edge, 1 inside
        et = pow(et, max(uEdgeCurve, 0.05));                   // Curve: shape the ramp
        cov = min(cov, mix(1.0 - clamp(uEdgeDepth, 0.0, 1.0), 1.0, et)); // Depth: how far it dissolves
      }
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

    // Disc is a round dot of radius wEff. X / plus / dash are STROKES — they get a
    // thinner half-width so they read as crisp lines and never saturate into a
    // solid block (min(dia,dib) tops out ~0.35; at wEff up to 0.5 the X filled the
    // whole cell, making it identical to solid Dots).
    float strokeW = clamp(wEff * 0.4, 0.05, 0.18);
    float mDisc = 1.0 - smoothstep(wEff - aa, wEff + aa, rad);
    float mX    = 1.0 - smoothstep(strokeW - aa, strokeW + aa, min(dia, dib));
    float mPlus = 1.0 - smoothstep(strokeW - aa, strokeW + aa, min(dax, day));
    float mDash = 1.0 - smoothstep(strokeW - aa, strokeW + aa, day);

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
      // Full-colour never inverts: a negative of a colour photo reads as wrong
      // colour, not a stylistic polarity flip. (uInvert applies to duotone only.)
      vec3 src = clamp((imgRGB - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
      float L = max(uColorLevels, 2.0);
      vec3 q = floor(src * (L - 1.0) + bayer4(cellId)) / (L - 1.0);
      // Mark brightness scales with the pixel's own ROOT brightness (per channel),
      // so bright marks lift while shadows stay put — it brightens the mark colour
      // evenly, instead of flat-shifting every mark (which washed them into paper).
      q = clamp(q + uMarkBright * sqrt(clamp(src, 0.0, 1.0)), 0.0, 1.0);
      col = mix(paper, q, motif);
    } else {
      col = mix(paper, clamp(ink + uMarkBright * sqrt(ink), 0.0, 1.0), inkAmt);
    }
    // Contain letterbox: outside the fitted image, show bare ground (paper).
    col = mix(col, paper, (1.0 - inImg) * uImageOn);
    // Dissolve THROUGH the dither: the cloud coverage drops whole cells in the
    // Bayer order, so the fade is stippled INTO the marks — it affects the dither
    // pixels rather than overlaying a smooth alpha gradient. Mode 0 keeps cov = 1.
    float covDith = step(bayer4(cellId), clamp(cov, 0.0, 1.0));
    col = mix(paper, col, covDith);

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
    // Develop only resolves cells that are actually visible: gate by the fade
    // coverage (cov, post edge-taper) and the image bounds (inImg), so mousing over
    // a dissolved or off-image region can't re-reveal the photo through the mask.
    float localRev = (uCursorMode > 4.5 && uCursorMode < 5.5)
      ? clamp(uCursorAmp * infl, 0.0, 1.0) * clamp(cov, 0.0, 1.0) * inImg : 0.0;

    if (localRev > 0.001 && uImageOn > 0.5) {
      float fcell = max(uRes.y / max(uDevCell, 1.0), 2.0); // same formula as the base cell
      vec2 fId = floor(gl_FragCoord.xy / fcell);
      vec2 fLocal = fract(gl_FragCoord.xy / fcell);
      vec2 fBase = (fId + 0.5) * fcell / uRes;
      vec3 fRGB = mix(texture2D(uImage, (fBase - uImgAlign) * isc0 + uImgAlign).rgb,
                      texture2D(uImage2, (fBase - uImgAlign) * isc1 + uImgAlign).rgb,
                      clamp(uXfade, 0.0, 1.0));
      float faa = clamp(0.9 / fcell, 0.001, 0.25);
      vec2 flc = fLocal - 0.5;
      float fang = uMotifAngle * 6.2831853;
      float fcs = cos(fang), fsn = sin(fang);
      flc = mat2(fcs, -fsn, fsn, fcs) * flc;
      vec2 frl = flc + 0.5;
      float fStrokeW = clamp(wEff * 0.4, 0.05, 0.18); // thinner stroke (see base motif block)
      float fDisc = 1.0 - smoothstep(wEff - faa, wEff + faa, length(flc));
      float fX    = 1.0 - smoothstep(fStrokeW - faa, fStrokeW + faa, min(abs(frl.x - frl.y), abs(frl.x + frl.y - 1.0)) * 0.7071);
      float fPlus = 1.0 - smoothstep(fStrokeW - faa, fStrokeW + faa, min(abs(flc.x), abs(flc.y)));
      float fDash = 1.0 - smoothstep(fStrokeW - faa, fStrokeW + faa, abs(flc.y));
      float fmotif = 1.0;
      if      (uMotif > 0.5 && uMotif < 1.5) fmotif = fDisc;
      else if (uMotif < 2.5)                 fmotif = fX;
      else if (uMotif < 3.5)                 fmotif = fPlus;
      else if (uMotif > 3.5)                 fmotif = fDash;
      // Develop lives INSIDE the dither: grade the source (Pop unsharp, Saturation,
      // Colorize) then re-dither THAT at uDevCell detail. A press resolves to a
      // finer, fuller dither of the photo — it manipulates the source + marks
      // directly, not a smooth photo laid over them (that's what global Reveal is).
      vec2 fuv = (fBase - uImgAlign) * isc0 + uImgAlign;
      vec3 fMean = (texture2D(uImage, fuv + vec2( 0.01, 0.0)).rgb
                  + texture2D(uImage, fuv + vec2(-0.01, 0.0)).rgb
                  + texture2D(uImage, fuv + vec2(0.0,  0.01)).rgb
                  + texture2D(uImage, fuv + vec2(0.0, -0.01)).rgb) * 0.25;
      vec3 fPop = fRGB + uDevSharp * 1.5 * (fRGB - fMean);              // Pop: local unsharp
      float fGray = dot(clamp(fPop, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
      vec3 fGraded = clamp(mix(vec3(fGray), fPop, uDevSat), 0.0, 1.0);  // Saturation
      fGraded = clamp((fGraded - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
      fGraded = clamp((fGraded - 0.5) * uDevContrast + 0.5 + uDevBright, 0.0, 1.0); // develop's own B/C
      float fL = max(uDevLevels, 2.0); // develop's own posterise steps (Levels)
      vec3 fq = floor(fGraded * (fL - 1.0) + bayer4(fId)) / (fL - 1.0);
      fq = clamp(fq + uMarkBright * sqrt(clamp(fGraded, 0.0, 1.0)), 0.0, 1.0); // root-proportional lift
      vec3 colourFine = mix(paper, fq, fmotif);                         // colour fine-dither
      float fLum = clamp((fGray - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
      fLum = clamp((fLum - 0.5) * uDevContrast + 0.5 + uDevBright, 0.0, 1.0);       // develop's own B/C
      fLum = mix(fLum, 1.0 - fLum, uInvert);                            // duotone still inverts
      float fon = step(bayer4(fId) + uThreshold, fLum);
      vec3 monoFine = mix(paper, clamp(ink + uMarkBright * sqrt(ink), 0.0, 1.0), (1.0 - fon) * fmotif);
      // Colorize blends mono <-> colour fine-dither; a full-colour base is always colour.
      float fColorAmt = max(uColorDither, clamp(uDevColor, 0.0, 1.0));
      vec3 fineCol = mix(monoFine, colourFine, fColorAmt);
      // Stage ramps the develop in; Resolve caps how fully the fine dither takes over.
      float devAmt = smoothstep(0.04, max(uDevStage, 0.06), localRev) * clamp(uDevResolve, 0.0, 1.0);
      col = mix(col, fineCol, devAmt);
    }

    // Global Reveal resolves the whole plate to the true natural-light photo
    // (no invert / colorize / saturation — the real source), on top of Develop.
    if (uReveal > 0.001 && uImageOn > 0.5) {
      col = mix(col, mix(paper, clamp(imgRGB, 0.0, 1.0), inImg), clamp(uReveal, 0.0, 1.0));
    }

    // Image state (dev): the continuous-tone source the dither reads — current
    // brightness / contrast / invert applied (colour shows RGB, duotone shows the
    // luminance the screen reads), but NOT dithered or dissolved.
    if (uImageState > 0.5 && uImageOn > 0.5) {
      vec3 s = clamp((imgRGB - 0.5) * uImageContrast + 0.5 + uImageBrightness, 0.0, 1.0);
      if (uColorDither > 0.5) {
        col = s; // colour never inverts
      } else {
        float sl = dot(s, vec3(0.299, 0.587, 0.114));
        col = vec3(mix(sl, 1.0 - sl, uInvert));
      }
    }

    // Mask view (dev): show the raw fade coverage as grayscale — white = marks
    // kept, black = dissolved to ground — so the gradient / cloud shape (and its
    // moved anchor) is directly visible, undithered.
    if (uMaskView > 0.5) col = vec3(clamp(cov, 0.0, 1.0));
    if (uCursorView > 0.5) col = vec3(clamp(infl, 0.0, 1.0));

    // Dev boundary overlays (fluo), drawn on top: the mask contour (cov~0.5, yellow),
    // the fitted image's rect edge (magenta), and the canvas/plate edge (green).
    vec2 pxB = 1.5 / uRes; // ~1.5px line in plate (baseUv) space
    if (uShowCloud > 0.5 && uFadeMode > 0.5 && abs(cov - 0.5) < 0.05) col = vec3(1.0, 0.93, 0.0);
    if (uShowImage > 0.5 && uImageOn > 0.5) {
      vec2 pxI = pxB * abs(isc0); // 1.5px plate line, measured in image (iuv) units
      bool ex = (abs(iuv.x) < pxI.x || abs(iuv.x - 1.0) < pxI.x) && iuv.y > -pxI.y && iuv.y < 1.0 + pxI.y;
      bool ey = (abs(iuv.y) < pxI.y || abs(iuv.y - 1.0) < pxI.y) && iuv.x > -pxI.x && iuv.x < 1.0 + pxI.x;
      if (ex || ey) col = vec3(1.0, 0.0, 0.85);
    }
    if (uShowCanvas > 0.5 && (baseUv.x < pxB.x || baseUv.x > 1.0 - pxB.x || baseUv.y < pxB.y || baseUv.y > 1.0 - pxB.y))
      col = vec3(0.25, 1.0, 0.1);

    gl_FragColor = vec4(col, 1.0);
  }
`;

