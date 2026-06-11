import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "aurora",
  energy: 0.9,
  galleryTpl: (p, i) => `
    <article class="lv-piece rv" style="--rvd: ${(i % 2) * 0.08}s">
      <figure><img src="${image(p.slug, 1280, 720)}" alt="${p.alt}" loading="lazy" width="1280" height="720" /></figure>
      <h3 class="lv-title">${p.title}</h3>
      <p class="lv-meta">${p.category}, ${p.year}</p>
      <p class="lv-sum">${p.summary}</p>
    </article>`,
});
