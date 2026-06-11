import "../base.css";
import "../lite.css";
import "./page.css";
import "@fontsource/quicksand/500.css";
import "@fontsource/quicksand/700.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "cutout",
  energy: 0.9,
  galleryTpl: (p, i) => `
    <article class="ub-card rv" style="--rvd: ${i * 0.07}s">
      <figure><img src="${image(p.slug, 960, 600)}" alt="${p.alt}" loading="lazy" width="960" height="600" /></figure>
      <h3 class="ub-title">${p.title}</h3>
      <p class="ub-meta">${p.category} &middot; ${p.year}</p>
      <p class="ub-sum">${p.summary}</p>
    </article>`,
});
