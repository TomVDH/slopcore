/**
 * Shared runtime for the lighter direction pages: still/reduced
 * detection, canvas mount from the shader-variant library (the
 * "filtered shaders" program: pages restyle library shaders with CSS
 * filters), IntersectionObserver reveals on `.rv`, and tiny render
 * helpers over the shared content module.
 *
 * Reveal contract: content is visible by default. With motion enabled
 * the runtime adds `html.js`; base.css then hides `.rv` until `.in`.
 */

import { initScene, type GlScene } from "../gl/scene";
import { resolveVariant } from "../gl/variants";

export interface BootResult {
  reduced: boolean;
  scene: GlScene | null;
}

export function bootDirection(variantId: string, energy = 1): BootResult {
  const params = new URLSearchParams(window.location.search);
  const reduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("still");
  if (reduced) document.documentElement.classList.add("reduced");

  let scene: GlScene | null = null;
  const canvas = document.getElementById("gl") as HTMLCanvasElement | null;
  try {
    if (canvas && !params.has("nogl")) {
      scene = initScene(canvas, reduced, resolveVariant(variantId).frag);
      scene.setEnergy(energy);
    } else {
      throw new Error("nogl");
    }
  } catch {
    canvas?.remove();
  }

  if (!reduced) {
    document.documentElement.classList.add("js");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.16 },
    );
    document.querySelectorAll(".rv").forEach((el) => io.observe(el));
  }

  if (import.meta.env.DEV) {
    Object.assign(window, { scene });
  }

  return { reduced, scene };
}

export function renderInto<T>(
  selector: string,
  items: readonly T[],
  tpl: (item: T, i: number) => string,
): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.innerHTML = items.map(tpl).join("");
}

export function setHtml(selector: string, html: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.innerHTML = html;
}
