/**
 * Motion vocabulary — the shared ease list and ticker-cadence presets behind
 * every dither/reveal transition (extracted from the artefact; consumed by its
 * dev-bar Motion group and by any future component that animates the plate).
 *
 * The ease list leans ease-out (fast attack, long deceleration that settles
 * into the final frame, so motion lands instead of gliding), plus a couple of
 * comparison curves. Default is Quint inout at 0.6s.
 *
 * FPS presets cap the gsap ticker (which drives the whole render loop):
 * Cine = a filmic 24fps; Commo = a deliberately choppy 17fps (retro low-end
 * cadence); Fluid = uncapped. No-op under reduced motion (no loop).
 */

import { gsap } from "gsap";

export const EASES: ReadonlyArray<readonly [string, string]> = [
  ["Cubic out", "power2.out"],
  ["Quart out", "power3.out"],
  ["Quint out", "power4.out"],
  ["Expo out", "expo.out"],
  ["Circ out", "circ.out"],
  ["Quint inout", "power4.inOut"],
  ["Back out", "back.out(1.6)"],
];

export type FpsMode = "fluid" | "cine" | "commo";
export const FPS_MODES = ["fluid", "cine", "commo"] as const;
export const FPS_LABELS = ["Fluid", "Cine", "Commo"];

export interface MotionState {
  easeIdx: number;
  dur: number;
  fps: FpsMode;
}
export const DEFAULT_MOTION: MotionState = { easeIdx: 5, dur: 0.6, fps: "commo" }; // Quint inout, 0.6s, Commo 17fps

export function applyFps(fps: FpsMode, reduced: boolean): void {
  if (reduced) return;
  gsap.ticker.fps(fps === "cine" ? 24 : fps === "commo" ? 17 : 240); // 240 ≈ uncapped
}
