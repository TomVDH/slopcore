import "../base.css";
import "../lite.css";
import "./page.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "karesansui",
  energy: 0.8,
  galleryTpl: (p, i) => `
    <div class="gg-hang rv" style="--rvd: ${(i % 2) * 0.07}s; margin-top: ${i === 0 ? 0 : "clamp(70px, 11vh, 130px)"}">
      <div class="gg-frame">
        <img src="${image(p.slug, 1040, 780)}" alt="${p.alt}" loading="lazy" width="1040" height="780" />
      </div>
      <div class="gg-plinth">
        <h3>${p.title}</h3>
        <p>${p.category}, ${p.year}</p>
        <p class="gg-sum">${p.summary}</p>
      </div>
    </div>`,
});
