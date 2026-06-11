# Design

The visual system of tomfolio. The shipped site runs the **Acid** language; six alternate complete languages live under `/directions/` as the direction shelf. Every language obeys the same non-negotiables (bottom of this file) while disagreeing about everything else on purpose.

## Theme: Acid (direction zero, the live site)

Dark, shader-driven, Awwwards-leaning. Locked single theme.

### Colors

| Token | Value | Role |
|---|---|---|
| `--ink` | `#0B0B0D` | page background |
| `--ink-2` | `#121215` | elevated section background |
| `--paper` | `#F2F2EE` | primary text |
| `--mist` | `#A8A8A1` | muted text |
| `--lime` | `#C8F542` | the one accent: CTAs, links, selection, shader filaments |
| `--line` | `rgba(242,242,238,.14)` | hairlines |

### Typography

- Display: Clash Display 500/600, `-0.02em` tracking, clamp ceilings around 6rem.
- Body: Satoshi 400/500/700, 65ch max measure.
- Mono: JetBrains Mono for metadata, uppercase, `0.13em` tracking.
- All fonts self-hosted in `public/fonts/` (Fontshare vendored via `scripts/fetch-fonts.py`) or fontsource npm.

### Components & layout

- Shape system: surfaces sharp (radius 0), interactive elements pill (999px).
- Sections: WebGL hero, velocity marquee, offset-right manifesto scrub, divided work rows with cursor preview, asymmetric bento, footer CTA over re-ignited canvas.
- Canvas: one fullscreen fragment shader (GlScene, `src/gl/scene.ts`) behind hero and footer; energy scrubbed by scroll; 13 swappable shader variants on `/shelf.html`.

### Motion

Lenis smooth scroll + GSAP ScrollTrigger/SplitText. Lush, springless power-easings. Everything on gsap.ticker; zero scroll listeners.

## Direction index (the direction shelf, `/directions/`)

Each direction is a complete one-page portfolio with its own tokens, vendored type, layout system, gallery pattern, generative canvas, and motion temperament. Token tables live in each direction's `page.css`; this is the map.

| Direction | Substrate | Accent system | Display / body | Gallery | Canvas | Motion |
|---|---|---|---|---|---|---|
| `press` Presswerk | paper `#F4F4F0` | carbon ink + aviation red `#E61919` | Archivo Black caps / Archivo + JetBrains Mono | industrial index table | Bayer-dither field | mechanical, native scroll, steps() |
| `journal` The Tomtoolery Journal | off-white `#F8F8F7` | ink `#16161A` + vermilion `#C73E1D` | Zodiak serif / Satoshi | magazine spreads | ink-wash fbm | calm, long Lenis |
| `y2k` TT2000 | near-black `#08080B` | chrome grays + magenta `#FF3DAE` | Panchang / Satoshi | pinned horizontal coverflow | liquid chrome metaballs | maximal, springy |
| `klein` Bleu | IKB drench `#0B27D6` | white `#F6F7FB`, black sparingly | Switzer only | strict modular grid | lens-warped dot lattice | precise, fast, expo |
| `bauhaus` Toolhaus | warm white `#F5F2EA` | red `#D2362B` / cobalt `#1F4AB8` / yellow `#E8B022` roles | Tanker / General Sans | rotated poster wall | primitive SDF ballet | playful-precise |
| `brut` Brut | soot lacquer `#131110` + one gold band | champagne gold `#D7B470` (deco voice) + cinnabar `#E8542E` (brut scrawl) | Limelight + Poiret One caps / Jost, Permanent Marker hand | directory rail + offset chamfered plates | 2D sunburst wedges, fan-open, click kick, smiling sun | ceremonial, native scroll, velocity marquee, scrawls in steps() |

The filtered-shader batch (shared lite shell, canvases = library shaders restyled with CSS filters, no lime anywhere):

| Direction | Substrate | Accents | Display / body | Gallery | Canvas (filter) |
|---|---|---|---|---|---|
| `lavanda` | lilac `#ECE7F2` | aubergine + dusty violet | General Sans / General Sans | calm single column, violet duotones | aurora, hue-rotated violet |
| `cognac` | espresso `#2A1F19` | tan + cream | Gambetta / Satoshi | book-spine shelf, hover opens | twill, sepia tweed |
| `orchid` | violet-black `#150F1E` | orchid + plum | Khand / General Sans | overlapping venue posters | liquidlight, near-native |
| `greige` | greige `#D9D4CB` | ink + terracotta | General Sans / Satoshi | museum hang: mats, plinth captions | karesansui, native |
| `mauve` | cream `#F4EEE2` | mauve + tan inks | Chillax / Satoshi | zine spread, duotone cuts | risograph, re-inked mauve |
| `twilight` | plum night `#241B2E` | plum + tan | Sentient / Satoshi | full-bleed dusk plates | murmuration, plum dusk |
| `port` | parchment `#EFE2C8` | port wine + old gold | Melodrama / Satoshi | menu rows, framed thumbs | geode, amber endpaper |
| `ube` | pale ube `#EFE9F7` | ube + biscuit | Quicksand / Quicksand | puffy clay cards | cutout, inverted pastel |
| `sepia` | album brown `#262019` | taupe + old gold | Gambetta + Marker / Satoshi | rotated snapshots, handwriting | drizzle, old film |
| `fresco` | plaster `#D9C7A8` | violet pigment + ochre | Boska / Satoshi | clip-path wall fragments | tesserae, warm stone |

## Non-negotiables (every language)

- Zero em-dashes (and no en-dash separators) in any visible string.
- Eyebrow kickers: target zero; hard cap ceil(sections/3) per page.
- Hero: headline ≤ 2 lines, subtext ≤ 20 words, CTA in the first viewport.
- WCAG AA contrast minimum; verify accent-on-substrate pairs per direction.
- `prefers-reduced-motion`: static canvas frame, content visible without animation, native scrolling.
- DOM animation uses transform/opacity only; no `window.addEventListener("scroll")` anywhere.
- Mobile (< 768px) collapse explicitly defined per layout system.
- Images: seeded picsum grayscale placeholders until real imagery lands; per-direction treatment via CSS filters/blend modes only.
- One shared content source (`src/content/portfolio.ts`); directions restyle the same facts.
