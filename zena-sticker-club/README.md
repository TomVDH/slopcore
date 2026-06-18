# ZENA FC — Sticker Club '26

A single-use, no-backend web toy: rip open a shimmering foil pack, reveal which
nation you pulled, read its lore, and collect the set. The joke is that it is the
**same man — "Marcus Masterton" of ZENA FC — reskinned as a national caricature
for all 48 nations**, each with a localized pun name (Marcos Mastertoño 🇦🇷,
Māruku Masutāton-san 🇯🇵, Markus von Meisterstrudel 🇦🇹, Mark "Loves Greggs"
Masterton 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ...).

Stack: **Vite + TypeScript** (vanilla, no framework), **GSAP** for the unboxing
choreography, **Three.js** for the foil shimmer + particle burst (behind a WebGL
capability probe with a CSS fallback), **vite-imagetools** to transcode the card
art, and native CSS for the holographic cards and layout.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production build
npm test           # unit tests (pull odds, collection, rarity, data invariants, rng)
```

> First production build is a little slower because it AVIF/WebP-encodes the 48
> cards at two sizes; subsequent builds are cached (~7s).

## How the loop works

`idle → ripping → revealing → showcase → (re-roll) → idle`, owned by a tiny
finite-state machine (`src/app/machine.ts`) with a monotonic token so re-rolls
and skips never corrupt an in-flight animation. Rarity is a 4-tier
World-Cup-progression ladder (Group / Round of 16 / Quarter-Final / Final), drawn
in two stages (pick a tier by weight, then a nation uniformly) so the odds stay
stable. Duplicates are allowed with sticker-album "got, got, need" treatment.

Nothing persists — a refresh starts a fresh album by design. A `?seed=...` URL
param makes pulls reproducible.

## Customizing

Everything you would tweak lives in two or three files:

- **Card copy / props / rarity** — `src/domain/nations.data.ts` (the only content
  file). Each nation's `localizedName`, `props`, `bio`, `etymology`, and `rarity`
  are here. Names and props were transcribed from your printed art.
- **Rarity economy & foil colours** — `src/domain/rarity.ts`. Change a tier's
  `weight` (pull odds), `foil`/`sheen`/`glow` (post-reveal accent), `drama`
  (reveal intensity), or `holoHues`. Set all weights equal for flat odds.
- **Card art** — drop replacement PNGs into `assets/cards/<CODE>.png` (same file
  names). They are transcoded automatically; nothing else to wire.
- **Design tokens** — `src/styles/tokens.css` (palette, type scale, easings).

## Accessibility

Full keyboard operation (Space/Enter rips, `R` re-rolls, Esc closes the sidebar,
arrow keys roam the album), rich per-card alt text, an `aria-live` announcer on
every pull, and a first-class `prefers-reduced-motion` path (instant cross-fade,
no particles, no tilt).

## Notes

- The `CRC` card art is **Curaçao** (the printed art shows Willemstad row houses
  and a blue Curaçao cocktail), not Costa Rica — kept under its printed file code.
- `assets/cards/looxas.zip` is ignored by the image pipeline.
- `src/render/face/ProceduralCardFace.ts` is a future seam: a data-driven card
  frame with no image dependency, behind the same `CardFace` interface as the
  image face. Not wired in V1; swap via `createFace('procedural')`.
