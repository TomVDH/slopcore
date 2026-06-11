import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "twill",
  energy: 0.85,
  galleryTpl: (p, i) => `
    <div class="cg-spine rv" tabindex="0" style="--rvd: ${i * 0.07}s">
      <span class="cg-spine-title">${p.title}</span>
      <img src="${image(p.slug, 900, 1200)}" alt="${p.alt}" loading="lazy" width="900" height="1200" />
      <div class="cg-plate">
        <h3>${p.title}</h3>
        <p>${p.category}, ${p.year}</p>
      </div>
    </div>`,
});
