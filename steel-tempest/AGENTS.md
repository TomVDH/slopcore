# TONK!

`steel-tempest` · type: `coding` · vault: [[projects/steel-tempest/brief|steel-tempest]]

> Single-folder 3D wave-survival tank game (TONK!, née Steel Tempest) + its dev tester.

## What this is

A browser tank battle one-shotted on 2026-06-10, then split FD-style into `js/` modules under a global `TONK` namespace so `tester.html` and future preview labs can drive every subsystem. The folder keeps the original `steel-tempest` slug; the game brand is **TONK!**. Success looks like: fast iteration on feel/VFX via the tester, with tuned values baked back into `js/config.js`.

## Where things live

| | |
|---|---|
| Working tree | (this folder) — `index.html` game · `tester.html` tester · `js/` modules · `css/` |
| Canonical context | [[projects/steel-tempest/brief]] |
| Decisions | [[projects/steel-tempest/decisions]] |
| Sessions | [[projects/steel-tempest/sessions]] |
| Handoff | [[projects/steel-tempest/_handoff]] |

## Conventions

- No bundler, no TypeScript, plain ES modules; Three.js pinned via importmap (jsdelivr, 0.160).
- All tunables live in `CFG` (`js/config.js`); cross-module mutable state lives on `TONK.rt` — arrays are mutated in place, never reassigned.
- New gameplay/VFX experiments: drive them through `tester.html` or a numbered `previews/NN-name.html` lab importing the `js/` modules (flappy-drone pattern).
- Serve with `npx serve` (launch.json entry `steel-tempest`, port 3849). Verify in a browser before claiming done — `TONK.api.state()` is the probe.
- Baseline tag: `tonk-progenitor` on branch `tonk`.

## Vault is canonical

When asked "is X documented?" or "do we know Y?", check the vault first — repos document code, the vault documents decisions and context. Use the `adjudant` skill to read/write vault files.

## Claude-specific overrides

Live in `CLAUDE.md` next to this file. CLAUDE.md `@`-imports this file.
