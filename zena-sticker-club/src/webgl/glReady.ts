/** Feature-probe WebGL once. If false, the app uses the CSS-only foil path. */
let cached: boolean | null = null;

export function glReady(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    cached = Boolean(ctx);
  } catch {
    cached = false;
  }
  return cached;
}
