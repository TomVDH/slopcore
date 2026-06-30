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

## Shading — canonical, NAIL IT DOWN (track every change)

The dither shading is the heart of this project. **Every change to the shading MUST be tracked — miss nothing.** That means: the GLSL in `src/directions/press/art.ts` (`pressFrag`), every shader **uniform** (its name, units, default, range, meaning), the **palettes**, the **cursor modes**, and the **reveal / develop / crossfade / motion** behaviours.

Process, non-negotiable:

1. Log it in **[`SHADING.md`](SHADING.md)** — the canonical, in-repo shading record (full uniform inventory + changelog). Add a changelog entry (what changed, why, before/after of any uniform or behaviour) and update the inventory **in the same commit** as the shading change. Mirror to the **vault** note `projects/tomfolio/notes/shading.md`. **Vault location** (Obsidian's own iCloud container, not the project's — auto-discovery fails, pass it explicitly): `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Claude Cabinet/` (project folder `projects/tomfolio/`). For adjudant: `--vault-path "…/Claude Cabinet"`.
2. The baseline inventory below is a quick-reference summary; `SHADING.md` is the authoritative source of truth for the current shader state.
3. **Same units throughout for the same concept.** Cell density is always a *cell count* (`uCell`, `uDevCell`); polarity is always `uInvert`; etc. Never mix units (no multipliers where the sibling control uses absolute counts).

### Canonical files + lockstep

- Shader: `src/directions/press/art.ts` — the `pressFrag` template string (the only place the GLSL lives; reused by rig, letterpress, the press direction, and the artefact).
- Uniform defaults: `src/gl/scene.ts` (the `uniforms` object) + `setImage` / `setImage2`.
- Palettes have **ONE source of truth**: `PALETTE_DATA` in `src/palettes.ts` (currently **54**). Everything is derived from it — `PALETTES` (hex), `COLORS` (dev-bar short labels), `COLORWAY_NAMES` (rig select), and the shader `uColorway` if-chain via `generatePaletteGLSL()` spliced into `pressFrag`. Edit a colorway THERE and nowhere else; `scripts/palettes-check.mjs` enforces it. (Was 4 hand-synced copies; collapsed in the Phase-1 health pass — see SHADING.md.)

### Baseline inventory (current shader state)

Marks / screen: `uMotif` (0 dots,1 disc,2 x,3 plus,4 dash), `uMotifWeight`, `uMotifAngle`, `uMotifTone`, `uCell` (cell count; on-screen mark size = `uRes.y / uCell`), `uThreshold` (Bayer bias).
Field (procedural tone): `uToneBase`, `uToneContrast`, `uToneScale`, `uDrift`.
Image source: `uImage` + `uImageRes` + `uImageOn` (field↔image), `uImage2` + `uImage2Res` + `uXfade` (image→image crossfade, no field flash), `uImageBrightness`, `uImageContrast`, `uInvert` (manual polarity — no auto; **duotone only**, full colour never inverts).
Colour: `uColorway` (0–53), `uColorDither` (0 duotone / 1 full-colour ordered dither), `uColorLevels` (posterise steps), `uMarkBright` (brightness offset on the dither mark colour itself — palette ink / colour dot — distinct from the source-image brightness).
Edge dissolve: `uFadeMode` (0 off,1 simple,2 cloud), `uFadeScale` (cloud frequency), `uCloudSpeed` (cloud sideways scroll speed; 0 static — seamless continuous fbm offset, decoupled from `uDrift`), `uFadePos` (vec2 anchor in [0,1] — moves where the dissolve originates, default 0,0 = bottom-left). The dissolve is applied **through the Bayer dither** (`step(bayer4(cellId), cov)`), stippling the fade into the marks rather than overlaying a smooth alpha. `uMaskView` (dev) outputs the raw `cov` as grayscale to inspect the mask shape.
Reveal: `uReveal` 0→1 crossfades the dither to the **true-colour photo in natural light** (no invert/brightness/contrast on the revealed source) while the cell count ramps up geometrically (resolve). Driven from `artefact.ts` (`rev`, `REVEAL_CELL_MULT`).
Cursor (`uCursorMode`: 0 Off, 1 Clear, 2 Ink, 3 Bias, 4 Negative, 5 Develop), with `uCursorAmp` (strength), `uCursorRadius` (disc falloff), `uHold` (static persistence), `uCursorEdge` (Negative disc hardness). Develop knobs: `uDevCell` (Detail, sub-grid **cell count**), `uDevStage` (grain→photo handoff), `uDevResolve` (develop depth), `uDevColor` (Colorize amount 0 mono–1 colour), `uDevSat` (saturation), `uDevSharp` (Pop / unsharp) — Develop lives **inside the dither**: it grades the source (Pop/Sat/Colorize) then **re-dithers it** at `uDevCell` (Stage ramps it in, Resolve caps how fully it replaces the base marks), NOT a smooth photo overlaid on the marks. The only smooth-photo path is the global Reveal. One shared per-cell influence scalar `infl`; never varies `cell`/`cellId` spatially (would shatter the grid).
Dev inspection: `uImageState` (show the undithered adjusted source).
Registration: `uCrossOn`, `uCrossSize`, `uCrossPos`.
Legacy/dead (kept declared, unread): `uPress`, `uPressFalloff` (superseded by the cursor uniforms).
Motion (DOM/GSAP, not a uniform): all dither/reveal tweens share one ease + duration via the artefact `EASES` list + `motion` (dev-bar Motion group); default quint ease-out, 0.6s. Plus an **FPS** toggle (Cine `fps(24)` / Commo `fps(17)` retro / Fluid uncapped, default Fluid) and a live ease-curve preview (inline SVG of the selected ease + a real-time playhead). The dev bar is a single floating **vertical panel** — collapsible (grip click / backtick) and **free-draggable** anywhere by its grip header (position persisted + clamped on restore); stepper values are **drag-to-scrub**; every control label has a hover **ⓘ info-circle** (concise helper from the `HELP` map); Output > **Copy JSON** exports a full `{look, motion}` snapshot (clipboard, prompt fallback) and **Show fade mask** (`uMaskView`) renders the dissolve mask as grayscale. A pixel-cross **custom cursor** (box-shadow crosshair, native hidden) tracks the pointer and detonates a ring of dither pixels on a plate click (DOM/GSAP).

The artefact dev bar (`?dev`) exposes the editable subset, grouped Screen / Colour / Image / Cursor / Motion / Output, with contextual controls shown only for the active mode.

### Iteration shelf

`/shelf.html` renders every hero shader candidate live, side by side, grouped by stylistic family (Flow, Architecture, Print & craft, Glass, Light & nature). Clicking a tile opens the real hero with that shader via `?shader=<id>`. Candidates live in `src/gl/variants/` (one file each, shared uniform interface); promote a winner by changing `DEFAULT_VARIANT_ID` in `src/gl/variants/index.ts`.

Verification helpers: `?still` (works on both pages) renders one static frame and skips all animation loops; on the shelf in dev, `window.__shelfSnapshot()` returns a labeled contact-sheet JPEG data URL of every tile, which is how shader rounds get reviewed without relying on browser screenshot tooling.

### Direction shelf

`/directions/` is the shelf of complete design languages (see `DESIGN.md` for the token map). Each direction is `directions/<id>.html` plus `src/directions/<id>/{page.ts, page.css}` (canvas/art module alongside), importing the shared `src/directions/base.css` reset and rendering the same facts from `src/content/portfolio.ts`. Every direction page supports `?still` and carries a fixed `dir-pill` back to the shelf.

Per-direction verification scripts live in `scripts/` (see `brut-shots.mjs` for labeled stills into `previews/` and `brut-check.mjs` for functional assertions, both driving system Chrome via playwright against the dev server). Useful because preview-browser tabs are often occluded: occluded tabs freeze CSS transitions and smooth scrolling mid-flight, so screenshot tooling there lies.

### Sandbox

`/sandbox/letterpress.html` is an effect sandbox: the Presswerk dither (`pressFrag`, reused from `src/directions/press/art.ts`) mounted via `initScene` in a centered 4:3 bordered plate (~60vw desktop, 88vw mobile) on a warm near-black studio, to evaluate the letterpress effect as a restrained page accent. Source: `src/sandbox/letterpress.{ts,css}`; supports `?still` and `?nogl`; verified by `scripts/letterpress-check.mjs`.

`/sandbox/rig.html` is the registration-plate rig: the same Presswerk dither held as the dominant full-bleed plate beside a live control panel that drives every editable shader uniform through `scene.setParam` (motif shape, colorway, tone, cell density, cursor press, registration cross). Marks are distance-field motifs (Dots, Disc, X, Plus, Dash), rotatable via `uMotifAngle` and optionally weighted by tone via `uMotifTone`; palettes swap via `uColorway`. The dither engine is tone-source agnostic: drop an image on the plate (or use the Image button) to dither a real photo instead of the procedural field (`uImageOn` + `scene.setImage`), turning the plate into a halftone printer where `uCell` is the screen frequency and Disc gives round halftone dots. The Sample button cycles the dither sample photos, which are auto-discovered from `src/samples/` via `import.meta.glob` (drop a jpg/png in that folder and it joins the cycle — no code change), shown in the Heather palette; an Invert toggle (`uInvert`) flips tone polarity, Edge fade (`uFade`) is the shader cloud dissolve, and Full takes the plate fullscreen. Source: `src/sandbox/rig.{ts,css}`; supports `?still` and `?nogl`; verified by `scripts/rig-check.mjs`, which also captures motif stills and a dithered synthetic image by driving the dev-exposed `window.scene`.

`/sandbox/artefact.html` is an empty-viewport study, inset 10px so the deep ground reads as a framed plate over a margin in the colorway **ink** colour (`var(--ink)`): the dither fills the full plate height, left-aligned (the `#gl` canvas width is sized in JS to the loaded photo's **native aspect** — capped to 90% frame width — so images read at original proportions and landscape shots fill further right; reverts to the CSS box for the field), and dissolves into the ground by the shader's edge dissolve (`uFadeMode`: 0 off, 1 simple radial-from-corner, 2 cloud — the default), leaving only cream marks. In cloud mode the radial fade is perturbed by a slowly drifting fbm (`uFadeScale`, the dev-bar "Cloud" stepper) so the boundary reads wispy and alive. (An image-endemic "blob" mask was prototyped here and reverted — a cleaner, more organic way to smooth the edges of a dithered photo is still open work.) It defaults to the **Cyber** colorway (`look.colorway = 37`), whose paper equals the page ground (`#04090c`) exactly so there is no plate seam. The CSS fallback `--ground`/`--ink`/`--art-cursor` (`artefact.css`), the HTML `theme-color` (`artefact.html`), and the `artefact-check.mjs` ground assertion all hardcode the default colorway's paper/ink — keep the four in lockstep when changing the default. The full load-in defaults live in the `look` literal (snapshotted into `general` at boot; no localStorage persists it) and `motion` (`artefact.ts`). The palette has **54 colorways** (`uColorway`), all derived from the single source `PALETTE_DATA` in `src/palettes.ts` (see the Shading section above). The dither can render duotone (palette paper/ink) or **full colour** (`uColorDither`): a per-channel ordered Bayer dither of the photo posterised to `uColorLevels` steps. A right-aligned menu lists one item per auto-discovered `src/samples/` image plus Field; image→image is a **true crossfade through a second texture slot** (`uImage2` / `uXfade`) — no procedural-field flash — while field↔image uses `uImageOn`. The menu arrangement is switchable via **`?layout=`** (`rail` default = right-aligned display headers; `spine` = labels rotated up the right margin; `ladder` = mono captions stepping down the dither's fading edge) — all three re-place the same `.art-menu`; the content reveal (image swap) is identical. Each `.art-link` carries a `--i` index for the ladder stagger. The **Reveal** button (`uReveal`) crossfades to the true-colour photo in natural light (no invert/brightness/contrast) while the cell count ramps; a **Hover** toggle beside it makes menu items swap on hover; the **Cursor** modes (incl. Develop, which raises detail to `uDevCell` and optionally colourizes) press locally. **Easter egg:** a **triple-click** over the plate/menu (not the dev bar) fires `GlScene.cursorBurst` — for a brief moment it drops `uCursorRadius` (bigger disc) so the cursor effect balloons across the plate, while holding `uMouseStrength` flat (so it doesn't fade), then restores the radius and lets strength decay; fine-pointer + motion only. The cloud mask supports `uNoiseType` (FBM / Ridged / Voronoi) and independent X/Y frequency. See the **Shading** section above for the full uniform/behaviour baseline. With `?dev`, the dev bar (Screen / Cloud / Colour / Image / Cursor / Develop / Motion / Output) exposes the editable subset. Source: `src/sandbox/artefact.{ts,css}`; supports `?still` and `?nogl`; verified by `scripts/artefact-check.mjs`.

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
