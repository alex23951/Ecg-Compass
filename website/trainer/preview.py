#!/usr/bin/env python3
"""Make the trainer's claude.ai preview: a page fragment plus its files.

    python3 trainer/preview.py OUT_DIR

Writes OUT_DIR/index.html (no <html>/<head>/<body>; claude.ai adds them), copies
app/css, app/js and app/data next to it, and writes OUT_DIR/files.json, the map of
published paths to source files for the Artifact tool. Fonts come from Google Fonts
in the preview; the live site serves its own copies.
"""
import json
import re
import shutil
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..800'
         '&family=Source+Sans+3:ital,wght@0,400..700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">')


def main():
    out = Path(sys.argv[1]).resolve()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    page = (APP / "index.html").read_text(encoding="utf-8")
    body = re.search(r"<!-- trainer:start -->(.*)<!-- trainer:end -->", page, re.S).group(1)
    body = body.replace('data-mode="live"', 'data-mode="preview"')
    (out / "index.html").write_text(
        "<title>ECG Compass Trainer</title>\n"
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        f"{FONTS}\n"
        '<link rel="stylesheet" href="css/app.css">\n'
        f"{body.strip()}\n",
        encoding="utf-8")
    files = {}
    for sub in ("css", "js", "data"):
        shutil.copytree(APP / sub, out / sub)
    for f in sorted(out.rglob("*")):
        if f.is_file() and f.name not in ("index.html", "files.json"):
            rel = f.relative_to(out).as_posix()
            files[rel] = str(f)
    (out / "files.json").write_text(json.dumps(files, indent=1))
    print(f"{len(files)} files in {out}")


if __name__ == "__main__":
    main()
