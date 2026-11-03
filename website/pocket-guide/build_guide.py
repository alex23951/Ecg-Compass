#!/usr/bin/env python3
"""Build the ECG pocket guide PDFs (Romanian and English).

    python3 pocket-guide/build_guide.py

Writes pocket-guide/build/:
    ghid-ecg-de-buzunar.pdf      ecg-pocket-guide.pdf       12 A6 cards, one per page
    ghid-ecg-de-buzunar-a4.pdf   ecg-pocket-guide-a4.pdf    four cards per A4 sheet, with cutting lines
The site build copies them into dist/. Card text lives in cards.ro.html and cards.en.html.
While "pocket_guide_approved" is false in site.config.json, every card carries a DRAFT mark.

Needs: Jinja2, Node.js and Playwright's Chromium (preinstalled in Claude's cloud sessions).
"""
import json
import math
import subprocess
from pathlib import Path

from jinja2 import Template
from markupsafe import Markup

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BUILD = HERE / "build"
VERSION = "v0.1 · 2026-10"
NAMES = {"ro": "ghid-ecg-de-buzunar", "en": "ecg-pocket-guide"}
FOOT = {"ro": ("Ghid ECG de buzunar", "Fișa {i}/{n}"), "en": ("ECG pocket guide", "Card {i}/{n}")}
DRAFT = {"ro": "CIORNĂ · DE VERIFICAT", "en": "DRAFT · TO BE CHECKED"}


def hexaxial(lang="en"):
    cx = cy = 50
    r = 34
    def pt(deg, rad=r):
        a = math.radians(deg)
        return cx + rad * math.cos(a), cy + rad * math.sin(a)
    x1, y1 = pt(-30)
    x2, y2 = pt(90)
    parts = [f'<svg class="hexaxial" viewBox="-4 -4 108 108" role="img" aria-label="Hexaxial reference system">',
             f'<path d="M{cx},{cy} L{x1:.1f},{y1:.1f} A{r},{r} 0 0 1 {x2:.1f},{y2:.1f} Z" fill="#fbe3df"/>',
             f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#e3cfca" stroke-width="0.6"/>']
    limb = ("DI", "DII", "DIII") if lang == "ro" else ("I", "II", "III")  # Romanian writes DI, DII, DIII
    leads = [(limb[0], 0), (limb[1], 60), (limb[2], 120), ("aVF", 90), ("aVL", -30), ("aVR", -150)]
    degrees = {0: "0°", 60: "+60°", 120: "+120°", 90: "+90°", -30: "−30°", -150: "−150°"}
    for name, deg in leads:
        ax, ay = pt(deg)
        bx, by = pt(deg + 180)
        parts.append(f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{ax:.1f}" y2="{ay:.1f}" stroke="#5d4e4b" stroke-width="0.6" stroke-dasharray="1.2 1.2"/>')
        parts.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="1.3" fill="#b3261e"/>')
        lx, ly = pt(deg, r + 9)
        parts.append(f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle">{name}</text>')
        parts.append(f'<text x="{lx:.1f}" y="{ly + 5.2:.1f}" text-anchor="middle" fill="#5d4e4b" style="font-size:4.4px">{degrees[deg]}</text>')
    parts.append("</svg>")
    return Markup("".join(parts))


def page(lang, cards_html, sheets, draft):
    foot_title, foot_n = FOOT[lang]
    out = []
    numbered = len(cards_html) - 1  # the cover has no number
    for i, card in enumerate(cards_html):
        number = foot_n.format(i=i, n=numbered) if i else ""
        foot = (f'<div class="card-foot"><span>{brand} · {foot_title} · {VERSION}</span>'
                f'<span>{number}</span></div>')
        mark = f'<div class="draft"><span>{DRAFT[lang]}</span></div>' if draft else ""
        out.append(card.replace("</section>", foot + mark + "</section>"))
    if sheets:
        groups = [out[i:i + 4] for i in range(0, len(out), 4)]
        body = "".join('<div class="sheet">' + "".join(g) + "</div>" for g in groups)
        size = "A4"
    else:
        body = "".join(out)
        size = "105mm 148mm"
    title = foot_title
    return (f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><title>{brand} · {title}</title>'
            f'<link rel="stylesheet" href="../guide.css"><style>@page {{ size: {size}; margin: 0; }}</style>'
            f"</head><body>{body}</body></html>")


config = json.loads((ROOT / "site.config.json").read_text())
brand = config["brand"]


def main():
    BUILD.mkdir(exist_ok=True)
    draft = not config.get("pocket_guide_approved")
    jobs = []
    for lang in ("ro", "en"):
        src = Template((HERE / f"cards.{lang}.html").read_text()).render(brand=brand, hexaxial=hexaxial(lang))
        cards = [c + "</section>" for c in src.split("</section>") if c.strip()]
        for sheets, suffix in ((False, ""), (True, "-a4")):
            html_path = BUILD / f"{NAMES[lang]}{suffix}.html"
            html_path.write_text(page(lang, cards, sheets, draft))
            jobs.append([str(html_path), str(BUILD / f"{NAMES[lang]}{suffix}.pdf")])
    subprocess.run(["node", str(HERE / "render_pdf.mjs"), json.dumps(jobs)], check=True)
    print(("DRAFT marks on (pocket_guide_approved is false). " if draft else "") +
          f"Wrote {len(jobs)} PDFs to {BUILD}")


if __name__ == "__main__":
    main()
