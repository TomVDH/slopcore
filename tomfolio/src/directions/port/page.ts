import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "geode",
  energy: 0.95,
  galleryTpl: (p, i) => `
    <article class="pt-row rv" style="--rvd: ${i * 0.06}s">
      <h3 class="pt-name">${p.title} <i>&#8226;</i> <span style="font-size: 0.7em; opacity: 0.7">${p.category}</span></h3>
      <span class="pt-year">${p.year}</span>
      <p class="pt-sum">${p.summary}</p>
      <img class="pt-thumb" src="${image(p.slug, 300, 300)}" alt="${p.alt}" loading="lazy" width="300" height="300" />
    </article>`,
});
