#!/usr/bin/env python3
"""Download the site's fonts once, so the live site never loads them from Google.

(Loading Google Fonts from Google's servers sends visitors' IP addresses to Google,
which German courts have ruled needs consent under GDPR. Self-hosting avoids that.)
Writes static/fonts/*.woff2 and static/css/fonts.css (latin and latin-ext only,
which covers Romanian and German).
"""
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS_URL = ("https://fonts.googleapis.com/css2?"
           "family=Archivo:wdth,wght@100..125,500..800"
           "&family=Source+Sans+3:ital,wght@0,400..700;1,400"
           "&family=IBM+Plex+Mono:wght@400;500&display=swap")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
KEEP = {"latin", "latin-ext"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    css = get(CSS_URL).decode()
    blocks = re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S)
    out, n = [], 0
    for subset, block in blocks:
        if subset not in KEEP:
            continue
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        style = re.search(r"font-style: (\w+)", block).group(1)
        src = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        name = f"{family.lower().replace(' ', '-')}-{style}-{subset}.woff2"
        (ROOT / "static" / "fonts" / name).write_bytes(get(src))
        out.append(block.replace(src, f"../fonts/{name}"))
        n += 1
    (ROOT / "static" / "css" / "fonts.css").write_text("\n".join(out) + "\n")
    print(f"saved {n} font files")


if __name__ == "__main__":
    main()
