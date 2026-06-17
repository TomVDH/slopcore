import type { Card, ImageSet, NationDef } from '@/domain/types';
import { RARITY } from '@/domain/rarity';

/**
 * Pure factory: hydrate a content-only `NationDef` with its resolved rarity
 * config and image set. Keeps the render layer free of data-shaping concerns.
 */
export function makeCard(def: NationDef, images: ImageSet): Card {
  return {
    code: def.code,
    def,
    rarity: RARITY[def.rarity],
    images,
  };
}
