/**
 * Components demo shelf — mounts the system custom elements against a live
 * scene-bus so their interplay is visible: hovering a <press-link> nudges the
 * page, clicking swaps the active link. <dither-plate> joins in step 2.4.
 *
 * Deliberately NOT the artefact: that page stays the verified reference
 * implementation on its direct initScene path.
 */

import "../system"; // tokens + palettes + base + components CSS
import "../system/elements/press-link";
import "./components.css";

import { setColorway } from "../system";
import { onNudge } from "../system/scene-bus";

setColorway(37); // Cyber, matching the artefact default

// Console tap: proves the bus wiring before <dither-plate> exists to consume it.
onNudge((d) => console.debug("[bus] nudge", d));

document.addEventListener("press-select", (e) => {
  console.debug("[bus] press-select", (e as CustomEvent).detail);
});
