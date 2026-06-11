/**
 * Hero shader registry. The shelf (/shelf.html) renders every variant;
 * the main page picks one via ?shader=<id>, falling back to the default.
 *
 * To promote a candidate: change DEFAULT_VARIANT_ID.
 */

import { fragmentShader } from "../shaders";
import type { ShaderVariant } from "./types";
import { colonnade } from "./colonnade";
import { briseSoleil } from "./brise-soleil";
import { stairwell } from "./stairwell";
import { vaults } from "./vaults";
import { monolith } from "./monolith";
import { risograph } from "./risograph";
import { brushwork } from "./brushwork";
import { pleats } from "./pleats";
import { vitrail } from "./vitrail";
import { caustics } from "./caustics";
import { eclipse } from "./eclipse";
import { phyllotaxis } from "./phyllotaxis";
import { twill } from "./twill";
import { drizzle } from "./drizzle";
import { vasarely } from "./vasarely";
import { escapement } from "./escapement";
import { geode } from "./geode";
import { tesserae } from "./tesserae";
import { cutout } from "./cutout";
import { karesansui } from "./karesansui";
import { murmuration } from "./murmuration";
import { aurora } from "./aurora";
import { synthwave } from "./synthwave";
import { benday } from "./benday";
import { eightbit } from "./eightbit";
import { liquidlight } from "./liquidlight";
import { aquarelle } from "./aquarelle";
import { cyanotype } from "./cyanotype";
import { memphis } from "./memphis";
import { ukiyoe } from "./ukiyoe";
import { seventies } from "./seventies";
import { clay } from "./clay";

export type { ShaderVariant } from "./types";

export const inkField: ShaderVariant = {
  id: "ink-field",
  name: "Ink field",
  family: "Flow",
  blurb: "Domain-warped noise with acid filaments. The original hero.",
  frag: fragmentShader,
};

export const VARIANTS: ShaderVariant[] = [
  inkField,
  colonnade,
  briseSoleil,
  stairwell,
  vaults,
  monolith,
  risograph,
  brushwork,
  pleats,
  vitrail,
  caustics,
  eclipse,
  phyllotaxis,
  twill,
  drizzle,
  vasarely,
  escapement,
  geode,
  tesserae,
  cutout,
  karesansui,
  murmuration,
  aurora,
  synthwave,
  benday,
  eightbit,
  liquidlight,
  aquarelle,
  cyanotype,
  memphis,
  ukiyoe,
  seventies,
  clay,
];

export const DEFAULT_VARIANT_ID = "ink-field";

export function resolveVariant(id?: string | null): ShaderVariant {
  return (
    VARIANTS.find((v) => v.id === id) ??
    VARIANTS.find((v) => v.id === DEFAULT_VARIANT_ID) ??
    inkField
  );
}
