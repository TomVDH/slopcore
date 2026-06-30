# Shading — canonical record (NAIL IT DOWN)

The dither shading is the heart of tomfolio. **This file is the source of truth for the
current shader state, and every shading change MUST be logged here in the same commit.**
Miss nothing: uniforms (name · units · default · range · meaning), palettes, cursor modes,
and the reveal / develop / crossfade / motion behaviours.

> Units rule: the **same unit for the same concept**, everywhere. Cell density is always a
> *cell count* (`uCell`, `uDevCell`); polarity is always `uInvert`; etc. No multipliers where
> a sibling control uses absolute counts.

## Files + lockstep

- **Shader:** `src/directions/press/art.ts` — the `pressFrag` template string. The only place
  the GLSL lives; reused by the rig, letterpress, the press direction, and the artefact.
- **Uniform defaults:** `src/gl/scene.ts` (the `uniforms` object) + `setImage` / `setImage2`.
- **Palettes — FOUR lockstep locations** (same count + order; currently **54**):
  1. the shader `uColorway` if-chain (`art.ts`)
  2. `PALETTES` (`art.ts`)
  3. `COLORS` (`src/sandbox/artefact.ts`)
  4. the rig `uColorway` select `options` (`src/sandbox/rig.ts`)

## Uniform inventory

| Uniform | Units | Default | Range | Meaning |
|---|---|---|---|---|
| `uCell` | cell count | 150 | 60–320 | base screen frequency; on-screen mark size = `uRes.y / uCell` |
| `uMotif` | enum | 1 | 0–4 | 0 dots, 1 disc, 2 x, 3 plus, 4 dash |
| `uMotifWeight` | 0–1 | 0.62 | 0.05–1 | mark thickness / dot radius |
| `uMotifAngle` | turns | 0 | 0–1 | mark rotation in its cell |
| `uMotifTone` | 0–1 | 0.5 | 0–1 | stroke thickens with cell darkness |
| `uThreshold` | bias | 0.03 | −0.2–0.3 | Bayer threshold bias (`bayer4` mean = 0.5) |
| `uColorway` | index | 10 (Heather) | 0–53 | palette select |
| `uColorDither` | bool | 0 | 0/1 | 0 duotone (paper/ink), 1 full-colour ordered dither |
| `uColorLevels` | steps | 4 | 2–8 | posterise steps per channel in colour mode |
| `uToneBase` | 0–1 | 0.42/0.46 | — | procedural field base luminance |
| `uToneContrast` | 0–1 | 0.34/0.30 | — | field grain contrast |
| `uToneScale` | scale | 1.7/1.6 | — | field scale |
| `uDrift` | speed | 0.05/0.03 | — | field drift speed |
| `uImageOn` | 0–1 | 0 | 0–1 | field ↔ image crossfade amount |
| `uImage` / `uImageRes` | sampler | — | — | primary image slot + pixel size |
| `uImage2` / `uImage2Res` | sampler | placeholder | — | second image slot (image→image crossfade) |
| `uXfade` | 0–1 | 0 | 0–1 | 0 sample uImage, 1 sample uImage2 (no field flash) |
| `uImageBrightness` | added | 0 | −0.5–0.5 | image luminance offset (before invert + threshold) |
| `uImageContrast` | mult | 1 | 0.4–2.6 | image contrast around mid (before invert + threshold) |
| `uInvert` | bool | 0 | 0/1 | polarity flip; resolved (in `artefact.ts`) from the Invert control: Off=0, On=1, **Auto** (default) = invert when `paperLum < inkLum` (dark-paper stock) so a natural photo reads positive on any colorway |
| `uFadeMode` | enum | 2 | 0–2 | edge dissolve: 0 off, 1 simple radial, 2 cloud |
| `uFadeScale` | freq | 1.2/3 | 1–8 | cloud-noise frequency (mode 2) |
| `uReveal` | 0–1 | 0 | 0–1 | crossfade dither → true-colour photo (natural light); cell ramps up |
| `uImageState` | bool | 0 | 0/1 | dev: show the undithered adjusted source |
| `uCursorMode` | enum | 1 | 0–5 | 0 Off, 1 Clear, 2 Ink, 3 Bias, 4 Negative, 5 Develop |
| `uCursorAmp` | 0–1.5 | 0.4 | 0–1.5 | cursor effect strength |
| `uCursorRadius` | falloff | 2.2 | 0.6–6 | cursor disc falloff rate (larger = tighter) |
| `uHold` | 0–1 | 0 | 0–1 | static persistence floor under the movement-decayed strength |
| `uCursorEdge` | 0–1 | 0.25 | 0–0.8 | Negative-mode disc hardness |
| `uDevCell` | cell count | 450 | 120–960 | Develop sub-grid cell count (same units as `uCell`) |
| `uDevColor` | bool | 1 | 0/1 | Develop: 1 resolve to true-colour photo, 0 stay monotone |
| `uCrossOn` / `uCrossSize` / `uCrossPos` | — | 1 / 0.075 / (0.62,0.58) | — | aviation-red registration cross |
| `uPress` / `uPressFalloff` | — | 0.4 / 2.2 | — | **LEGACY / dead** — kept declared but unread; superseded by the cursor uniforms |
| `uMouse` / `uMouseStrength` | runtime | (0,0) / 0 | — | cursor position + movement-decayed strength (scene.ts) |
| `uRes` / `uTime` / `uEnergy` / `uScrollVel` | runtime | — | — | system |

## Cursor modes (`uCursorMode`)

One shared per-cell influence scalar `infl = max(uMouseStrength, uHold) * exp(-md * uCursorRadius)`,
built only from `p` (one value per cell) — never varies `cell`/`cellId` spatially (that shatters the grid).

- **0 Off** — no effect.
- **1 Clear** (default) — `lum += amp·infl`: lifts ink, opens paper under the cursor.
- **2 Ink** — `lum -= amp·infl` + thickens `wEff`: presses denser, swollen marks in.
- **3 Bias** — subtracts from the Bayer `threshold`: marks fill in the screen's own dot order.
- **4 Negative** — local polarity flip via a `smoothstep(uCursorEdge, …)` disc.
- **5 Develop** — local resolve: a finer **uniform sub-dither at `uDevCell`** blends in (Detail),
  then (if `uDevColor`) crossfades to the true-colour photo. `max()`-combined with `uReveal`.

## Behaviours

- **Reveal** (`uReveal`, GSAP-tweened in `artefact.ts` `rev`): crossfades to the **true-colour
  photo in natural light** — no invert/brightness/contrast on the revealed source, so it never
  passes through a negative — while the cell count ramps geometrically (`REVEAL_CELL_MULT`).
- **Image → image** is a true crossfade through `uImage2`/`uXfade` (two slots, promote on complete);
  **field ↔ image** uses `uImageOn`. No procedural-field flash between photos.
- **Invert** is an Off / On / **Auto** control (`look.invertMode`), resolving to `uInvert`. Auto
  (default) is **palette-based**: invert when `paperLum < inkLum` (dark-paper stock), so a natural
  photo reads positive on any colorway with no manual toggling. Polarity is a *palette* property,
  not an image one — an image-histogram heuristic (designed via workflow) was rejected because it
  renders dark photos as negatives. A dev-bar status row shows the Auto decision + stock.
- **Motion** (DOM/GSAP, not a uniform): all dither/reveal tweens share one ease + duration via the
  artefact `EASES` list + `motion` (dev-bar Motion group). Default **quint ease-out, 0.6s**.

## Palette families (54)

0–23 original print/letterpress set (Bone … Indigo Sun). 24–53 added 2026-06-29 in six
theme-dissenting families: **Jewel on jet** (24–29), **Candy/pastel** (30–35),
**Neon noir** (36–40), **Earth/botanical** (41–45), **Vapor/Y2K** (46–49), **Bold drench** (50–53).

## Changelog

Newest first. Log EVERY shading change here.

### 2026-06-29
- **Auto invert reintroduced** as Off/On/**Auto** (`look.invertMode`, default Auto). Auto is
  palette-based (`paperLum < inkLum` → invert) — correct natural polarity on every colorway; a
  dev-bar status row reports it. NOTE: a workflow-designed image-histogram ("mass-to-ground")
  heuristic was built and then REJECTED — it inverts dark photos (renders them as negatives);
  natural polarity is a palette property, not an image one.
- **Detail by cell count.** `uDevFine` (multiplier) → `uDevCell` (absolute cell count, same units
  as `uCell`); Develop fine cell = `uRes.y / uDevCell`. Default 450, range 120–960 step 12.
- **Dev bar:** clipping-proof layout — divisor-of-6 column counts (6/3/2/1 by breakpoint), viewport
  height cap + internal scroll. Develop **Colorize** toggle (`uDevColor`). Contextual controls hide
  (not dim). Merged Marks+Edge → "Screen".
- **Motion controls** — live Ease (cubic/quart/quint/expo/circ out, quint in-out, back out) +
  Duration; default quint ease-out 0.6s (was symmetric quad).
- **+30 colorways → 54** (six new families); fixed Bone (index 0) shader fall-through to Sepia.
- **Cursor effect modes** (Off/Clear/Ink/Bias/Negative/Develop) + Develop local cell-count increase.
- **Reveal → natural-light** (removed the `effInvert` reveal ramp that passed through a negative).
- **Image→image crossfade** via a second texture slot (`uImage2`/`uXfade`) — no field flash.
- **Auto image polarity** (`imgInv` by palette paper luminance) added, then **reverted** ("no auto").
- **Reveal/depixel sync** — geometric cell ramp so the marks resolve in step with the crossfade.
- **Inverted-image white-out @ reveal** fix.
