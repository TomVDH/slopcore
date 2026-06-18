# ZENA FC — Sticker Club '26

`zena-sticker-club` · type: `coding` · vault: [[projects/zena-sticker-club/brief|zena-sticker-club]]

> A single-use, fully static foil-pack unboxing toy: rip a pack → reveal 1 of 48 nations → read the lore → collect all 48.

## What this is

An irreverent mock-Panini sticker toy. You rip one foil pack and reveal which nation you
pulled — it is always the same man, "Marcus Masterton", reskinned as a national
caricature — read the comedic lore sidebar, and collect all 48. Premium-but-playful.
No backend, no persistence; the whole thing is static and runs in the browser.

It lives in the **TomVDH/slopcore** monorepo under `zena-sticker-club/`
([slopcore#1](https://github.com/TomVDH/slopcore/pull/1)). `git push` from this folder
goes to slopcore (`origin` is the only remote and the single source of truth). Do **not**
use the old standalone copy under OneDrive — that's an archive.

## Where things live

| | |
|---|---|
| Working tree | (this folder) |
| Canonical context | [[projects/zena-sticker-club/brief]] |
| Decisions | [[projects/zena-sticker-club/decisions]] |
| Sessions | [[projects/zena-sticker-club/sessions]] |
| Handoff | [[projects/zena-sticker-club/_handoff]] |
| Chrome directions (shelved) | vault `work-shelves/2026-06-18-iter-001-chrome-directions` (tag `#iteration`) |

Code map:

| | |
|---|---|
| App entry | `index.html` (the toy) · `lab.html` (dev-only foil iteration shelf) |
| Chrome tokens | `src/styles/tokens.css` — every chrome visual is a CSS custom property here |
| Chrome components | `src/styles/layout.css` · `src/styles/components.css` |
| OFF-LIMITS (cards + holo) | `src/styles/holo.css` · `src/render/holo*` · `src/render/face/*` |

## Stack

Vite multi-page build · vanilla **TypeScript (strict)** · **GSAP** (reveal choreography) ·
**Three.js** (foil-pack shimmer + GPU particle burst; the card holo itself is pure CSS) ·
**vite-imagetools** (transcodes the 48 cards to AVIF/WebP) · self-hosted fonts via
`@fontsource`.

## Commands

```
npm run dev      # main app → localhost:5173 · foil shelf → /lab.html
npm run build    # production build
npm test         # 25 tests
```

## Conventions

- **The 48 red holographic cards are the hero and are OFF-LIMITS to chrome work.** Their
  art + holo live in `src/styles/holo.css`, `src/render/holo*`, and `src/render/face/*`.
  Only the surrounding UI changes — header, stage, reveal sidebar, album, buttons, and the
  type + colour tokens.
- **A reskin is a token swap, not a rewrite.** Every chrome visual is a CSS custom property
  in `tokens.css`; restyle by swapping tokens + tweaking `layout.css` / `components.css`.
- **Current chrome = "Wall Text"**: a flat dark gallery wall — faint coordinate grid,
  ultramarine registration crosshairs at the card corners, one rationed accent (`#5b86ff`),
  Archivo display, squared corners, opaque surfaces (no glassmorphism). Dark is the default;
  a light variant exists via `document.documentElement.dataset.theme = 'light'` (no UI
  toggle wired yet).
- **Accessibility is non-negotiable**: WCAG AA body text, a real `prefers-reduced-motion`
  path, and rarity is never communicated by colour alone.
- Static only — no backend, no persistence.

## Vault is canonical

When asked "is X documented?" or "do we know Y?", check the vault first — repos document
code, the vault documents decisions and context. Use the `adjudant` skill to read/write
vault files.

## Claude-specific overrides

Live in `CLAUDE.md` next to this file. CLAUDE.md `@`-imports this file.
