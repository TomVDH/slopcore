# SOOB!

`soob` · type: `coding` · vault: [[projects/soob/brief|soob]]

> Single-folder 3D submarine combat game (SOOB!) + its sea-trials tester. TONK!'s underwater sibling — same engineering pattern, its own identity.

## What this is

A browser submarine-hunting game one-shotted on 2026-06-11, built modular from
day one (the TONK lesson): `js/` modules under a global `SOOB` namespace so
`tester.html` and future preview labs can drive every subsystem. Success looks
like: fast iteration on the acoustics/feel via the tester, with tuned values
baked back into `js/config.js`.

## Where things live

| | |
|---|---|
| Working tree | (this folder) — `index.html` game · `tester.html` tester · `js/` modules · `css/` |
| Canonical context | [[projects/soob/brief]] |
| Decisions | [[projects/soob/decisions]] |
| Sessions | [[projects/soob/sessions]] |
| Handoff | [[projects/soob/_handoff]] |

## Conventions

- No bundler, no TypeScript, plain ES modules; Three.js pinned via importmap (jsdelivr, 0.160). Zero asset files — canvas textures, primitive hulls, procedural WebAudio.
- All tunables live in `CFG` (`js/config.js`); cross-module mutable state lives on `SOOB.rt` — arrays are mutated in place, never reassigned.
- Depth convention: world `y` is negative underwater; CFG/UI depths are **positive metres**. `depthOf(y)` converts.
- Combat core is co-located in `js/game.js` (player physics, detection, escort AI, ordnance, convoys, scoring) to avoid import cycles. `main.js` owns boot + the loop + `SOOB.api`.
- Ship variant rows (`CFG.ships.*`) are copied into `s.spec` at spawn — tester tweaks apply to new hulls. Detection/noise/torpedo/charge values are read live every frame.
- New gameplay/VFX experiments: drive them through `tester.html` (or a numbered `previews/NN-name.html` lab, flappy-drone pattern).
- Serve with `npx serve` (launch.json entry `soob`, port 3851). Verify in a browser before claiming done — `SOOB.api.state()` is the probe, `SOOB.api.step(seconds)` is the deterministic headless fast-forward (backgrounded tabs freeze rAF; step() is how you simulate there).
- Baseline tag: `soob-progenitor` on branch `soob`.

## The acoustic model (the heart — touch with care)

`game.js → escortBrain()`: per-escort `signal = (effNoise/100) · linearFalloff(dist, passiveR·acuity)`
where `effNoise` = player noise × thermal-layer attenuation × bottom clutter ×
blast deafness. Signal above `susThresh` accumulates `sus` (0→1):
`investigateAt` → hunt the LKP, `attackAt` → depth-charge runs. Active pings
are real expanding wavefronts (`rt.pings`) — echo strength applies the same
layer/bottom logic. The LKP error shrinks as suspicion firms; decoys win the
"loudest source" contest and steal the LKP. Tune all of it live in the
tester's DETECTION / NOISE groups; `COPY CFG DIFF` → paste into config.js.

## Vault is canonical

When asked "is X documented?" or "do we know Y?", check the vault first — repos
document code, the vault documents decisions and context. Use the `adjudant`
skill to read/write vault files.

## Claude-specific overrides

Live in `CLAUDE.md` next to this file. CLAUDE.md `@`-imports this file.
