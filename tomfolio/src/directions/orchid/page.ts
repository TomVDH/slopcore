import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "liquidlight",
  energy: 1,
  galleryTpl: (p, i) => `
    <article class="or-poster rv" style="--rvd: ${i * 0.08}s">
      <figure><img src="${image(p.slug, 880, 1100)}" alt="${p.alt}" loading="lazy" width="880" height="1100" /></figure>
      <h3 class="or-title">${p.title}</h3>
      <p class="or-meta">${p.category} / ${p.year}</p>
      <p class="or-sum">${p.summary}</p>
    </article>`,
});
