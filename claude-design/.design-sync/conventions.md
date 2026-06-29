# Tomfolio / Dither — design conventions

These are **display / atmosphere components** — not UI primitives. They render via WebGL (Three.js, Bayer
4×4 ordered dither) and are consumed as standalone HTML files embedded with `<iframe>` or opened
full-page. Both load `three@0.184.0` from `https://esm.sh` via importmap.

## Components in this project

| Card | Group | Role |
|---|---|---|
| `dither-artefact/index.html` | **Artefact** | **The binding design spec.** Corner dither field bled over the Heather ground, portrait dithered bottom-left, right-aligned section nav. Use this as the reference — parameter values here are settled choices. |
| `dither-rig/index.html` | **Sandbox** | **Non-binding tuning tool.** Full shader control panel. Use it to explore colorway / motif / density options; the result feeds back to the Artefact, not the other way around. |

## Embedding

Each component is a self-contained HTML file. Embed with a full-bleed iframe:

```html
<iframe
  src="./dither-artefact/index.html"
  style="border:0; width:100%; height:100%; display:block;"
  title="Dither artefact"
></iframe>
```

Keep `dither-artefact/` and `dither-rig/` as siblings — the rig's Sample button loads
`../dither-artefact/portrait.jpg` via relative path.

## Design language

**Print / letterpress aesthetic.** The vocabulary is plate notation (FIG. A, FIG. C), registration
crosses (the rig's red cross-hair overlay), modular 3-column header and footer grids with 1px gap
borders, and uppercase monospace labels throughout.

**Typography.** Two families only:
- **Clash Display 600** (Fontshare) — display / nav text in the Artefact. Large, tight (`line-height:
  0.92`, `letter-spacing: -0.015em`), uppercase.
- **JetBrains Mono** (Google Fonts) — all metadata, captions, controls, labels. `font-size: 0.7rem`,
  `letter-spacing: 0.16em`, uppercase.

**The dither field** bleeds from the bottom-left corner, masked by a radial gradient
(`radial-gradient(135% 135% at 0% 100%, #000 22%, transparent 72%)`). It is not full-bleed.

## Artefact CSS tokens

```css
:root {
  --ground: #2a2636;  /* Heather — the plate ground, deep gray-purple */
  --cream:  #f4efdd;  /* primary text + nav stroke */
}
```

The outer frame is a 10px inset black border (`position: fixed; inset: 10px`) with the ground
filling inside. Active nav item: `color: var(--cream)`, no stroke. Inactive: `color: transparent`,
`-webkit-text-stroke: 1.2px rgba(244,239,221,0.42)`.

## Sandbox / Rig CSS tokens

```css
:root {
  --bg:           #15140f;
  --bg-2:         #1d1b15;
  --fg:           #e8e3d6;
  --muted:        #918a78;
  --line:         rgba(232,227,214,0.16);
  --line-strong:  rgba(232,227,214,0.5);
  --accent:       #e61919;
  --font-mono:    "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  --text-xs:      0.7rem;
  --dur:          0.3s;
}
```

## Shader colorways (11 named presets, `uColorway` uniform 0–10)

| # | Name | Paper | Ink | Accent |
|---|---|---|---|---|
| 0 | Bone / Carbon | `#f4f4f0` | `#0a0a0a` | `#e61919` |
| 1 | Blueprint | `#163a5c` | `#dce6f0` | `#fbca4f` |
| 2 | Sepia | `#e8dfc8` | `#2e2317` | `#c72e1c` |
| 3 | Acid Lime | `#15140f` | `#c8f542` | `#e61919` |
| 4 | Cyanotype | `#0b1f2e` | `#d8e8e2` | `#f49a2e` |
| 5 | Riso Pink | `#f5f2ec` | `#f12d73` | `#1c1c1e` |
| 6 | Riso Blue | `#f5f4ee` | `#0044a5` | `#f12d73` |
| 7 | Steel | `#1b1e23` | `#b8c2cc` | `#4ccae2` |
| 8 | Oxblood | `#210b0d` | `#e6decc` | `#d93326` |
| 9 | Mono Invert | `#0b0b0c` | `#f3f2ef` | `#e61919` |
| 10 | Heather | `#2a2636` | `#f4efdd` | `#c68d9a` |

The Artefact uses **Heather** (colorway 10). When adapting the look for a new design, pick a colorway
from the table — do not invent raw hex values, as they won't match the shader's internal palette.

## Motif types (`uMotif` uniform 0–4)

`Dots` (0) · `Disc` (1) · `X` (2) · `Plus` (3) · `Dash` (4). The Artefact uses **Disc** (1) at weight
`0.62`, tone-link `0.5`. The rig's Copy button exports all current uniforms as JSON.

## Accessibility

Both components honor `prefers-reduced-motion` — the animation loop stops and a static frame renders
at `t = 20.0`. No changes needed; it's wired in.
