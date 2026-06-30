# Tomfolio — session hand-off (2026-06-29)

Snapshot for picking the work up in a **Claude Code CLI** session (moving off the Desktop app).
Evergreen project context lives in `AGENTS.md` + `SHADING.md`; this file is the *current state*.

## Where things are

- **Git worktree / cwd:** `/Users/tomlinson/Projects/VIBE CODING/tomtoolery/.claude/worktrees/tomfolio`
  (branch `tomfolio`, remote `origin` → `git@github.com:TomVDH/slopcore.git`).
- **npm project:** the nested `tomfolio/` dir (its own `package.json`). Run all npm commands from there.
- **The thing we're building:** the artefact dither sandbox → `http://localhost:5184/sandbox/artefact.html?dev`
  (the `?dev` floating panel exposes every control). Sibling rig: `/sandbox/rig.html`.

## Run + verify

```bash
cd "tomfolio"              # the nested npm project
npm install                # first time only
npm run dev                # Vite dev server, http://localhost:5184
npm run build              # tsc + vite — the primary correctness gate (GLSL only fails at runtime)
node scripts/artefact-check.mjs   # headless smoke test (canvas up, nogl/mobile/still ok)
node scripts/rig-check.mjs        # same for the rig
```

The GLSL in `pressFrag` is **not** compiled by the build — a shader syntax error only shows at
runtime in the browser. Eyeball the plate after shader edits.

## Stack (no framework)

Vanilla **TypeScript** + **three.js** (one fullscreen fragment-shader quad) + **GSAP** (drives the
render loop via `gsap.ticker` *and* all tweened uniforms) + **Lenis** (site scroll only; not in the
sandbox). The dev bar is hand-built DOM/CSS.

**Uniform flow (reuse, don't invent):** declare in `pressFrag` (`src/directions/press/art.ts`) →
default in `src/gl/scene.ts` `uniforms` → field in `look` (`src/sandbox/artefact.ts`) → push in
`pushTreatment()` via `scene.setParam()` → dev-bar control via the `select/stepper/toggle/cycle3`
helpers.

## HARD RULES

1. **Track every shading change** (`AGENTS.md` mandate): update `SHADING.md` (uniform inventory +
   dated changelog) **in the same commit** as the shader edit, and mirror to the vault note
   `projects/tomfolio/notes/shading.md` (`/adjudant sync`, or the scripts with
   `--vault-path "~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Claude Cabinet"`).
2. **Palettes are 4-place lockstep** (same count + order, currently **54**): the shader `uColorway`
   if-chain, `PALETTES` (both in `art.ts`), `COLORS` (`artefact.ts`), and the rig `uColorway` select.
3. Tom's working style: full-autonomy creative briefs, ship polished + verified, no Q&A ping-pong.
   He values VFX "juice". Effects should feel **content-derived**, not imposed geometry.
4. This session: **no interactive Playwright** ("no more playwrighting for now") — verify by build +
   the check scripts + careful review, and let Tom eyeball visuals.

## Current state — UNCOMMITTED

Working tree has the last two sessions' artefact work uncommitted (`git status`): `art.ts`,
`scene.ts`, `artefact.ts`, `artefact.css`, `SHADING.md`, `AGENTS.md`, regenerated `previews/*.jpg`.
Build is clean. Recent features landed (newest first):

- **Develop reworked to live *inside* the dither** — grades the source (Pop/Saturation/Colorize)
  then re-dithers it at `uDevCell`; Stage ramps in, Resolve caps replacement. Removed the smooth
  photo overlay (that was the "overlay" feel). Global Reveal is the only smooth-photo path.
- **Full colour never inverts** — `uInvert` dropped from colour paths; Invert/Auto rows hide when
  Full colour is on. `uInvert` is duotone-only now.
- **Canvas fits the photo's native aspect** — `#gl` width set in JS to `plateHeight × imgAspect`
  (capped 90% frame width); OG proportions, landscape fills further right. Field → CSS default.
- **Cloud dissolve stippled through the dither** (`step(bayer4(cellId), cov)`) — affects the marks,
  not a smooth alpha overlay.
- **Mark brightness** (`uMarkBright`, −1–1) — brightness of the dither mark colour vs the palette ink.
- **Dev bar → single floating vertical panel**: collapsible (grip click / backtick) + **free-drag**
  anywhere by its grip header (position persisted). Output **Copy JSON** exports `{look, motion}`.
- **Stepper values are drag-to-scrub** (drag the number ~6px/step).
- **Pixel-cross custom cursor** + click "detonation" (DOM/GSAP, native cursor hidden).
- **FPS presets** Fluid / Cine(24) / **Commo(17)**; live ease-curve preview in Motion.
- Widened all dev-bar control ranges; Motif surfaced contextually in Colour + Cursor groups.

## Pending / next

- [ ] **Commit + push** this batch (Tom hasn't asked yet — confirm first). Slopcore repo, so the
      commit-message bar is low, but still update SHADING.md in the same commit.
- [ ] **Velocity-aware cursor** (explicitly deferred, "after"): deform the isotropic develop disc
      `infl = max(uMouseStrength,uHold)·exp(-md·uCursorRadius)` into an ellipse oriented along the
      pointer's motion vector (squash perpendicular, stretch along travel).
- [ ] Eyeball the new Develop / cloud-stipple / aspect-fit / cursor visually; tune if crunchy.
- [ ] Stray untracked `tomfolio/public/*.jpeg` exist (URL-encoded names) — confirm with Tom whether
      they belong (samples live in `src/samples/`, not `public/`).

## Key files

| File | Role |
|---|---|
| `src/directions/press/art.ts` | `pressFrag` GLSL — the dither engine (the heart). |
| `src/gl/scene.ts` | three.js scene, uniform defaults, render loop, `setParam`/`setImage`. |
| `src/sandbox/artefact.ts` | artefact sandbox: `look` state, dev bar, image loading, cursor. |
| `src/sandbox/artefact.css` | artefact layout + dev-panel + cursor styles. |
| `SHADING.md` | canonical uniform inventory + changelog (keep in lockstep with the vault). |
| `AGENTS.md` | evergreen project context for any agent. |
| `scripts/{artefact,rig}-check.mjs` | headless smoke tests. |
