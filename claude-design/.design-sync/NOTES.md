# Design-sync notes — tomfolio dither

## Shape

Off-script manual push (no build, no converter). Components are standalone self-contained HTML files
with `@dsCard` markers on line 1. Pushed directly from repo at their native folder structure so
relative paths stay valid:
- `dither-artefact/index.html` references `./portrait.jpg` ✓
- `dither-rig/index.html` references `../dither-artefact/portrait.jpg` ✓

Future re-syncs: compute SHA-256 of the three files and diff against `_ds_sync.json.sourceHashes`.
Unchanged files → skip. Changed → re-push and re-arm sentinel.

## CDN dependency

Both components load `three@0.184.0` from `https://esm.sh` via importmap. If the Design pane blocks
third-party network, the canvas renders blank. Fix: inline the Three.js ESM build into each HTML
instead of the importmap.

## Asset co-location

`portrait.jpg` must stay a sibling of `dither-artefact/index.html` at `dither-artefact/portrait.jpg`.
Do not move it or rename the folder.

## Conventions header

`conventions.md` was authored from the shader source (colorway vec3 literals verified to exact hex).
Artefact uses colorway 10 (Heather), motif 1 (Disc), weight 0.62, tone-link 0.5.
