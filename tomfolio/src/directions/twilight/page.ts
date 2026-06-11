import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "murmuration",
  energy: 1,
  galleryTpl: (p) => `
    <article class="tw-plate rv">
      <img src="${image(p.slug, 1600, 900)}" alt="${p.alt}" loading="lazy" width="1600" height="900" />
      <div class="tw-bar">
        <h3 class="tw-title">${p.title}</h3>
        <span class="tw-meta">${p.category}, ${p.year}</span>
        <p class="tw-sum">${p.summary}</p>
      </div>
    </article>`,
});
