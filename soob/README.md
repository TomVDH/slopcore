# SOOB! 🫧

3D submarine combat in hostile shipping lanes. Sink tonnage, evade the escorts, mind your noise — *your speed is your signature, and the thermal layer hides you.*

## Run

```sh
npx serve soob --no-clipboard
```

- `index.html` — the game
- `tester.html` — sea trials: live tuning panel, spawners, VFX triggers, telemetry

Three.js comes off the jsDelivr CDN (pinned 0.160); everything else is procedural — zero asset files.

## Controls

| Input | Action |
|---|---|
| `W` / `S` | engine telegraph (ASTERN ↔ FLANK) |
| `A` / `D` | rudder |
| `Q` / `E` | dive / rise |
| Mouse | fire solution (hover a ship to lock the TDC) |
| `LMB` / `Space` | launch torpedo |
| `F` | active ping — reveals everything, including you |
| `C` | silent running · `X` noisemaker decoy |
| Wheel | camera zoom |
| `P` | pause · `M` mute · `R` put to sea after loss |

## How it hunts you

Escorts listen. Your **noise signature** is your telegraph setting plus cavitation
(speed past a depth-raised threshold — deep boats run faster quietly), plus
transients (torpedo launches, your own ping, hull groans at crush depth).
Passive sonar accumulates **suspicion** → they investigate your last known
position → they run in and drop **depth-charge patterns** fused to their
estimate of your depth. Counterplay:

- **The thermal layer** (≈100–135 m, jittered per patrol) blankets sound — cross it and their hearing and pings degrade hard.
- **Bottom clutter** — hug the seabed and you blur into the return.
- **Silent running** caps you at AHEAD SLOW, cuts your noise to a third, pauses tube reloads.
- **Noisemaker decoys** scream for 15 s; escorts prosecute the ghost.
- Explosions **deafen** every sonar nearby — the barrage itself is an escape window.
- Surface or linger at periscope depth in daylight and the **deck guns** will remind you why submarines submerge.

Convoys cross the patrol grid continuously; tonnage raises **heat** — more
escorts, sharper sonar, and eventually dedicated hunter groups. Tankers take
two fish and burn on the surface before they go down. Best patrol persists in
`localStorage`.

## Architecture

FD-style module split under a global `SOOB` namespace (`window.SOOB = { CFG, DEFAULTS, rt, api }`):

| File | Owns |
|---|---|
| `js/config.js` | `CFG` (live tunables), `DEFAULTS`, `rt` (shared runtime state), math utils |
| `js/scene.js` | renderer, camera, lights, the depth grade (fog/colour/light vs camera depth) |
| `js/world.js` | analytic seabed heightfield, surface caustic sheets, light shafts, thermal layer pane |
| `js/audio.js` | procedural WebAudio: depth-muffled master, pings + echo tails, muffled explosions, creaks, prop loop |
| `js/vfx.js` | pooled GPU particles (bubbles/silt), pressure spheres, foam discs, ping rings, emitters, marine snow |
| `js/boats.js` | hull factories: sub, freighter, tanker, escort, torpedo, depth charge, decoy |
| `js/hud.js` | sonar scope (phosphor persistence), depth gauge, telegraph, SIG meter, feeds |
| `js/input.js` | keys/mouse, canvas-rect aim ray |
| `js/camera.js` | underwater chase cam, trauma shake, wheel zoom |
| `js/game.js` | combat core: boat physics + noise, detection model, torpedoes/TDC, escort AI, convoys, scoring |
| `js/main.js` | boot, frame loop, resize, `SOOB.api` assembly |
| `js/tester.js` | tester page panel wiring (tester.html only) |

The game reads `CFG` live; ship variant rows are copied at spawn. `SOOB.api`
drives everything (`state/start/startRange/spawn/spawnConvoy/fire/ping/decoy/`
`silent/setDepth/setTelegraph/aimAt/god/heal/boom/killAll/setTimeScale/copyCfg/…`),
including `api.step(seconds)` — a deterministic headless fast-forward used for
balance probes and verification.

## What's in the box

- Full depth axis: periscope depth ↔ thermal layer ↔ crush depth (creaks, then implosion) ↔ seabed with seamounts to hide against
- Acoustic stealth model: passive/active sonar, layer + bottom attenuation, blast deafening, visual spotting of scope feathers and surfaced hulls
- Torpedoes with real travel time, gyro steering, arming distance, bubble wakes, and a constant-bearing intercept TDC with soft lock
- Escorts that orbit their convoys, investigate wakes and kills, run depth-charge patterns fused to estimated depth, and shell shallow boats
- Convoy scheduler with heat scaling, hunter packs, procedural ship names, tonnage scoring with records
- Pooled GPU particle VFX, swaying light shafts, marine snow, counter-scrolled caustics, 100% procedural muffled-with-depth audio, sonar-CRT HUD
