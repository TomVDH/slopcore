/**
 * Holographic-foil parameters, ported verbatim from the reference "Iridescent
 * Card" design handoff. These default values are the approved look; the lab
 * (/lab.html) exposes them as live sliders so they can be re-tuned by eye.
 *
 * The card is a full-bleed photo (no engraving), so the reference's engraving
 * mask drops out and the foil is masked to the cursor spotlight only — it reads
 * as a holographic laminate that brightens near the pointer and fades at rest.
 */
export type FoilScope = 'spotlight' | 'luminance' | 'both';

export interface HoloParams {
  /** Max 3D tilt (deg). JS-driven. */
  tilt: number;
  /** Scale at full hover. */
  scaleHover: number;
  /** Parallax depth spread (per-layer translateZ multiplier). */
  depth: number;
  /** Motion easing base per frame. JS-driven. */
  smoothing: number;
  /** Foil intensity (opacity multiplier). */
  iri: number;
  /** Rainbow stripe period (%). */
  iriScale: number;
  /** How far hue shifts with cursor X (deg). */
  hueRange: number;
  /** Foil spotlight radius (px). */
  spot: number;
  /** Full-card iridescent wash strength. */
  wash: number;
  /** Blend mode of the holo layer. */
  holoBlend: string;
  /** Specular glow radius (px). */
  specSize: number;
  /** Specular glow strength (0..1). */
  spec: number;
  /** Hot glint on/off. */
  hotspot: boolean;
  /** Edge halo amount. */
  glow: number;
  /** Edge halo color. */
  glowColor: string;
  /** Film grain opacity. */
  noiseOp: number;
  /** Grain cell frequency. */
  noiseScale: number;
  /** Where the foil lives (lab experiment; shipped default = spotlight). */
  foilScope: FoilScope;
}

export const HOLO_DEFAULTS: HoloParams = {
  tilt: 16,
  scaleHover: 1.11,
  depth: 57,
  smoothing: 0.09,
  iri: 0.35,
  iriScale: 39,
  hueRange: 264,
  spot: 468,
  wash: 0.15,
  holoBlend: 'overlay',
  specSize: 320,
  spec: 0.55,
  hotspot: true,
  glow: 0.65,
  glowColor: '#8fd4ff',
  noiseOp: 0.2,
  noiseScale: 85,
  foilScope: 'spotlight',
};

export const HOLO_BLEND_OPTIONS = ['color-dodge', 'screen', 'hard-light', 'overlay', 'plus-lighter'];
export const GLOW_COLOR_OPTIONS = ['#8fd4ff', '#c4a0ff', '#ff9ed1', '#8fffc4', '#ffffff'];

/**
 * Tone-independent film grain (ported from card-art.jsx → buildNoiseURI): black
 * + white specks with a V-shaped alpha so it reads identically on black, mid and
 * white. Composited with `mix-blend-mode: normal`.
 */
export function buildNoiseURI(scale: number): string {
  const f = (scale / 100).toFixed(3);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">` +
    `<filter id="n" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0"/>` +
    `<feComponentTransfer>` +
    `<feFuncR type="discrete" tableValues="0 1"/>` +
    `<feFuncG type="discrete" tableValues="0 1"/>` +
    `<feFuncB type="discrete" tableValues="0 1"/>` +
    `<feFuncA type="table" tableValues="1 0.22 0 0.22 1"/>` +
    `</feComponentTransfer>` +
    `</filter>` +
    `<rect width="100%" height="100%" filter="url(#n)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Write the static (non-per-frame) holo params as CSS custom properties on the card. */
export function applyHoloVars(el: HTMLElement, p: HoloParams): void {
  const s = el.style;
  s.setProperty('--scale-hover', String(p.scaleHover));
  s.setProperty('--depth', String(p.depth));
  s.setProperty('--iri', String(p.iri));
  s.setProperty('--iri-scale', String(p.iriScale));
  s.setProperty('--hue-range', String(p.hueRange));
  s.setProperty('--spot', String(p.spot));
  s.setProperty('--wash', String(p.wash));
  s.setProperty('--holo-blend', p.holoBlend);
  s.setProperty('--spec-size', String(p.specSize));
  s.setProperty('--spec', String(p.spec));
  s.setProperty('--hotspot', p.hotspot ? '1' : '0');
  s.setProperty('--glow', String(p.glow));
  s.setProperty('--glow-color', p.glowColor);
  s.setProperty('--noise-op', String(p.noiseOp));
  s.setProperty('--noise', buildNoiseURI(p.noiseScale));
  el.dataset.foil = p.foilScope;
}
