/**
 * Dither sample images. Drop any jpg/jpeg/png/webp into this folder and it
 * auto-joins the set the rig (Sample button) and the artefact dev bar cycle
 * through — no code changes needed. Filenames become labels (kebab -> Title).
 *
 * Two keys are referenced by name elsewhere: `portrait` and `sails` (the
 * artefact's per-section images). Keep those filenames if you rely on them.
 */

const mods = import.meta.glob("./*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

export interface Sample {
  key: string;
  label: string;
  src: string;
}

function toLabel(key: string): string {
  return key.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SAMPLES: Sample[] = Object.entries(mods)
  .map(([path, src]) => {
    const key = path.split("/").pop()!.replace(/\.[^.]+$/, "");
    return { key, label: toLabel(key), src: src as string };
  })
  .sort((a, b) => a.key.localeCompare(b.key));

export const sampleSrc = (key: string): string | null =>
  SAMPLES.find((s) => s.key === key)?.src ?? null;
