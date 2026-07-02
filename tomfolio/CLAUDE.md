@AGENTS.md

# Claude-specific overrides

Project context, conventions, vault references, and working-files index live in `AGENTS.md` (imported above). Any agent — Claude, Gemini, Codex, Cursor — reads from there.

This file is for **Claude Code-specific overrides only**:
- Slash-command behavior hints
- Plugin/skill invocation preferences
- Claude-only tool guidance (e.g., specific `Bash` allowlists)

**If you're about to add generic project context here, move it to `AGENTS.md` instead.**

## The work surface

When Tom says "the folio" / "the artefact" / "spin it up" with no qualifier, he means **`/sandbox/artefact.html`** — the active surface. NOT the letterpress sandbox, rig, or cursor shelves. See the callout at the top of `AGENTS.md`.

## Preview harness

- Start the dev server via the **preview tool** (`preview_start` on the `tomfolio` launch config), not `npm run dev` in Bash. It runs `dev:claude`, which redirects `/` → `/sandbox/artefact.html`, so a fresh preview lands on the artefact.
- Port is strict `5184`. If `preview_start` reports the port is held by a stale `node` (from a prior session), `kill <pid>` it and retry — this is safe here, it's just an orphaned Vite.
- Verify shader/canvas work with `preview_screenshot`; for functional assertions prefer the `scripts/artefact-check.mjs` playwright checker (occluded preview tabs freeze rAF and lie).

## Vault (adjudant)

- Auto-discovery of the vault **fails** (iCloud Obsidian container). Always pass `--vault-path "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Claude Cabinet"` to any adjudant CLI/helper, and `--project-dir` at the `tomfolio/` sub-project root (where the `.claude/adjudant` breadcrumb lives).
- Project is already connected; use `/adjudant sync` to push brief + handoff, `/adjudant check` for a status read. Full vault ref map is in `AGENTS.md` → "Vault is canonical".

## Working cadence

- **Commit per feature** as it lands (vertical slice + a `SHADING.md` changelog row when shading changes) — never pile multiple features into one uncommitted blob. Branch: `tomfolio`.
- Every shading change is tracked in `SHADING.md` **and** mirrored to the vault `notes/shading.md` in the same commit (see AGENTS.md → Shading).
