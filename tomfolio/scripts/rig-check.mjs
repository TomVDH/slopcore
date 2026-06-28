/**
 * Verification for the RIG sandbox. System Chrome via playwright. Confirms
 * the plate mounts, the screen holds one viewport (no scroll), the console
 * is clean, and the ?nogl fallback works; captures stills to previews/,
 * including each motif shape and a synthetic image dithered through the
 * engine (drives the dev-exposed window.scene).
 *
 *   node scripts/rig-check.mjs
 */

import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = "http://localhost:5184/sandbox/rig.html";
const OUT = fileURLToPath(new URL("../previews/", import.meta.url));

const browser = await chromium.launch({ channel: "chrome" });
let failures = 0;

async function run(label, { url, shot, nogl = false, motifShots = [], imageShot = null }) {
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

  // Motif evidence: the default plate renders motif 0 (solid), so the other
  // marks never show. Drive the dev-exposed scene to capture each.
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

  // Image-dither evidence: feed a synthetic test image through the engine.
  if (imageShot) {
    const ok = await page.evaluate(() => {
      const s = window.scene;
      if (!s) return false;
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 480;
      const x = c.getContext("2d");
      const ramp = x.createLinearGradient(0, 0, c.width, 0);
      ramp.addColorStop(0, "#000");
      ramp.addColorStop(1, "#fff");
      x.fillStyle = ramp;
      x.fillRect(0, 0, c.width, c.height * 0.5);
      const sphere = x.createRadialGradient(c.width * 0.28, c.height * 0.74, 8, c.width * 0.28, c.height * 0.74, 150);
      sphere.addColorStop(0, "#fff");
      sphere.addColorStop(1, "#0a0a0a");
      x.fillStyle = sphere;
      x.fillRect(0, c.height * 0.5, c.width, c.height * 0.5);
      x.fillStyle = "#161616";
      x.fillRect(c.width * 0.6, c.height * 0.56, c.width * 0.34, c.height * 0.36);
      x.fillStyle = "#f4f4f0";
      x.font = "bold 96px sans-serif";
      x.fillText("TOM", c.width * 0.58, c.height * 0.84);
      s.setImage(c);
      s.setParam("uImageOn", 1);
      s.setParam("uMotif", 1); // disc = halftone dots
      s.setParam("uMotifWeight", 0.6);
      s.setParam("uColorway", 0);
      s.setParam("uCell", 200);
      s.setParam("uCrossOn", 0);
      return true;
    });
    if (ok) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}${imageShot}`, quality: 90, type: "jpeg" });
    }
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
    [1, "sandbox-rig-disc.jpg"],
    [2, "sandbox-rig-x.jpg"],
    [3, "sandbox-rig-plus.jpg"],
    [4, "sandbox-rig-dash.jpg"],
  ],
  imageShot: "sandbox-rig-image.jpg",
});
await run("still", { url: `${BASE}?still`, shot: "sandbox-rig-still.jpg" });
await run("nogl", { url: `${BASE}?nogl`, shot: "sandbox-rig-nogl.jpg", nogl: true });

await browser.close();
if (failures > 0) {
  console.error(`FAILED with ${failures} issue(s)`);
  process.exit(1);
}
console.log("all checks clean");
