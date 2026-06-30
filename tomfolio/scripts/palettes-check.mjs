#!/usr/bin/env node
/**
 * Palette single-source-of-truth guard.
 *
 * src/palettes.ts is the ONE place colorways are defined; PALETTES, COLORS, the
 * rig Colorway <select>, and the shader uColorway if-chain are all derived. This
 * check enforces that: PALETTE_DATA is well-formed AND the consumers still use the
 * derived exports (so the old 4-copy lockstep can't quietly return).
 *
 * Text-based on purpose (no TS runtime needed): run with plain `node`.
 */
import { readFileSync } from "node:fs";

const ROOT = process.cwd();
const read = (p) => readFileSync(`${ROOT}/${p}`, "utf8");
const fail = [];
const ok = [];
const check = (cond, msg) => (cond ? ok.push(msg) : fail.push(msg));

// --- 1. PALETTE_DATA well-formed ---
const pal = read("src/palettes.ts");
const rows = [...pal.matchAll(
  /\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",\s*short:\s*"([^"]+)",\s*paper:\s*"(#[0-9a-fA-F]{6})",\s*ink:\s*"(#[0-9a-fA-F]{6})",\s*accent:\s*"(#[0-9a-fA-F]{6})"\s*\}/g,
)].map((m) => ({ id: +m[1], name: m[2], short: m[3], paper: m[4], ink: m[5], accent: m[6] }));

check(rows.length === 54, `PALETTE_DATA has 54 entries (got ${rows.length})`);
check(rows.every((r, i) => r.id === i), "ids are sequential 0..53");
check(new Set(rows.map((r) => r.name)).size === rows.length, "names are unique");
check(new Set(rows.map((r) => r.short)).size === rows.length, "short labels are unique");

// --- 2. shader if-chain is GENERATED, not hardcoded ---
const art = read("src/directions/press/art.ts");
check(/import\s*\{\s*generatePaletteGLSL\s*\}\s*from\s*"\.\.\/\.\.\/palettes"/.test(art),
  "art.ts imports generatePaletteGLSL");
check(art.includes("${generatePaletteGLSL()}"), "art.ts splices ${generatePaletteGLSL()} into pressFrag");
check(!/else if \(uColorway < \d/.test(art), "art.ts has NO hardcoded uColorway branches (would mean a stale copy)");
check(!/export const PALETTES/.test(art), "art.ts no longer defines PALETTES (moved to palettes.ts)");

// --- 3. consumers use the derived exports, not local copies ---
const rig = read("src/sandbox/rig.ts");
check(/options:\s*COLORWAY_NAMES/.test(rig), "rig.ts Colorway options = COLORWAY_NAMES");
check(/import\s*\{\s*COLORWAY_NAMES\s*\}\s*from\s*"\.\.\/palettes"/.test(rig), "rig.ts imports COLORWAY_NAMES");

const artefact = read("src/sandbox/artefact.ts");
check(/import\s*\{\s*PALETTES,\s*COLORS\s*\}\s*from\s*"\.\.\/palettes"/.test(artefact),
  "artefact.ts imports PALETTES + COLORS from palettes");
check(!/const COLORS\s*=\s*\[/.test(artefact), "artefact.ts has NO local COLORS array");

// --- 4. generated chain would have 54 selectors (1 default + 53 else-if) ---
const hexToVec3 = (hex) => {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3));
  return `vec3(${c[0]},${c[1]},${c[2]})`;
};
let glsl = `vec3 paper = ${hexToVec3(rows[0].paper)};\nif (uColorway < 0.5) {}`;
for (let i = 1; i < rows.length; i++) glsl += `\nelse if (uColorway < ${i}.5) { paper = ${hexToVec3(rows[i].paper)}; }`;
const selectors = (glsl.match(/uColorway < /g) || []).length;
check(selectors === 54, `generated chain has 54 selectors (got ${selectors})`);

// --- report ---
for (const m of ok) console.log(`  ok   ${m}`);
if (fail.length) {
  for (const m of fail) console.log(`  FAIL ${m}`);
  console.log(`\nFAILED with ${fail.length} issue(s)`);
  process.exit(1);
}
console.log("\nall palette checks clean");
