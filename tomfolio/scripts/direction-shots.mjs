/**
 * Verification stills for every design direction. Same harness as
 * brut-shots.mjs (system Chrome via playwright); outputs labeled
 * full-page desktop and mobile screenshots into previews/.
 *
 *   node scripts/direction-shots.mjs [id ...]
 *
 * With no args, shoots all directions plus the direction shelf.
 */

import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HOST = "http://localhost:5184";
const OUT = fileURLToPath(new URL("../previews/", import.meta.url));

const DIRECTIONS = ["press", "journal", "y2k", "klein", "bauhaus", "brut"];
const wanted = process.argv.slice(2);
const ids = wanted.length ? wanted : [...DIRECTIONS, "dshelf"];

const browser = await chromium.launch({ channel: "chrome" });

async function shot(name, { width, height, url, fullPage }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1.5,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    for (const img of imgs) img.loading = "eager";
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
  });
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `${OUT}${name}.jpg`,
    fullPage: Boolean(fullPage),
    quality: 82,
    type: "jpeg",
  });
  await ctx.close();
  console.log(`ok ${name}${errors.length ? `  CONSOLE ERRORS: ${errors.join(" | ")}` : ""}`);
  return errors;
}

let totalErrors = 0;
for (const id of ids) {
  const url =
    id === "dshelf" ? `${HOST}/directions/?still` : `${HOST}/directions/${id}.html?still`;
  totalErrors += (await shot(`${id}-desktop-full`, { width: 1440, height: 1100, url, fullPage: true })).length;
  totalErrors += (await shot(`${id}-mobile-full`, { width: 390, height: 844, url, fullPage: true })).length;
}

await browser.close();
if (totalErrors > 0) {
  console.error(`FAILED: ${totalErrors} console error(s)`);
  process.exit(1);
}
console.log("all shots clean");
