/**
 * Colorways — SINGLE SOURCE OF TRUTH for the press dither palette.
 *
 * Edit a colorway HERE and nowhere else. Everything downstream is derived:
 *   - PALETTES (hex triples) — JS chrome + image tinting
 *   - COLORS (short labels)  — the artefact dev-bar Palette stepper
 *   - COLORWAY_NAMES (long)  — the rig Colorway <select>
 *   - the shader uColorway if-chain — generatePaletteGLSL(), spliced into pressFrag
 *
 * Index === the uColorway uniform value === the order in every derived list.
 * Guarded by scripts/palettes-check.mjs. (Was 4 hand-synced copies; see SHADING.md.)
 */

export interface PaletteDef {
  /** uColorway index (also the array position). */
  id: number;
  /** Long display name — rig Colorway select. */
  name: string;
  /** Compact label — artefact dev-bar Palette stepper. */
  short: string;
  /** Ground / unprinted stock. */
  paper: string;
  /** The mark / ink / menu text. */
  ink: string;
  /** Registration accent (cross, margin Accent). */
  accent: string;
}

export const PALETTE_DATA: PaletteDef[] = [
  { id: 0, name: "Bone / Carbon", short: "Bone", paper: "#f4f4f0", ink: "#0a0a0a", accent: "#e61919" },
  { id: 1, name: "Blueprint", short: "Blueprint", paper: "#163a5c", ink: "#dce6f0", accent: "#fbca4f" },
  { id: 2, name: "Sepia", short: "Sepia", paper: "#e8dfc8", ink: "#2e2317", accent: "#c72e1c" },
  { id: 3, name: "Acid Lime", short: "Acid", paper: "#15140f", ink: "#c8f542", accent: "#e61919" },
  { id: 4, name: "Cyanotype", short: "Cyanotype", paper: "#0b1f2e", ink: "#d8e8e2", accent: "#f49a2e" },
  { id: 5, name: "Riso Pink", short: "Riso Pink", paper: "#f5f2ec", ink: "#f12d73", accent: "#1c1c1e" },
  { id: 6, name: "Riso Blue", short: "Riso Blue", paper: "#f5f4ee", ink: "#0044a5", accent: "#f12d73" },
  { id: 7, name: "Steel", short: "Steel", paper: "#1b1e23", ink: "#b8c2cc", accent: "#4ccae2" },
  { id: 8, name: "Oxblood", short: "Oxblood", paper: "#210b0d", ink: "#e6decc", accent: "#d93326" },
  { id: 9, name: "Mono Invert", short: "Mono Inv", paper: "#0b0b0c", ink: "#f3f2ef", accent: "#e61919" },
  { id: 10, name: "Heather", short: "Heather", paper: "#2a2636", ink: "#f4efdd", accent: "#c68d9a" },
  { id: 11, name: "Noir", short: "Noir", paper: "#08080a", ink: "#e8e8ea", accent: "#ff3b30" },
  { id: 12, name: "Newsprint", short: "Newsprint", paper: "#d9d4c7", ink: "#1a1916", accent: "#8a2b1f" },
  { id: 13, name: "Terminal", short: "Terminal", paper: "#04120a", ink: "#3cff7a", accent: "#d6ff00" },
  { id: 14, name: "Amber CRT", short: "Amber", paper: "#100a02", ink: "#ffb000", accent: "#ff5e3a" },
  { id: 15, name: "Gameboy", short: "Gameboy", paper: "#c4cfa1", ink: "#1e2d1a", accent: "#5a7a3a" },
  { id: 16, name: "Ultraviolet", short: "Ultraviolet", paper: "#120a24", ink: "#d9c2ff", accent: "#ff5ad9" },
  { id: 17, name: "Lagoon", short: "Lagoon", paper: "#07312f", ink: "#d7f0ea", accent: "#ff7a59" },
  { id: 18, name: "Marigold", short: "Marigold", paper: "#1a1407", ink: "#ffd24a", accent: "#ff7a00" },
  { id: 19, name: "Mint Iron", short: "Mint Iron", paper: "#14171a", ink: "#bfe9d0", accent: "#36e0a0" },
  { id: 20, name: "Plum", short: "Plum", paper: "#2b1430", ink: "#f0e2d0", accent: "#e7a23c" },
  { id: 21, name: "Slate Ice", short: "Slate Ice", paper: "#1c2530", ink: "#e6f0f7", accent: "#5ad1ff" },
  { id: 22, name: "Rust Sand", short: "Rust Sand", paper: "#f0e3cf", ink: "#5a2410", accent: "#c2491d" },
  { id: 23, name: "Indigo Sun", short: "Indigo Sun", paper: "#0f1340", ink: "#e8e6ff", accent: "#ffd23f" },
  { id: 24, name: "Emerald", short: "Emerald", paper: "#08130e", ink: "#34e89e", accent: "#f2c94c" },
  { id: 25, name: "Ruby", short: "Ruby", paper: "#1a0508", ink: "#ff4d6d", accent: "#ffd6a5" },
  { id: 26, name: "Sapphire", short: "Sapphire", paper: "#050b1a", ink: "#4d8aff", accent: "#e0fbfc" },
  { id: 27, name: "Amethyst", short: "Amethyst", paper: "#140a1f", ink: "#c77dff", accent: "#80ffdb" },
  { id: 28, name: "Topaz", short: "Topaz", paper: "#1a1303", ink: "#ffd60a", accent: "#ff7b00" },
  { id: 29, name: "Jade", short: "Jade", paper: "#06140f", ink: "#00c9a7", accent: "#f6f7d7" },
  { id: 30, name: "Bubblegum", short: "Bubblegum", paper: "#fff0f6", ink: "#ff2e88", accent: "#3ab7f2" },
  { id: 31, name: "Mint Cream", short: "Mint Cream", paper: "#ecfff6", ink: "#0e9e68", accent: "#ff5d8f" },
  { id: 32, name: "Butter", short: "Butter", paper: "#fffbe6", ink: "#2d2a24", accent: "#f4a259" },
  { id: 33, name: "Periwinkle", short: "Periwinkle", paper: "#eff1ff", ink: "#3a33c0", accent: "#ff7aa8" },
  { id: 34, name: "Peach", short: "Peach", paper: "#ffeee2", ink: "#b23a1e", accent: "#1f9e8f" },
  { id: 35, name: "Lilac", short: "Lilac", paper: "#f5f0ff", ink: "#6d28d9", accent: "#2bd4a0" },
  { id: 36, name: "Hot Pink", short: "Hot Pink", paper: "#0a0610", ink: "#ff2ec4", accent: "#00f0ff" },
  { id: 37, name: "Cyber", short: "Cyber", paper: "#04090c", ink: "#19f7f7", accent: "#ff3cac" },
  { id: 38, name: "Volt", short: "Volt", paper: "#0b0e04", ink: "#c6ff00", accent: "#ff008c" },
  { id: 39, name: "Laser", short: "Laser", paper: "#100604", ink: "#ff5a00", accent: "#ffd000" },
  { id: 40, name: "Electric", short: "Electric", paper: "#03051a", ink: "#3a86ff", accent: "#ffbe0b" },
  { id: 41, name: "Moss", short: "Moss", paper: "#14180d", ink: "#c5d86d", accent: "#e07a5f" },
  { id: 42, name: "Clay", short: "Clay", paper: "#e7d7c2", ink: "#5a3e2b", accent: "#bc4b2a" },
  { id: 43, name: "Saffron", short: "Saffron", paper: "#1c1402", ink: "#f4b400", accent: "#e2725b" },
  { id: 44, name: "Fernway", short: "Fernway", paper: "#0c1a12", ink: "#88d498", accent: "#f2c14e" },
  { id: 45, name: "Dune", short: "Dune", paper: "#ece0c8", ink: "#6b3a2e", accent: "#4a7c59" },
  { id: 46, name: "Miami", short: "Miami", paper: "#0d1b2a", ink: "#ff6ad5", accent: "#41ead4" },
  { id: 47, name: "Vaporwave", short: "Vaporwave", paper: "#1a0b2e", ink: "#ff71ce", accent: "#01cdfe" },
  { id: 48, name: "Chrome", short: "Chrome", paper: "#0b0c10", ink: "#c5c6c7", accent: "#66fcf1" },
  { id: 49, name: "Dusk Grid", short: "Dusk Grid", paper: "#160f29", ink: "#ff9e64", accent: "#f72585" },
  { id: 50, name: "Cobalt", short: "Cobalt", paper: "#0033a0", ink: "#ffe3d8", accent: "#ff5c49" },
  { id: 51, name: "Forest Lemon", short: "Forest Lemon", paper: "#102a1c", ink: "#eaff3c", accent: "#ff8c42" },
  { id: 52, name: "Oxide", short: "Oxide", paper: "#2b0a0a", ink: "#f5c6b0", accent: "#ff3b1f" },
  { id: 53, name: "Klein Pop", short: "Klein Pop", paper: "#0a12c7", ink: "#f6f7fb", accent: "#ffe800" },
];

export interface Palette {
  paper: string;
  ink: string;
  accent: string;
}

/** Hex triples, indexed by uColorway. */
export const PALETTES: Palette[] = PALETTE_DATA.map((p) => ({ paper: p.paper, ink: p.ink, accent: p.accent }));

/** Compact dev-bar labels, indexed by uColorway. */
export const COLORS: string[] = PALETTE_DATA.map((p) => p.short);

/** Long rig-select labels, indexed by uColorway. */
export const COLORWAY_NAMES: string[] = PALETTE_DATA.map((p) => p.name);

// "#rrggbb" -> "r.rrr,g.ggg,b.bbb" (0..1, 3dp). Matches the prior hand-written vec3
// literals to <1/255 — verified identical at migration (see scripts/palettes-check.mjs).
function hexToVec3(hex: string): string {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3));
  return `vec3(${c[0]},${c[1]},${c[2]})`;
}

/**
 * Build the shader's uColorway palette block from PALETTE_DATA: three default
 * decls (index 0) followed by an else-if branch per remaining colorway. Spliced
 * into pressFrag in art.ts. GLSL ignores whitespace, so layout is for humans.
 */
export function generatePaletteGLSL(): string {
  const d0 = PALETTE_DATA[0];
  const lines = [
    `vec3 paper  = ${hexToVec3(d0.paper)}; // 0 ${d0.name} (default)`,
    `    vec3 ink    = ${hexToVec3(d0.ink)};`,
    `    vec3 accent = ${hexToVec3(d0.accent)};`,
    `    if      (uColorway < 0.5) {} // 0 ${d0.name}`,
  ];
  for (let i = 1; i < PALETTE_DATA.length; i++) {
    const p = PALETTE_DATA[i];
    lines.push(
      `    else if (uColorway < ${i}.5) { paper = ${hexToVec3(p.paper)}; ink = ${hexToVec3(p.ink)}; accent = ${hexToVec3(p.accent)}; } // ${i} ${p.name}`,
    );
  }
  return lines.join("\n");
}
