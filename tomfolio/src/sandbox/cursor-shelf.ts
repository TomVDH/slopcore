/**
 * Cursor shelf — 9 block-cursor variants side by side, each tile mounting its
 * cursor on hover. The variants themselves live in the system registry
 * (src/system/cursor-press.ts CURSOR_VARIANTS); this page is a pure consumer —
 * an ARCHIVE of the exploration, kept runnable. PULSE is the shipped pick
 * (see the vault decision record).
 */

import "./cursor-shelf.css";
import { initPressCursor, CURSOR_VARIANTS, type CursorVariantName } from "../system/cursor-press";

if (
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  document.querySelectorAll<HTMLElement>(".cshelf-tile").forEach((tile) => {
    const variant = tile.dataset.cursor as CursorVariantName | undefined;
    if (!variant || !(variant in CURSOR_VARIANTS)) return;
    let active: { destroy(): void } | null = null;
    tile.addEventListener("pointerenter", () => {
      tile.classList.add("is-active");
      active = initPressCursor({
        variant,
        root: tile,
        cursorClass: "cshelf-cur cshelf-cur-block",
        stampClass: "cshelf-stamp",
        hoverTargets: "button, a",
      });
    });
    tile.addEventListener("pointerleave", () => {
      tile.classList.remove("is-active");
      active?.destroy();
      active = null;
    });
  });
}
