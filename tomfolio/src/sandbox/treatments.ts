/**
 * Treatments store — durable per-image dither treatments.
 *
 * SOURCE OF TRUTH: `src/samples/treatments.json`, committed in git. The file
 * is the deliberate checkpoint (machine-portable, diffable, and the seed the
 * future Payload CMS imports). "Import" = drop a downloaded file into
 * src/samples/ — arbitration below handles the rest on reload.
 *
 * CRASH-PAD: an invisible localStorage working copy survives mid-session
 * reloads (artefact.ts is a Vite entry with no HMR accept — every source edit
 * full-reloads the page). It is never the source of truth:
 *
 *   blob.baseSavedAt === file.savedAt  → working copy descends from this
 *                                        checkpoint → overlay it (local wins)
 *   anything else                      → the file changed underneath (fresh
 *                                        download dropped in, or a pull) →
 *                                        file wins, local is rebased
 *
 * Revision-tag arbitration, not timestamps: clocks across machines lie;
 * identity doesn't. Per-image configs are FULL snapshots (the live-general
 * model, vault decision 2026-06-30-per-image-config-model), never diffs.
 */

import fileBlob from "../samples/treatments.json";

export interface TreatmentMotion {
  ease: string; // GSAP ease string (robust to EASES reorder)
  dur: number;
  fps: string;
}

export interface TreatmentsData {
  version: number;
  savedAt: string; // revision id, stamped at download time
  image?: string; // last-viewed sample key
  motion?: TreatmentMotion;
  general?: Record<string, number>;
  images: Record<string, Record<string, number | string>>; // full snapshots (+ informational `source`)
  notes: Record<string, string>;
}

const LOCAL_KEY = "artefact:treatments";
const VERSION = 1;

interface LocalBlob extends TreatmentsData {
  baseSavedAt: string; // savedAt of the file this working copy branched from
}

/** Merge a stored context over compiled defaults: known numeric keys only —
 *  drops removed params, fills new ones, ignores the informational `source`. */
export function mergeSnapshot(
  defaults: Record<string, number>,
  stored: Record<string, number | string> | undefined,
): Record<string, number> {
  const out = { ...defaults };
  if (stored) {
    for (const k of Object.keys(defaults)) {
      const v = stored[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

export interface LoadedTreatments {
  general: Record<string, number>;
  images: Record<string, Record<string, number>>;
  notes: Record<string, string>;
  motion: TreatmentMotion | null;
  image: string | null;
  /** Which layer won arbitration — surfaced in the dev-bar store status. */
  source: "file" | "local";
  /** The file's revision id (the base every local write is tagged with). */
  fileSavedAt: string;
}

function readLocal(): LocalBlob | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as LocalBlob;
    if (blob.version !== VERSION || typeof blob.baseSavedAt !== "string") return null;
    return blob;
  } catch {
    return null;
  }
}

/** Boot-time load: arbitrate file vs crash-pad, merge into compiled defaults. */
export function loadTreatments(
  defaults: Record<string, number>,
  validImageKeys: ReadonlySet<string>,
): LoadedTreatments {
  const file = fileBlob as unknown as TreatmentsData;
  const fileOk = file.version === VERSION;
  if (!fileOk) console.warn("[treatments] unknown file version — ignoring treatments.json");
  const fileSavedAt = fileOk ? file.savedAt : "";

  const local = readLocal();
  const useLocal = !!local && local.baseSavedAt === fileSavedAt;
  const src: TreatmentsData = useLocal ? local : (fileOk ? file : { version: VERSION, savedAt: "", images: {}, notes: {} });
  if (!useLocal && local) {
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ } // rebase: file won
  }

  const images: Record<string, Record<string, number>> = {};
  for (const [key, params] of Object.entries(src.images ?? {})) {
    if (!validImageKeys.has(key)) {
      console.warn(`[treatments] skipping config for unknown image "${key}"`);
      continue;
    }
    images[key] = mergeSnapshot(defaults, params);
  }

  return {
    general: mergeSnapshot(defaults, src.general),
    images,
    notes: { ...(src.notes ?? {}) },
    motion: src.motion ?? null,
    image: src.image && validImageKeys.has(src.image) ? src.image : null,
    source: useLocal ? "local" : "file",
    fileSavedAt,
  };
}

// ---- Save path ---------------------------------------------------------------

export interface StoreState {
  image: string;
  motion: TreatmentMotion;
  general: Record<string, number>;
  images: Record<string, Record<string, number>>;
  notes: Record<string, string>;
  sourceOf: (key: string) => string | undefined; // sample filename, informational
}

function buildData(s: StoreState): TreatmentsData {
  const images: TreatmentsData["images"] = {};
  for (const [key, params] of Object.entries(s.images)) {
    const source = s.sourceOf(key);
    images[key] = source ? { source, ...params } : { ...params };
  }
  return {
    version: VERSION,
    savedAt: "", // stamped by the writer (download) / replaced by baseSavedAt (local)
    image: s.image,
    motion: s.motion,
    general: s.general,
    images,
    notes: { ...s.notes },
  };
}

let debounceId: ReturnType<typeof setTimeout> | null = null;
let dirty = false; // local ahead of the committed file?

/** Debounced crash-pad write. Call on every edit (persistLook / pin / clear /
 *  motion / notes). Tags the blob with the file revision it branched from. */
export function scheduleStore(state: () => StoreState, fileSavedAt: string): void {
  dirty = true;
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    debounceId = null;
    try {
      const blob: LocalBlob = { ...buildData(state()), baseSavedAt: fileSavedAt };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(blob));
    } catch { /* quota/privacy: the file workflow still works */ }
  }, 400);
}

/** True when the working copy has edits not yet checkpointed to the file. */
export const storeDirty = (): boolean => dirty;

/** Download the checkpoint file. Drop it into src/samples/ and commit; the
 *  next boot rebases the crash-pad onto the new revision. */
export function downloadTreatments(state: StoreState): void {
  const data = buildData(state);
  data.savedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "treatments.json";
  a.click();
  URL.revokeObjectURL(a.href);
  dirty = false; // checkpointed (pending the drop+commit, which reboots anyway)
}

/** Dev/test hook: wipe the crash-pad (next boot reads the file). */
export function clearLocalTreatments(): void {
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
  dirty = false;
}
