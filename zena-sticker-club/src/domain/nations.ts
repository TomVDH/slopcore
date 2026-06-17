import type { CountryCode, NationDef } from '@/domain/types';
import { ALL_CODES } from '@/domain/types';
import { NATION_DEFS } from '@/domain/nations.data';

const BY_CODE: ReadonlyMap<CountryCode, NationDef> = new Map(
  NATION_DEFS.map((n) => [n.code, n] as const),
);

export function getNation(code: CountryCode): NationDef {
  const def = BY_CODE.get(code);
  if (!def) throw new Error(`[nations] no definition for code "${code}"`);
  return def;
}

export function allNations(): readonly NationDef[] {
  return NATION_DEFS;
}

export function allCodes(): readonly CountryCode[] {
  return ALL_CODES;
}

/**
 * Dev-time sanity check. Throws loudly at startup if the data file and the code
 * list drift apart (missing, duplicate, or stray definition) or if any card is
 * missing copy or its transcoded image. A wrong code fails fast, not silently.
 *
 * @param hasImage optional probe from the image registry (code -> bool)
 */
export function invariants(hasImage?: (code: CountryCode) => boolean): void {
  const seen = new Set<CountryCode>();
  const valid = new Set<string>(ALL_CODES);

  for (const n of NATION_DEFS) {
    if (seen.has(n.code)) throw new Error(`[nations] duplicate definition for "${n.code}"`);
    seen.add(n.code);
    if (!valid.has(n.code)) throw new Error(`[nations] "${n.code}" is not a known CountryCode`);
    if (!n.localizedName.trim() || !n.bio.trim() || !n.etymology.trim()) {
      throw new Error(`[nations] "${n.code}" is missing copy`);
    }
    if (n.props.length === 0) throw new Error(`[nations] "${n.code}" has no props`);
    if (hasImage && !hasImage(n.code)) {
      throw new Error(`[nations] "${n.code}" has no transcoded image`);
    }
  }

  for (const code of ALL_CODES) {
    if (!seen.has(code)) throw new Error(`[nations] missing definition for "${code}"`);
  }
}
