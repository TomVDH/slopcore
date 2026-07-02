/**
 * <press-link> — the outline-to-fill display menu link as a custom element.
 *
 * Light DOM by design: the visual comes from the system .menu-link classes
 * (components.css), which must cascade in; shadow DOM would wall them off.
 *
 *   <press-link>Collection 207</press-link>
 *   <press-link caption>Fig. A</press-link>   ← filled-mono caption variant
 *   <press-link active nudge="0.6">…</press-link>
 *
 * Behaviour: hover emits a scene-bus nudge (strength = `nudge` attr, default
 * 0.35) so a mounted <dither-plate> can ripple in response; click marks this
 * link active among its siblings and dispatches a bubbling "press-select"
 * CustomEvent (detail: { key }) for the page to act on.
 */

import { emitNudge } from "../scene-bus";

export class PressLink extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["active", "caption"];
  }

  private ab: AbortController | null = null;

  connectedCallback(): void {
    this.classList.add("menu-link");
    this.classList.toggle("menu-link--caption", this.hasAttribute("caption"));
    this.classList.toggle("is-active", this.hasAttribute("active"));
    if (!this.hasAttribute("role")) this.setAttribute("role", "button");
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;

    this.ab = new AbortController();
    const { signal } = this.ab;
    this.addEventListener("pointerenter", () => {
      emitNudge({ amp: Number(this.getAttribute("nudge") ?? "0.35") });
    }, { signal });
    this.addEventListener("click", () => this.select(), { signal });
    this.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.select(); }
    }, { signal });
  }

  disconnectedCallback(): void {
    this.ab?.abort();
    this.ab = null;
  }

  attributeChangedCallback(name: string): void {
    if (name === "active") this.classList.toggle("is-active", this.hasAttribute("active"));
    if (name === "caption") this.classList.toggle("menu-link--caption", this.hasAttribute("caption"));
  }

  private select(): void {
    // Single-active among sibling press-links (same parent).
    const parent = this.parentElement;
    if (parent) {
      for (const el of parent.querySelectorAll<PressLink>("press-link")) {
        el.toggleAttribute("active", el === this);
      }
    }
    this.dispatchEvent(new CustomEvent("press-select", {
      bubbles: true,
      detail: { key: this.getAttribute("key") ?? this.textContent?.trim() ?? "" },
    }));
  }
}

// Registration guard: safe under HMR / repeat imports, and the pattern Astro
// islands will need.
if (!customElements.get("press-link")) customElements.define("press-link", PressLink);
