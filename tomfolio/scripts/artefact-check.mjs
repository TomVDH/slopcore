/**
 * Verification for the corner artefact sandbox. System Chrome via playwright.
 * Confirms the ground is the gray-purple, the plate is anchored bottom-left,
 * the screen holds one viewport (no scroll), the console is clean, and the
 * ?nogl fallback leaves the bare ground. Captures stills to previews/.
 *
 *   node scripts/artefact-check.mjs
 */

import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = "http://localhost:5184/sandbox/artefact.html";
const OUT = fileURLToPath(new URL("../previews/", import.meta.url));

const browser = await chromium.launch({ channel: "chrome" });
let failures = 0;

async function run(label, { url, shot, w = 1440, h = 900, nogl = false }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600); // let the portrait load and the form tween settle

  const p = await page.evaluate(() => {
    const cv = document.getElementById("gl");
    const r = cv ? cv.getBoundingClientRect() : null;
    const frame = document.querySelector(".art-frame");
    const fr = frame ? frame.getBoundingClientRect() : null;
    return {
      canvases: document.querySelectorAll("canvas").length,
      canvasMounted: !!cv && cv.width > 8 && cv.height > 8,
      anchoredBL:
        !!r && Math.abs(r.left - 10) < 3 && Math.abs(window.innerHeight - r.bottom - 10) < 3,
      frameInset: !!fr && Math.abs(fr.left - 10) < 2 && Math.abs(fr.top - 10) < 2,
      menuItems: document.querySelectorAll(".art-link").length,
      noScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
      noGl: document.body.classList.contains("no-gl"),
      bg: frame ? getComputedStyle(frame).backgroundColor : "",
    };
  });

  const checks = [
    ["one viewport (no scroll)", p.noScroll],
    ["frame inset 10px", p.frameInset],
    ["ground deep gray-purple", p.bg === "rgb(42, 38, 54)"],
    ["menu present", p.menuItems >= 3],
  ];
  if (nogl) {
    checks.push(["0 canvases", p.canvases === 0], ["no-gl class", p.noGl]);
  } else {
    checks.push(["canvas mounted", p.canvasMounted], ["anchored bottom-left", p.anchoredBL]);
  }
  const bad = checks.filter(([, ok]) => !ok);
  failures += bad.length + errors.length;

  if (shot) await page.screenshot({ path: `${OUT}${shot}`, quality: 90, type: "jpeg" });
  console.log(
    `${label}: canvas ${nogl ? p.canvases : p.canvasMounted ? "up" : "MISSING"}, bg ${p.bg}, scroll ${p.noScroll ? "none" : "OVERFLOW"}` +
      (errors.length ? `  ERRORS: ${errors.join(" | ")}` : "") +
      (bad.length ? `  FAILED: ${bad.map(([n]) => n).join(", ")}` : "  ok"),
  );
  await ctx.close();
}

await run("live", { url: BASE, shot: "sandbox-artefact.jpg" });
await run("still", { url: `${BASE}?still`, shot: "sandbox-artefact-still.jpg" });
await run("mobile", { url: BASE, shot: "sandbox-artefact-mobile.jpg", w: 390, h: 844 });
await run("nogl", { url: `${BASE}?nogl`, shot: "sandbox-artefact-nogl.jpg", nogl: true });

await browser.close();
if (failures > 0) {
  console.error(`FAILED with ${failures} issue(s)`);
  process.exit(1);
}
console.log("all checks clean");
