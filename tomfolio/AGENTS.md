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

`/sandbox/rig.html` is the registration-plate rig: the same Presswerk dither held as the dominant full-bleed plate beside a live control panel that drives every editable shader uniform through `scene.setParam` (motif shape, colorway, tone, cell density, cursor press, registration cross). Marks are distance-field motifs (Dots, Disc, X, Plus, Dash), rotatable via `uMotifAngle` and optionally weighted by tone via `uMotifTone`; palettes swap via `uColorway`. The dither engine is tone-source agnostic: drop an image on the plate (or use the Image button) to dither a real photo instead of the procedural field (`uImageOn` + `scene.setImage`), turning the plate into a halftone printer where `uCell` is the screen frequency and Disc gives round halftone dots. The Sample button loads the bundled portrait in the Heather (artefact) palette, so the rig can preview and tune exactly what the artefact corner renders. Source: `src/sandbox/rig.{ts,css}`; supports `?still` and `?nogl`; verified by `scripts/rig-check.mjs`, which also captures motif stills and a dithered synthetic image by driving the dev-exposed `window.scene`.

`/sandbox/artefact.html` is an empty-viewport study, inset 10px so the deep gray-purple ground reads as a framed plate over black: the dither is anchored in the bottom-left and CSS-masked so the plate dissolves into the ground, leaving only cream marks. It uses the Heather colorway, whose paper equals the page ground (`#2a2636`) exactly so there is no plate seam (keep the two in lockstep). A placeholder right-aligned menu of big display headers re-dithers the field per option (click to switch, instant): `uImageOn` dithers a portrait (`public/portrait.jpg`, a placeholder until the real photo is dropped in) so the marks form the image, and the other options reshape the marks. The shader crossfades field and image via `uImageOn`, so an animated transition can be re-enabled later. Source: `src/sandbox/artefact.{ts,css}`; supports `?still` and `?nogl`; verified by `scripts/artefact-check.mjs`.

### System (component foundation)

`src/system/` is the concise, brand-neutral foundation for the reworked site: `tokens.css` (semantic colors, fluid type, spacing, motion; one accent = registration red `--accent: #E61919`), `fonts.css`, `base.css` (reset + a11y + the custom cursor styles), `components.css` (`.bar`, `.mark` logo-slot placeholder, `.link-mono`, `.eyebrow`, `.btn`, `.frame` media plate, `.fig` corner caption, typography helpers). Import once per page: `import { initCursor } from "../system"; initCursor();` then page CSS after. The custom cursor is a registration crosshair (`cursor.ts`) that snaps to the accent over interactive targets; it only engages on fine pointer + motion enabled, hides the native cursor only while running (`body.has-cursor`), and is a no-op under touch / reduced-motion. The brand wordmark is intentionally a neutral `+` placeholder pending a rebrand. The letterpress sandbox is the first page built on this system.

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
