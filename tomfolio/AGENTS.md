# Tomfolio

`tomfolio` · type: `coding` · vault: [[projects/tomfolio/brief|tomfolio]]

> Dark, shader-driven single-page portfolio for the Tomtoolery persona (marketer / artist / digital nerd / hobbyist).

## What this is

A self-contained sub-project of the tomtoolery repo: an Awwwards-leaning portfolio one-pager built with Vite, vanilla TypeScript, three.js, GSAP, and Lenis. The fullscreen fbm shader behind hero and footer is the signature visual; everything else is editorial typography (Clash Display + Satoshi) over a locked dark theme with one acid-lime accent.

## Where things live

| | |
|---|---|
| Working tree | (this folder) |
| Canonical context | [[projects/tomfolio/brief]] |
| Decisions | [[projects/tomfolio/decisions]] |
| Sessions | [[projects/tomfolio/sessions]] |
| Handoff | [[projects/tomfolio/_handoff]] |

## Run it

```bash
npm install        # once
npm run fonts      # once, re-vendors Clash Display + Satoshi into public/fonts/
npm run dev        # Vite dev server (registered as "tomfolio" in repo .claude/launch.json, port 5184)
npm run build      # tsc --noEmit + vite build
```

`?nogl` on any URL skips WebGL (CSS gradient fallback). In dev builds, `window.lenis`, `window.gsap`, and `window.scene` are exposed for driving the page from tests.

### Iteration shelf

`/shelf.html` renders every hero shader candidate live, side by side, grouped by stylistic family (Flow, Architecture, Print & craft, Glass, Light & nature). Clicking a tile opens the real hero with that shader via `?shader=<id>`. Candidates live in `src/gl/variants/` (one file each, shared uniform interface); promote a winner by changing `DEFAULT_VARIANT_ID` in `src/gl/variants/index.ts`.

Verification helpers: `?still` (works on both pages) renders one static frame and skips all animation loops; on the shelf in dev, `window.__shelfSnapshot()` returns a labeled contact-sheet JPEG data URL of every tile, which is how shader rounds get reviewed without relying on browser screenshot tooling.

### Direction shelf

`/directions/` is the shelf of complete design languages (see `DESIGN.md` for the token map). Each direction is `directions/<id>.html` plus `src/directions/<id>/{page.ts, page.css}` (canvas/art module alongside), importing the shared `src/directions/base.css` reset and rendering the same facts from `src/content/portfolio.ts`. Every direction page supports `?still` and carries a fixed `dir-pill` back to the shelf.

Per-direction verification scripts live in `scripts/` (see `brut-shots.mjs` for labeled stills into `previews/` and `brut-check.mjs` for functional assertions, both driving system Chrome via playwright against the dev server). Useful because preview-browser tabs are often occluded: occluded tabs freeze CSS transitions and smooth scrolling mid-flight, so screenshot tooling there lies.

### Sandbox

`/sandbox/letterpress.html` is an effect sandbox: the Presswerk dither (`pressFrag`, reused from `src/directions/press/art.ts`) mounted via `initScene` in a centered 4:3 bordered plate (~60vw desktop, 88vw mobile) on a warm near-black studio, to evaluate the letterpress effect as a restrained page accent. Source: `src/sandbox/letterpress.{ts,css}`; supports `?still` and `?nogl`; verified by `scripts/letterpress-check.mjs`.

## Conventions

- Single dark theme, locked page-wide; one accent (`--lime: #C8F542`); surfaces sharp, interactive elements pill-shaped
- Zero em-dashes in any visible copy; zero section eyebrows; max one marquee on the page
- No `window.addEventListener("scroll")` anywhere: Lenis drives ScrollTrigger; all loops run on `gsap.ticker`
- Every animation honors `prefers-reduced-motion` (static shader frame, native scrolling, inline work thumbs)
- Animate only `transform` and `opacity` in the DOM; shader work stays in the fragment shader
- Content lives in `index.html` (static, readable without JS); GSAP applies hidden states at runtime only

## Vault is canonical

When asked "is X documented?" or "do we know Y?", check the vault first — repos document code, the vault documents decisions and context. Use the `adjudant` skill to read/write vault files.

## Claude-specific overrides

Live in `CLAUDE.md` next to this file. CLAUDE.md `@`-imports this file.
