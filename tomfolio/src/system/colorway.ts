/**
 * Colorway application — writes a palette's four CSS variables onto a root
 * element, fulfilling the contract declared in palettes.css.
 *
 * Scoped by design: pass a root to theme a subtree (e.g. one <dither-plate>)
 * without touching the page. Policy decisions beyond the four vars (like the
 * artefact's margin-background choice) stay page-side.
 */

import { PALETTES, type Palette } from "../palettes";

export function setColorway(index: number, root: HTMLElement = document.body): Palette {
  const pal = PALETTES[index] ?? PALETTES[10];
  root.style.setProperty("--ground", pal.paper);
  root.style.setProperty("--ink", pal.ink);
  // Cursor matches the FONT colour (the colorway ink), per palette — Heather =
  // cream. Dedicated --art-cursor token, separate from the system brand --accent.
  root.style.setProperty("--art-cursor", pal.ink);
  // The colorway's OWN accent (Heather = mauve #c68d9a), as a dedicated token —
  // separate from the system brand --accent (#e61919 red), which is palette-blind.
  root.style.setProperty("--art-accent", pal.accent);
  return pal;
}
