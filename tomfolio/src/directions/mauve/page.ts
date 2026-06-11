import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "risograph",
  energy: 0.9,
  galleryTpl: (p, i) => `
    <article class="mv-cut rv" style="--rvd: ${i * 0.07}s">
      <figure><img src="${image(p.slug, 900, 720)}" alt="${p.alt}" loading="lazy" width="900" height="720" /></figure>
      <h3 class="mv-title">${p.title}</h3>
      <p class="mv-meta">${p.category}, ${p.year}</p>
      <p class="mv-sum">${p.summary}</p>
    </article>`,
});
