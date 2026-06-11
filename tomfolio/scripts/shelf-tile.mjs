/**
 * Renders iteration-shelf tiles to previews/ via the page's own
 * __shelfSnapshot helper, on system Chrome (honest GPU).
 *
 *   node scripts/shelf-tile.mjs            -> previews/shelf-contact-sheet.jpg (all tiles)
 *   node scripts/shelf-tile.mjs twill ...  -> previews/tile-twill.jpg (just those)
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ids = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../previews/", import.meta.url));

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://localhost:5184/shelf.html?still", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const data = await page.evaluate(
  (only) => window.__shelfSnapshot(20.0, only.length ? only : undefined),
  ids,
);

const name = ids.length ? `tile-${ids.join("-")}` : "shelf-contact-sheet";
writeFileSync(`${OUT}${name}.jpg`, Buffer.from(data.split(",")[1], "base64"));
console.log(`ok ${name}.jpg${errors.length ? `  CONSOLE ERRORS: ${errors.join(" | ")}` : ""}`);

await browser.close();
process.exit(errors.length ? 1 : 0);
