/**
 * Scene bus — a page-singleton event channel so non-canvas components
 * (e.g. <press-link>) can react to / drive the page's GL scene without a
 * hard coupling. Type-only import of GlScene keeps this module free of any
 * three.js runtime cost for consumers that never mount a plate.
 *
 *   emitNudge({ amp })   fire-and-forget interaction ping
 *   onNudge(fn)          subscribe; returns an unsubscribe
 *   registerScene(s)     the page's (first) scene announces itself
 *   getScene()           whoever needs direct access
 */

import type { GlScene } from "../gl/scene";

export interface NudgeDetail {
  amp?: number; // 0..1 suggested strength
  x?: number; // optional viewport-normalized origin
  y?: number;
}

const bus = new EventTarget();
let scene: GlScene | null = null;

export function emitNudge(detail: NudgeDetail = {}): void {
  bus.dispatchEvent(new CustomEvent<NudgeDetail>("nudge", { detail }));
}

export function onNudge(fn: (detail: NudgeDetail) => void): () => void {
  const h = (e: Event): void => fn((e as CustomEvent<NudgeDetail>).detail);
  bus.addEventListener("nudge", h);
  return () => bus.removeEventListener("nudge", h);
}

export function registerScene(s: GlScene): void {
  scene = s;
}

export function getScene(): GlScene | null {
  return scene;
}
