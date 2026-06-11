import "../base.css";
import "../lite.css";
import "./page.css";
import "@fontsource/permanent-marker/400.css";

import { image } from "../../content/portfolio";
import { buildLitePage } from "../lite";

buildLitePage({
  variantId: "drizzle",
  energy: 0.9,
  galleryTpl: (p, i) => `
    <figure class="sp-snap rv" style="--rvd: ${i * 0.08}s">
      <img src="${image(p.slug, 880, 660)}" alt="${p.alt}" loading="lazy" width="880" height="660" />
      <figcaption class="sp-caption">${p.title}<span>${p.category}, ${p.year}</span></figcaption>
    </figure>`,
});
