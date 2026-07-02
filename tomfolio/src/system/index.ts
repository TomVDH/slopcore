/**
 * Site system entry. Import this once per page for the full foundation:
 *
 *   import { initCursor } from "../system";
 *   initCursor();
 *
 * It pulls in the token layer, fonts, reset/base, and components (CSS
 * side effects, in cascade order), and re-exports the cursor controller.
 * Page-specific CSS imported after this wins on the cascade.
 */

import "./fonts.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./tokens.css";
import "./palettes.css";
import "./base.css";
import "./components.css";

export { initCursor } from "./cursor";
export { setColorway } from "./colorway";
