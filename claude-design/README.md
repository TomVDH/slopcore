# Claude Design bundle — tomfolio dither

Self-contained design-system components, staged for `/design-sync` to push to a
claude.ai/design project. Each is a single standalone HTML (three.js from the
`esm.sh` CDN via importmap; shader, engine, controller, and CSS all inlined — no
Vite, no build step). The first line of each is a `@dsCard` marker, which the
Design System pane reads to build the card index.

## Components

| Path | `@dsCard group` | Role |
|---|---|---|
| `dither-artefact/index.html` (+ `portrait.jpg`) | **Artefact** | The design. The Presswerk dither bled into the bottom-left corner over the deep gray-purple (Heather) ground, dithering the portrait; right-aligned section menu re-dithers per option (instant). This is the binding piece. |
| `dither-rig/index.html` | **Sandbox** | A **non-binding** source — the live tuning tool. Full control panel (motif, colorway, cell density, tone, threshold, registration, etc.) + Sample / Image (drag-drop) buttons. Labeled "SANDBOX · NON-BINDING SOURCE" in its header. Use it to derive looks, not as a design spec. |

## Push to Claude Design

From this folder, run the skill (it can't be auto-invoked — you run it):

```
/design-sync
```

It will list your writable design-system projects (or create one), build the
path diff, show you the plan to approve, and push the files. The `@dsCard` markers
mean no manual card registration is needed. Sync is incremental — one component at
a time, never a wholesale replace.

## Notes / caveats

- **CDN dependency:** both load `three@0.184.0` from `https://esm.sh`. If the design
  pane blocks third-party network, the canvas renders blank — in that case inline
  three.js into each file instead of the importmap. (Verified working in system
  Chrome over a plain HTTP server.)
- **Assets:** `dither-artefact` references its sibling `./portrait.jpg` (640px,
  ~100KB). The rig's **Sample** button loads `../dither-artefact/portrait.jpg`, so
  keep the two folders side by side. If the pane needs each component fully
  single-file, base64-inline the image.
- **Source of truth:** these are exports of the live work in
  `tomfolio/src/sandbox/{artefact,rig}.{ts,css}` + `src/directions/press/art.ts`.
  Re-export from there if the shader/controller changes.
- Honors `prefers-reduced-motion` (static frame) and resizes responsively.
