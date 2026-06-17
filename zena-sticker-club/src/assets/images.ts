import type { CountryCode, ImageSet } from '@/domain/types';
import { ALL_CODES } from '@/domain/types';

/**
 * Build-time image registry. vite-imagetools transcodes each source PNG to
 * AVIF + WebP at two widths (220 thumb, 1000 hero) plus a tiny inline LQIP.
 *
 * The eager globs resolve to URL STRINGS, not pixels — the browser only fetches
 * an image when an <img>/<source> with that URL is actually rendered. So this
 * never holds 48 x ~2MB; the preloader + lazy binder thumbs control real loads.
 */

// All source cards share the same dimensions; kept as constants so we never
// import original PNGs (a metadata glob would reference the 2.5MB source and
// emit it into the bundle). Layout uses a fixed --card-aspect token anyway.
const CARD_W = 1089;
const CARD_H = 1445;

const heroAvif = import.meta.glob<string>('/assets/cards/*.png', {
  eager: true,
  query: { format: 'avif', w: '1000', quality: '62' },
  import: 'default',
});
const heroWebp = import.meta.glob<string>('/assets/cards/*.png', {
  eager: true,
  query: { format: 'webp', w: '1000', quality: '78' },
  import: 'default',
});
const thumbAvif = import.meta.glob<string>('/assets/cards/*.png', {
  eager: true,
  query: { format: 'avif', w: '220', quality: '55' },
  import: 'default',
});
const thumbWebp = import.meta.glob<string>('/assets/cards/*.png', {
  eager: true,
  query: { format: 'webp', w: '220', quality: '72' },
  import: 'default',
});
const lqipMap = import.meta.glob<string>('/assets/cards/*.png', {
  eager: true,
  query: { format: 'webp', w: '24', inline: 'true' },
  import: 'default',
});

function codeFromPath(path: string): string {
  const match = /\/([^/]+)\.png$/.exec(path);
  return match ? match[1]! : '';
}

function byCode<T>(map: Record<string, T>): Map<string, T> {
  const out = new Map<string, T>();
  for (const [path, value] of Object.entries(map)) {
    out.set(codeFromPath(path), value);
  }
  return out;
}

const heroAvifByCode = byCode(heroAvif);
const heroWebpByCode = byCode(heroWebp);
const thumbAvifByCode = byCode(thumbAvif);
const thumbWebpByCode = byCode(thumbWebp);
const lqipByCode = byCode(lqipMap);

function require2<T>(map: Map<string, T>, code: string, what: string): T {
  const v = map.get(code);
  if (v === undefined) throw new Error(`[images] missing ${what} for "${code}"`);
  return v;
}

const REGISTRY = new Map<CountryCode, ImageSet>();
for (const code of ALL_CODES) {
  REGISTRY.set(code, {
    hero: {
      avif: require2(heroAvifByCode, code, 'hero avif'),
      webp: require2(heroWebpByCode, code, 'hero webp'),
    },
    thumb: {
      avif: require2(thumbAvifByCode, code, 'thumb avif'),
      webp: require2(thumbWebpByCode, code, 'thumb webp'),
    },
    lqip: lqipByCode.get(code) ?? '',
    w: CARD_W,
    h: CARD_H,
  });
}

export function getImages(code: CountryCode): ImageSet {
  const set = REGISTRY.get(code);
  if (!set) throw new Error(`[images] no image set for "${code}"`);
  return set;
}

/** Probe used by `nations.invariants()` so a missing transcode fails fast. */
export function hasImages(code: CountryCode): boolean {
  return REGISTRY.has(code);
}
