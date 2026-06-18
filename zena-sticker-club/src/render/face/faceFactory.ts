import type { CardFace } from './CardFace';
import { ImageCardFace } from './ImageCardFace';
import { ProceduralCardFace } from './ProceduralCardFace';

export type FaceMode = 'image' | 'procedural';

/**
 * Render orchestration depends only on the `CardFace` interface and this
 * factory, never on a concrete face. Swap the whole face system in one line.
 */
export function createFace(mode: FaceMode = 'image'): CardFace {
  return mode === 'procedural' ? new ProceduralCardFace() : new ImageCardFace();
}
