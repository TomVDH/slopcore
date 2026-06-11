/**
 * A hero shader candidate. Every variant shares the same uniform
 * interface as the main scene (uRes, uTime, uMouse, uMouseStrength,
 * uEnergy, uScrollVel) so any of them can drop into the hero unchanged.
 */

export interface ShaderVariant {
  /** kebab-case id, used by the ?shader= URL param */
  id: string;
  /** display name on the shelf */
  name: string;
  /** stylistic family, used to group tiles on the shelf */
  family: string;
  /** one-line description on the shelf */
  blurb: string;
  /** fragment shader source */
  frag: string;
}
