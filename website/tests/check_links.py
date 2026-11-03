#!/usr/bin/env python3
"""Check that every internal link and asset in dist/ points at a file that exists.

    python3 tests/check_links.py [dist-folder]
"""
import posixpath
import re
import sys
from pathlib import Path

DIST = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "dist")


def main():
    bad = []
    pages = list(DIST.rglob("*.html"))
    for page in pages:
        rel_page = page.relative_to(DIST).as_posix()
        html = page.read_text(encoding="utf-8")
        for attr, target in re.findall(r'\b(href|src)="([^"]+)"', html):
            if re.match(r"^(https?:|mailto:|tel:|#|data:|/api/)", target):
                continue
            path = target.split("#")[0].split("?")[0]
            if not path:
                continue
            if path.startswith("/"):
                resolved = path.lstrip("/")
            else:
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(rel_page), path))
            if path.endswith("/") or resolved in (".", ""):
                resolved = posixpath.join(resolved, "index.html") if resolved not in (".", "") else "index.html"
            if not (DIST / resolved).exists():
                bad.append(f"{rel_page}: {attr}={target} -> {resolved}")
    for b in bad:
        print("BROKEN", b)
    print(f"checked {len(pages)} pages, {len(bad)} broken links")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
