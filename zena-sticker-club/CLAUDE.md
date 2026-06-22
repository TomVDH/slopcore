@AGENTS.md

# Claude-specific overrides

Project context, conventions, stack, code map, and vault references live in `AGENTS.md`
(imported above). Any agent — Claude, Gemini, Codex, Cursor — reads from there.

This file is for **Claude Code-specific overrides only**.

## Vault

This project is connected to the **Claude Cabinet** vault (slug `zena-sticker-club`). The
`.claude/adjudant` breadcrumb is gitignored, so it won't be in a fresh checkout — recreate
it with `/adjudant connect` (vault = Claude Cabinet, slug = zena-sticker-club). Use the
`adjudant` skill for all vault reads/writes; `/adjudant sync` to push brief + handoff.

## Skill reaches

- **Chrome / UI work** → reach for a design skill (`impeccable`, `frontend-design`). Stay
  within the chrome surfaces named in `AGENTS.md` — never touch the holo cards.
- **Vault writes** (decisions, sessions, notes) → `adjudant`, schema-enforced.
- **Shelving exploration** → mock variants into `work-shelves/` in the vault, tag
  `#iteration` (that's where the 11 other chrome directions already live).

## Working hints

- Before claiming a chrome change is done, verify: `npm run build && npm test` (25 tests)
  must pass, plus `tsc` (strict).
- A reskin is a token swap in `tokens.css` — prefer editing tokens over rewriting
  components.
