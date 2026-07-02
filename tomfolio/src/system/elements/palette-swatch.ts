/**
 * <palette-swatch> — a paper/ink/accent chip readout for one colorway.
 *
 *   <palette-swatch colorway="37"></palette-swatch>
 *   <palette-swatch colorway="10" label></palette-swatch>  ← + name caption
 *
 * CSS-only visuals (system .swatch chips); observes `colorway` live. The
 * building block for a future CMS-driven colorway picker.
 */

import { PALETTES, COLORWAY_NAMES } from "../../palettes";

export class PaletteSwatch extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["colorway", "label"];
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const i = Number(this.getAttribute("colorway") ?? "0");
    const pal = PALETTES[i] ?? PALETTES[10];
    this.replaceChildren();
    this.classList.add("palette-swatch");
    const chips = document.createElement("span");
    chips.className = "palette-swatch-chips";
    for (const [key, hex] of [["paper", pal.paper], ["ink", pal.ink], ["accent", pal.accent]] as const) {
      const chip = document.createElement("span");
      chip.className = "swatch";
      chip.style.background = hex;
      chip.title = `${key}: ${hex}`;
      chips.appendChild(chip);
    }
    this.appendChild(chips);
    if (this.hasAttribute("label")) {
      const cap = document.createElement("span");
      cap.className = "palette-swatch-name";
      cap.textContent = COLORWAY_NAMES[i] ?? String(i);
      this.appendChild(cap);
    }
  }
}

if (!customElements.get("palette-swatch")) customElements.define("palette-swatch", PaletteSwatch);
