/**
 * Lite page builder: the filtered-shader directions share one DOM
 * contract (hero / work / note / end), so each page supplies only its
 * world: which library shader to mount, and how a work item looks.
 */

import { identity, projects, type Project } from "../content/portfolio";
import { bootDirection, renderInto, setHtml, type BootResult } from "./common";

export interface LiteConfig {
  variantId: string;
  energy?: number;
  galleryTpl: (p: Project, i: number) => string;
  afterRender?: () => void;
}

export function buildLitePage(cfg: LiteConfig): BootResult {
  renderInto(".dx-gallery", projects, cfg.galleryTpl);

  const m = identity.manifesto;
  setHtml(".dx-note-text", `${m.before}<em>${m.emphasis}</em>${m.after}`);

  setHtml(
    ".dx-links",
    `<a href="mailto:${identity.email}">${identity.email}</a>
     <a href="${identity.github}" rel="noopener" target="_blank">GitHub</a>
     <a href="/directions/">Direction shelf</a>`,
  );

  const fine = document.querySelector<HTMLElement>(".dx-fine");
  if (fine) fine.textContent = identity.smallPrint;

  cfg.afterRender?.();

  // Boot last so reveals can observe rendered nodes.
  return bootDirection(cfg.variantId, cfg.energy ?? 1);
}
