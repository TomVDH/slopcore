/**
 * Verification stills for the Brut direction. Uses system Chrome via
 * playwright (no bundled-browser download needed). Outputs labeled
 * full-page and viewport screenshots into previews/.
 *
 *   node scripts/brut-shots.mjs
 */

import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = "http://localhost:5184/directions/brut.html";
const OUT = fileURLToPath(new URL("../previews/", import.meta.url));

const browser = await chromium.launch({ channel: "chrome" });

async function shot(name, { width, height, url, fullPage, reducedMotion, clip }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1.5,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  // Force lazy images to fetch, then wait for every decode.
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    for (const img of imgs) img.loading = "eager";
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
  });
  await page.waitForTimeout(900);
  if (clip) {
    await page.evaluate((sel) => {
      document.querySelector(sel).scrollIntoView({ block: "start", behavior: "instant" });
      window.scrollBy(0, -70);
    }, clip);
    await page.waitForTimeout(250);
  }
  await page.screenshot({
    path: `${OUT}${name}.jpg`,
    fullPage: Boolean(fullPage),
    quality: 82,
    type: "jpeg",
  });
  await ctx.close();
  console.log(`ok ${name}`);
}

await shot("brut-desktop-full", { width: 1440, height: 1100, url: `${BASE}?still`, fullPage: true });
await shot("brut-mobile-full", { width: 390, height: 844, url: `${BASE}?still`, fullPage: true });
await shot("brut-hero-live", { width: 1440, height: 900, url: BASE, fullPage: false });
await shot("brut-reduced", { width: 1440, height: 900, url: BASE, fullPage: false, reducedMotion: true });
await shot("brut-creed-clip", { width: 1440, height: 1100, url: `${BASE}?still`, clip: ".creed" });
await shot("brut-work-clip", { width: 1440, height: 1100, url: `${BASE}?still`, clip: ".work-grid" });
await shot("brut-playground-clip", { width: 1440, height: 1100, url: `${BASE}?still`, clip: ".stub-grid" });

await browser.close();
