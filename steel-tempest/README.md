# TONK! 💥

3D wave-survival tank battle (née *Steel Tempest*). Hold Sector 7 against waves of enemy armor.

## Run

```sh
npx serve steel-tempest --no-clipboard
```

- `index.html` — the game
- `tester.html` — the dev tester: live tuning panel, spawners, VFX triggers, telemetry

Three.js comes off the jsDelivr CDN (pinned 0.160); everything else is procedural — zero asset files.

## Controls

| Input | Action |
|---|---|
| `W` / `S` | throttle forward / reverse |
| `A` / `D` | pivot hull |
| Mouse | aim turret |
| `LMB` / `Space` | fire (hold for auto-fire) |
| Wheel | camera zoom |
| `P` | pause · `M` mute · `R` redeploy after death |

## Architecture

FD-style module split under a global `TONK` namespace (`window.TONK = { CFG, DEFAULTS, rt, api }`):

| File | Owns |
|---|---|
| `js/config.js` | `CFG` (live tunables), `DEFAULTS`, `rt` (shared runtime state), math utils |
| `js/scene.js` | renderer, scene, camera, lights, sky |
| `js/audio.js` | procedural WebAudio: SFX bank + engine loop |
| `js/world.js` | analytic heightfield terrain, props, obstacle registry |
| `js/vfx.js` | pooled GPU particles, shockwaves, scorch decals, flash lights |
| `js/tank.js` | tank mesh factory + shared drive physics + turret aim |
| `js/hud.js` | DOM HUD + minimap (reads `rt` only) |
| `js/input.js` | keys/mouse/aim raycast |
| `js/camera.js` | follow cam, orbits, shake, wheel zoom |
| `js/game.js` | combat core: shells, player, enemy AI, pickups, waves, state |
| `js/main.js` | boot, frame loop, resize, `TONK.api` assembly |
| `js/tester.js` | tester page panel wiring (tester.html only) |

The game reads `CFG` live; enemy variant rows are copied at spawn (tester's RESPAWN applies them). `TONK.api` drives everything (`state/start/startRange/spawn/god/heal/boom/killAll/setTimeScale/copyCfg/…`) — `window.__tank` is a legacy alias.

## What's in the box

- Rolling-dune terrain (analytic heightfield — tanks pitch/roll over slopes), rocks, ruins, dead trees, dragon-teeth arena boundary
- Ballistic shells with tracers, lead-computed AI gunnery, line-of-sight checks
- Three enemy variants: **standard**, fast **scouts** (wave 2+), slow **heavies** (wave 3+), scaling per wave
- Kills leave charred wrecks that become cover; turrets pop off and bounce
- Pooled GPU particle VFX, 100% procedural WebAudio, military HUD, hitstop + screen shake
- Repair drops, score + accuracy stats, persistent sector record (`localStorage`, migrates from the Steel Tempest key)
