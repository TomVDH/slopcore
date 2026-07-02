/**
 * Cursor colour study — the SAME PULSE animation in five colour/blend
 * treatments (the per-variant `v-*` classes carry the difference), so the
 * comparison is colour-only. PULSE itself comes from the system registry;
 * this page is a pure consumer — an ARCHIVE of the colour exploration.
 * Shipped choice: solid colorway ink (--art-cursor), no blend.
 */

import "./cursor-colour.css";
import { initPressCursor } from "../system/cursor-press";

if (
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  document.querySelectorAll<HTMLElement>(".ccol-tile").forEach((tile) => {
    const variant = tile.dataset.variant ?? "";
    if (!variant) return;
    let active: { destroy(): void } | null = null;
    tile.addEventListener("pointerenter", () => {
      tile.classList.add("is-active");
      active = initPressCursor({
        variant: "pulse",
        root: tile,
        cursorClass: `ccol-cur v-${variant}`,
        stampClass: `ccol-stamp v-${variant}`,
      });
    });
    tile.addEventListener("pointerleave", () => {
      tile.classList.remove("is-active");
      active?.destroy();
      active = null;
    });
  });
}
