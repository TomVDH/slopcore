/**
 * Contact sheet (`?sheet`) — every sample rendered through the live scene with
 * its own treatment (pinned config or general), captured to a tile grid. The
 * only way to judge the 38-image set as a SET: which photos carry the current
 * look, which need their own tuning.
 *
 * Runs as a fixed overlay above the plate/menu (nothing else is torn down);
 * the caller guards persistence for the whole run so driving the scene through
 * every image never dirties the store. Capture is renderOnce() followed by a
 * SYNCHRONOUS toDataURL in the same task — the renderer has no
 * preserveDrawingBuffer, so the buffer is only valid immediately after a draw.
 */

export interface SheetSample {
  key: string;
  label: string;
  src: string;
}

export interface SheetDeps {
  samples: ReadonlyArray<SheetSample>;
  isPinned: (key: string) => boolean;
  /** Apply `key`'s treatment (pinned ?? general) + image to the live scene. */
  applyFor: (key: string, im: HTMLImageElement) => void;
  /** Put the pre-sheet look + image back. */
  restore: () => void;
  /** renderOnce + synchronous canvas.toDataURL. */
  capture: () => string;
  /** Tile click: reopen the dev view on that image. */
  onPick: (key: string) => void;
}

async function loadImg(src: string): Promise<HTMLImageElement | null> {
  const im = new Image();
  im.decoding = "async";
  im.src = src;
  try {
    await im.decode();
    return im;
  } catch {
    return null;
  }
}

export async function runSheet(deps: SheetDeps): Promise<void> {
  const overlay = document.createElement("div");
  overlay.className = "art-sheet";
  overlay.setAttribute("role", "list");
  overlay.setAttribute("aria-label", "Treatment contact sheet");
  const head = document.createElement("div");
  head.className = "art-sheet-head";
  head.textContent = `CONTACT SHEET — 0/${deps.samples.length}`;
  overlay.appendChild(head);
  const grid = document.createElement("div");
  grid.className = "art-sheet-grid";
  overlay.appendChild(grid);
  document.body.appendChild(overlay);

  let done = 0;
  for (const s of deps.samples) {
    const im = await loadImg(s.src);
    if (im) {
      deps.applyFor(s.key, im);
      // One settled frame: give texture upload + any same-task uniform pushes a
      // beat, then draw and grab the buffer in the same task.
      await new Promise((r) => setTimeout(r, 30));
      const url = deps.capture();
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "art-sheet-tile";
      tile.setAttribute("role", "listitem");
      const img = document.createElement("img");
      img.src = url;
      img.alt = s.label;
      tile.appendChild(img);
      const cap = document.createElement("span");
      cap.className = "art-sheet-cap";
      cap.textContent = s.label;
      const badge = document.createElement("em");
      badge.textContent = deps.isPinned(s.key) ? "custom" : "general";
      badge.className = deps.isPinned(s.key) ? "is-custom" : "";
      cap.appendChild(badge);
      tile.appendChild(cap);
      tile.addEventListener("click", () => deps.onPick(s.key));
      grid.appendChild(tile);
    }
    done++;
    head.textContent = `CONTACT SHEET — ${done}/${deps.samples.length}`;
  }
  deps.restore();
  head.textContent = `CONTACT SHEET — ${deps.samples.length} images (click a tile to open in ?dev)`;
}
