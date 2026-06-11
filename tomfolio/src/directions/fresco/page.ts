import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "tesserae",
  energy: 0.9,
  galleryTpl: (p, i) => `
    <article class="fr-frag rv" style="--rvd: ${i * 0.07}s">
      <figure><img src="${image(p.slug, 920, 740)}" alt="${p.alt}" loading="lazy" width="920" height="740" /></figure>
      <h3 class="fr-title">${p.title}</h3>
      <p class="fr-meta">${p.category} / ${p.year}</p>
      <p class="fr-sum">${p.summary}</p>
    </article>`,
});
