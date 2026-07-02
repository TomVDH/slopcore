/**
 * <dither-plate> — the Presswerk dither as a mountable custom element.
 *
 *   <dither-plate colorway="37" motif="1" cell="220" fade="2" image="sails"></dither-plate>
 *
 * Light DOM around the canvas (the single-WebGL-context + system-CSS rules
 * both forbid a shadow wall): the element creates a <canvas> child and any
 * chrome the page slots in simply coexists as siblings. Each mounted plate
 * owns its own GL context and renders on the shared gsap.ticker (the one-RAF
 * -owner rule); disconnect disposes the scene fully.
 *
 * Attributes (all observed live):
 *   colorway  palette index (also themes the element via scoped setColorway)
 *   motif     0 dots · 1 disc · 2 x · 3 plus · 4 dash
 *   cell      dither cell count
 *   fade      edge dissolve: 0 off · 1 simple · 2 cloud
 *   image     sample key (src/samples) or an image URL
 *   still     render one static frame, no loop (also follows reduced motion)
 *
 * Scene-bus: the first mounted plate registers as the page scene; every plate
 * listens for nudges and answers with a brief cursor-strength pulse.
 */

import { initScene, type GlScene } from "../../gl/scene";
import { pressFrag } from "../../directions/press/art";
import { setColorway } from "../colorway";
import { onNudge, registerScene, getScene } from "../scene-bus";
import { sampleSrc } from "../../samples";

const ATTR_UNIFORM: Record<string, string> = {
  motif: "uMotif",
  cell: "uCell",
  fade: "uFadeMode",
  colorway: "uColorway",
};

export class DitherPlate extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["colorway", "motif", "cell", "fade", "image", "still"];
  }

  private scene: GlScene | null = null;
  private offNudge: (() => void) | null = null;
  private imageToken = 0; // guards stale async image loads after attr changes

  connectedCallback(): void {
    this.classList.add("plate");
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      this.hasAttribute("still") ||
      new URLSearchParams(window.location.search).has("still");

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    this.prepend(canvas);

    try {
      this.scene = initScene(canvas, reduced, pressFrag);
    } catch {
      canvas.remove();
      this.classList.add("no-gl"); // CSS fallback surface
      return;
    }
    if (!getScene()) registerScene(this.scene); // first plate = the page scene

    // Plate-appropriate defaults: image-driven, no registration cross, cursor off
    // (the element is a media frame, not the full interactive artefact).
    this.scene.setParam("uCrossOn", 0);
    this.scene.setParam("uCursorMode", 0);
    for (const a of DitherPlate.observedAttributes) {
      if (this.hasAttribute(a)) this.attributeChangedCallback(a);
    }

    this.offNudge = onNudge((d) => {
      // Answer bus pings with a brief press pulse centred on the plate.
      this.scene?.setParam("uMouseStrength", Math.min(d.amp ?? 0.35, 1));
      this.scene?.renderOnce();
    });
  }

  disconnectedCallback(): void {
    this.offNudge?.();
    this.offNudge = null;
    this.imageToken++;
    this.scene?.dispose();
    this.scene = null;
    this.querySelector("canvas")?.remove();
  }

  attributeChangedCallback(name: string): void {
    if (!this.scene) return;
    if (name === "image") {
      void this.loadImage(this.getAttribute("image"));
      return;
    }
    if (name === "colorway") {
      const i = Number(this.getAttribute("colorway") ?? "0");
      setColorway(i, this); // scoped: themes this element's subtree only
      this.scene.setParam("uColorway", i);
      return;
    }
    const uniform = ATTR_UNIFORM[name];
    if (uniform) this.scene.setParam(uniform, Number(this.getAttribute(name) ?? "0"));
  }

  private async loadImage(ref: string | null): Promise<void> {
    const token = ++this.imageToken;
    if (!ref) {
      this.scene?.setImage(null);
      this.scene?.setParam("uImageOn", 0);
      return;
    }
    // A sample key resolves through src/samples; anything path-like is a URL.
    const src = sampleSrc(ref) ?? ref;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    try {
      await img.decode();
    } catch {
      return; // broken ref: keep the procedural field
    }
    if (token !== this.imageToken || !this.scene) return; // superseded or unmounted
    this.scene.setImage(img);
    this.scene.setParam("uImageOn", 1);
    this.scene.renderOnce();
  }
}

if (!customElements.get("dither-plate")) customElements.define("dither-plate", DitherPlate);
