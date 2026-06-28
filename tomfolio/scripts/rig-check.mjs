/**
 * Verification for the RIG sandbox. System Chrome via playwright. Confirms
 * the plate mounts, the screen holds one viewport (no scroll), the console
 * is clean, and the ?nogl fallback works; captures stills to previews/.
 *
 *   node scripts/rig-check.mjs
 */

import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = "http://localhost:5184/sandbox/rig.html";
const OUT = fileURLToPath(new URL("../previews/", import.meta.url));

const browser = await chromium.launch({ channel: "chrome" });
let failures = 0;

async function run(label, { url, shot, nogl = false, motifShots = [] }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const p = await page.evaluate(() => {
    const plate = document.querySelector(".rig-plate").getBoundingClientRect();
    const cv = document.getElementById("gl");
    return {
      canvases: document.querySelectorAll("canvas").length,
      canvasMounted: !!cv && cv.width > 8 && cv.height > 8,
      noScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
      plateVh: +((plate.height / window.innerHeight) * 100).toFixed(1),
      noGl: document.body.classList.contains("no-gl"),
    };
  });

  const checks = [["one viewport (no scroll)", p.noScroll]];
  if (nogl) {
    checks.push(["0 canvases", p.canvases === 0], ["no-gl class", p.noGl]);
  } else {
    checks.push(["canvas mounted", p.canvasMounted], ["plate dominant (>55vh)", p.plateVh > 55]);
  }
  const bad = checks.filter(([, ok]) => !ok);
  failures += bad.length + errors.length;

  if (shot) await page.screenshot({ path: `${OUT}${shot}`, quality: 88, type: "jpeg" });

  // Motif evidence: the default plate renders motif 0 (solid), so the X and
  // Lines marks never show. Drive the dev-exposed scene to capture each.
  for (const [motif, name] of motifShots) {
    const ok = await page.evaluate((m) => {
      const s = window.scene;
      if (!s) return false;
      s.setParam("uMotif", m);
      s.setParam("uMotifWeight", 0.45);
      return true;
    }, motif);
    if (!ok) continue;
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}${name}`, quality: 88, type: "jpeg" });
  }

  console.log(
    `${label}: plate ${p.plateVh}vh, canvas ${nogl ? p.canvases : p.canvasMounted ? "up" : "MISSING"}, scroll ${p.noScroll ? "none" : "OVERFLOW"}` +
      (errors.length ? `  ERRORS: ${errors.join(" | ")}` : "") +
      (bad.length ? `  FAILED: ${bad.map(([n]) => n).join(", ")}` : "  ok"),
  );
  await ctx.close();
}

await run("live", {
  url: BASE,
  shot: "sandbox-rig.jpg",
  motifShots: [
    [1, "sandbox-rig-x.jpg"],
    [2, "sandbox-rig-lines.jpg"],
  ],
});
await run("still", { url: `${BASE}?still`, shot: "sandbox-rig-still.jpg" });
await run("nogl", { url: `${BASE}?nogl`, shot: "sandbox-rig-nogl.jpg", nogl: true });

await browser.close();
if (failures > 0) {
  console.error(`FAILED with ${failures} issue(s)`);
  process.exit(1);
}
console.log("all checks clean");
