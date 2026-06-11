# STEEL TEMPEST 💥

Single-file 3D tank battle. Hold Sector 7 against waves of enemy armor.

## Run

```sh
npx serve steel-tempest --no-clipboard
```

(or any static server — it's one `index.html`; Three.js comes off the jsDelivr CDN)

## Controls

| Input | Action |
|---|---|
| `W` / `S` | throttle forward / reverse |
| `A` / `D` | pivot hull |
| Mouse | aim turret |
| `LMB` / `Space` | fire (hold for auto-fire) |
| Wheel | camera zoom |
| `P` | pause · `M` mute · `R` redeploy after death |

## What's in the box

- Rolling-dune terrain (analytic heightfield — tanks pitch/roll over slopes), rocks, ruins, dead trees, dragon-teeth arena boundary
- Ballistic shells with tracers, lead-computed AI gunnery, line-of-sight checks
- Three enemy variants: **standard**, fast **scouts** (wave 2+), slow **heavies** (wave 3+), scaling per wave
- Kills leave charred wrecks that become cover; turrets pop off and bounce
- Pooled GPU particle VFX: fireballs, sparks, dirt geysers, smoke columns, shockwave rings, scorch decals
- 100% procedural WebAudio: engine chug tied to throttle, cannon cracks, shell whiz-bys, explosions, wave horns
- Military HUD: armor bar, minimap, reload arc on the crosshair, hit markers, kill feed, hitstop + screen shake
- Repair drops, score + accuracy stats, persistent sector record (`localStorage`)

## Debug console

`window.__tank` — `.state()`, `.boom(x, z, scale)`, `.killAll()`, `.hurt(n)`, `.fire()`, `.aim(x, z)`
