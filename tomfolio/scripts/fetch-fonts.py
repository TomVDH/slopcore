#!/usr/bin/env python3
"""Vendor Fontshare families into public/fonts/.

Self-hosting per project convention: no runtime font CDNs. Run via
`npm run fonts`. Idempotent; re-downloads everything listed in FAMILIES.

Weight convention follows the Fontshare CSS API: plain weights ("400")
are normal style, weights with a trailing "1" offset ("401") are the
italic of the base weight.
"""

import re
import sys
import urllib.request
from pathlib import Path

# slug -> requested weights ("401" = italic 400)
FAMILIES = {
    "clash-display": ["500", "600"],
    "satoshi": ["400", "500", "700"],
    "zodiak": ["400", "401", "700"],
    "panchang": ["600", "700"],
    "switzer": ["400", "500", "700", "900"],
    "tanker": ["400"],
    "general-sans": ["400", "500", "600"],
    "melodrama": ["700"],
    "gambetta": ["400", "401", "700"],
    "khand": ["600", "700"],
    "chillax": ["500", "600"],
    "sentient": ["400", "401", "700"],
    "boska": ["400", "700"],
}

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "fonts"

FACE_RE = re.compile(r"@font-face\s*\{(.*?)\}", re.S)
FAMILY_RE = re.compile(r"font-family:\s*'([^']+)'")
WEIGHT_RE = re.compile(r"font-weight:\s*(\d+)")
STYLE_RE = re.compile(r"font-style:\s*(normal|italic)")
WOFF2_RE = re.compile(r"url\('?((?:https:)?//[^)']+?\.woff2)'?\)")


def display_name(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-"))


def expected() -> set:
    out = set()
    for slug, weights in FAMILIES.items():
        for w in weights:
            italic = len(w) == 3 and w.endswith("1")
            base = w[:-1] + "0" if italic else w
            out.add((display_name(slug), base, italic))
    return out


def css_url() -> str:
    parts = [f"f[]={slug}@{','.join(weights)}" for slug, weights in FAMILIES.items()]
    return "https://api.fontshare.com/v2/css?" + "&".join(parts) + "&display=swap"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (tomfolio font vendor)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    css = fetch(css_url()).decode("utf-8")

    want = expected()
    found = set()

    for block in FACE_RE.findall(css):
        fam = FAMILY_RE.search(block)
        wgt = WEIGHT_RE.search(block)
        sty = STYLE_RE.search(block)
        woff2 = WOFF2_RE.search(block)
        if not (fam and wgt and woff2):
            continue
        family = fam.group(1)
        weight = wgt.group(1)
        italic = bool(sty and sty.group(1) == "italic")
        key = (family, weight, italic)
        if key not in want or key in found:
            continue
        slug = family.lower().replace(" ", "-")
        url = woff2.group(1)
        if url.startswith("//"):
            url = "https:" + url
        suffix = "-italic" if italic else ""
        dest = OUT_DIR / f"{slug}-{weight}{suffix}.woff2"
        dest.write_bytes(fetch(url))
        print(f"  ok  {dest.name}  ({dest.stat().st_size // 1024} KB)")
        found.add(key)

    missing = want - found
    if missing:
        print(f"MISSING: {sorted(missing)}", file=sys.stderr)
        return 1
    print(f"done: {len(found)} faces in {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
