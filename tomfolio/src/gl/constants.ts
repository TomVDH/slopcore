/**
 * Constants shared between the press shader (GLSL, in directions/press/art.ts)
 * and the JS that drives it (scene.ts), so the two cannot drift. Keep these
 * primitive and dependency-free (importing this must not pull in heavy modules).
 */

/** Cursor-trail length: the shader's `uTrail[]` size === the JS ring-buffer length. */
export const TRAIL_N = 16;
