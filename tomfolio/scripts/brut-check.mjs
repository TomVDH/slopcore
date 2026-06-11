/**
 * Functional checks for the Brut direction. Run with the dev server up:
 *   node scripts/brut-check.mjs
 */

import { chromium } from "playwright";

const BASE = "http://localhost:5184/directions/brut.html";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const results = [];
const check = (name, pass, detail = "") =>
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);

await page.goto(BASE, { waitUntil: "networkidle" });

// 1. No em/en dashes anywhere in rendered text.
const dashes = await page.evaluate(() => (document.body.innerText.match(/[—–]/g) || []).length);
check("zero em/en dashes in visible text", dashes === 0, `found ${dashes}`);

// 2. Marquee advances (JS velocity drive) under no-preference.
const marqueeMoved = await page.evaluate(async () => {
  const el = document.querySelector(".marquee-track");
  const read = () => getComputedStyle(el).transform;
  const a = read();
  await new Promise((r) => setTimeout(r, 400));
  return { a, b: read() };
});
check(
  "marquee advances",
  marqueeMoved.a !== marqueeMoved.b && marqueeMoved.b !== "none",
  `${marqueeMoved.a} -> ${marqueeMoved.b}`,
);

// 3. Rail sync: scroll to the third plate, expect its row active.
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  document.getElementById("p-long-funnel").scrollIntoView({ block: "center" });
});
await page.waitForTimeout(600);
const activeName = await page.evaluate(
  () => document.querySelector(".dir-row.is-active .dir-name")?.textContent?.trim(),
);
check("rail tracks scrolled plate", activeName === "The Long Funnel", String(activeName));

// 4. Rail anchor click scrolls to plate.
await page.click('.dir-row[href="#p-plotterbot"]');
await page.waitForTimeout(700);
const plotterTop = await page.evaluate(() =>
  Math.round(document.getElementById("p-plotterbot").getBoundingClientRect().top),
);
check("rail click lands on plate", plotterTop > 0 && plotterTop < 300, `top=${plotterTop}`);

// 5. Hero scrawl inked after entrance.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1400);
const inked = await page.evaluate(() => document.querySelector(".hero-title")?.classList.contains("is-inked"));
check("hero scrawl signs itself", Boolean(inked));

// 6. Canvas has painted (non-blank pixels).
const painted = await page.evaluate(() => {
  const c = document.getElementById("rays");
  const ctx = c.getContext("2d");
  const data = ctx.getImageData(0, c.height - 80, c.width, 1).data;
  let sum = 0;
  for (let i = 3; i < data.length; i += 4) sum += data[i];
  return sum;
});
check("sunburst canvas painted", painted > 0, `alpha sum ${painted}`);

// 7. Still mode: everything visible, no animation.
await page.goto(`${BASE}?still`, { waitUntil: "networkidle" });
const stillState = await page.evaluate(() => ({
  still: document.body.classList.contains("still"),
  anim: getComputedStyle(document.querySelector(".marquee-track")).animationName,
  ctaOpacity: getComputedStyle(document.querySelector(".hero-ctas")).opacity,
}));
check(
  "?still renders static and visible",
  stillState.still && stillState.anim === "none" && stillState.ctaOpacity === "1",
  JSON.stringify(stillState),
);

// 8. Keyboard: skip link focuses, tab reaches a rail row.
await page.goto(BASE, { waitUntil: "networkidle" });
await page.keyboard.press("Tab");
const firstFocus = await page.evaluate(() => document.activeElement?.className);
check("skip link is first tab stop", String(firstFocus).includes("skip-link"), String(firstFocus));

console.log(results.join("\n"));
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
