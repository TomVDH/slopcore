# Product

## Register

brand

## Users

Internal ZenaTech team, event-demo attendees, and anyone handed the link with a few minutes to kill. Context: a browser tab, often on a projector or a phone at a booth. Job to be done: instant pick-up-and-play fun with enough visual spectacle to make someone lean over and ask "what is that?"

## Product Purpose

Flappy Drone is a zero-dependency Canvas 2D browser game — a cyberpunk Flappy Bird with selectable pixel drones, a procedural night-city skyline, and a nuclear easter egg. It exists as a shareable ZenaTech artifact (events, landing pages, internal play) and as Tom's VFX playground. Success = it feels juicy, runs at 60fps anywhere a browser exists, and people replay it.

## Brand Personality

Arcade-noir, juicy, mischievous. The game is night-city neon with warm amber life in the windows; the VFX (nuke, fireworks, aurora) are the spectacle layer. Tone is playful-deadpan (near-miss "RAZOR!", "ZENAVILLE IS SAVED") — never grimdark, never corporate.

## Anti-references

- MK-VI "HELIOS" maximalism — rejected in-project for "too much"; spectacle must stay composed, not cluttered
- Generic flat-pastel hyper-casual mobile art (Ketchapp-style)
- Photoreal or grimdark cyberpunk (Cyberpunk 2077 grit) — this is pixel-warm arcade noir
- UI chrome bleeding into the playfield; the city stays diegetic

## Design Principles

1. **Juice over chrome** — motion, particles, light, and sound carry the feel; menus stay minimal
2. **Physically-inspired, stylized execution** — effects quote real phenomena (Wilson rings, EMP relight) rendered in flat-color canvas language
3. **Everything tunable, nothing forked** — one canonical renderer behind config gates (`FD.NUKE_FX` pattern); labs tune, never source-patch
4. **Deterministic where it matters** — seeded/hashed variation so scrubbing, replays, and parallax tiling never pop
5. **Identity is amber-on-ink** — `#060610`-family inks, amber window life (255,200,55), cyan `#00d4ff` accent; new art respects the committed palette

## Accessibility & Inclusion

Browser game, pointer/keyboard/touch input. Flash-heavy nuke sequence is the main risk: keep `whiteFlash`/`flashDouble` gates so intensity can be disabled; honour reduced-motion preferences in future menu work. Text uses high-contrast pixel fonts on dark ink.
