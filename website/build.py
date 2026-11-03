#!/usr/bin/env python3
"""Build the public website into dist/.

    python3 build.py                 the real site (only issues Alex has checked)
    python3 build.py --preview       a preview: forms send nothing, drafts are shown

The output is plain HTML, CSS and JS. Upload dist/ (plus functions/ for the sign-up
endpoint) to the host; see README.md.

Needs: Python 3.10+ and Jinja2 (pip install jinja2).
"""
import argparse
import datetime as dt
import json
import posixpath
import re
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"  # replaced by --out
LANGS = ["ro", "en"]
UPDATED = "2026-10-12"
UPDATED_FREE = "2026-11-03"
DIGEST_SLUGS = {"ro": "ecg-saptamanii/", "en": "en/ecg-of-the-week/"}
AZ_SAMPLE = {"AF", "AFL", "LBBB", "RBBB", "STEMI_INF", "WPW", "CHB", "MOBITZ1", "VT", "LVH"}
AZ_SLUGS = {"ro": "ecg-a-z/", "en": "en/ecg-a-z/"}


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def strip_accents(text):
    import unicodedata
    return "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")


def fill(text, values):
    """Replace {name} placeholders without tripping over other braces."""
    return re.sub(r"\{(\w+)\}", lambda m: str(values.get(m.group(1), m.group(0))), text)


def load_issues(config, preview):
    """Every weekly issue for the digest pages, newest first.

    The real site lists only issues where every paper has checked_by_alex set;
    the preview also lists unchecked and sample issues (marked as samples).
    """
    issues_dir = (ROOT / config["issues_dir"]).resolve()
    out = []
    for path in sorted(issues_dir.glob("*/issue.json")):
        try:
            issue = load_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        if "ecg" not in issue:
            continue
        papers = issue.get("papers", [])
        checked = bool(papers) and all(p.get("checked_by_alex") for p in papers)
        if not checked and not preview:
            continue
        meta = {}
        meta_file = path.parent / issue["ecg"].get("meta", "ecg.json")
        if meta_file.exists():
            meta = load_json(meta_file)
        out.append({"folder": path.parent, "data": issue, "meta": meta, "checked": checked})
    # Real issues (with a week) before samples, newest week first.
    out.sort(key=lambda i: (i["data"].get("week") is not None, i["data"].get("week") or "",
                            i["data"].get("issue_number", 0)), reverse=True)
    return out


def load_issue(config, preview):
    """The newest weekly issue to feature on the home page.

    The real site only uses issues where every paper has checked_by_alex set;
    the preview falls back to the newest issue of any kind (marked as a sample).
    """
    issues_dir = (ROOT / config["issues_dir"]).resolve()
    found = []
    for path in sorted(issues_dir.glob("*/issue.json")):
        try:
            issue = load_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        if "ecg" not in issue:
            continue
        papers = issue.get("papers", [])
        checked = bool(papers) and all(p.get("checked_by_alex") for p in papers)
        found.append((checked, issue.get("issue_number", 0), path.parent, issue))
    ready = [f for f in found if f[0]]
    pool = ready or (found if preview else [])
    if not pool:
        return None
    checked, _, folder, issue = max(pool, key=lambda f: (f[1], f[2].name))
    meta = {}
    if (folder / issue["ecg"].get("meta", "ecg.json")).exists():
        meta = load_json(folder / issue["ecg"].get("meta", "ecg.json"))
    return {"folder": folder, "data": issue, "meta": meta, "checked": checked}


class Site:
    def __init__(self, preview, fragment_root=False):
        self.preview = preview
        # The claude.ai preview wraps the first page in its own <html>/<head>/<body>.
        self.fragment_root = fragment_root
        self.config = load_json(ROOT / "site.config.json")
        self.strings = {lang: load_json(ROOT / "content" / f"{lang}.json") for lang in LANGS}
        self.free = bool(self.config.get("free_launch"))
        self.signup = bool(self.config.get("signup", True)) or not self.free
        for lang in LANGS:
            free_file = ROOT / "content" / f"free.{lang}.json"
            if free_file.exists():
                self.strings[lang]["free"] = load_json(free_file)
            if self.free:
                self.strings[lang]["slugs"]["digest"] = DIGEST_SLUGS[lang]
                self.strings[lang]["slugs"]["az"] = AZ_SLUGS[lang]
        self.issues = load_issues(self.config, preview) if self.free else []
        self.app_data = self.trainer_data()
        self.env = Environment(
            loader=FileSystemLoader(ROOT / "templates"),
            autoescape=select_autoescape(["html"]),
            trim_blocks=True, lstrip_blocks=True)
        self.issue = load_issue(self.config, preview)
        if self.free:
            self.issue = self.issues[0] if self.issues else None
        self.trace = load_json(ROOT / "static" / "data" / "hero-trace.json")

    # Paths ------------------------------------------------------------------
    def page_file(self, slug):
        return slug + "index.html" if slug == "" or slug.endswith("/") else slug

    def make_url(self, current_slug):
        current_dir = posixpath.dirname(self.page_file(current_slug)) or "."

        def url(target):
            """Relative link from the current page to a site path."""
            is_dir = target == "" or target.endswith("/")
            path = self.page_file(target) if is_dir else target
            rel = posixpath.relpath(path, current_dir)
            if is_dir and not self.preview:
                rel = rel[: -len("index.html")] or "./"
            return rel
        return url

    def absolute(self, slug):
        return self.config["site_url"].rstrip("/") + "/" + slug

    # Rendering --------------------------------------------------------------
    def values(self, lang):
        c = self.config
        return {
            "brand": c["brand"], "email": c["contact_email"],
            "price_ron": c["founding"]["price_ron"], "price_eur": c["founding"]["price_eur"],
            "regular_ron": c["founding"]["regular_ron"], "regular_eur": c["founding"]["regular_eur"],
            "company_name": c["company"]["name"], "cui": c["company"]["cui"],
            "trade_register": c["company"]["trade_register"], "address": c["company"]["address"],
        }

    def render(self, template, lang, page_key, out_slug=None, alt_slugs=None, **extra):
        s = self.strings[lang]
        other = "en" if lang == "ro" else "ro"
        slug = s["slugs"][page_key] if out_slug is None else out_slug
        url = self.make_url(slug)
        values = self.values(lang)

        def f(text, **more):
            return fill(text, {**values, **more})

        def link(key, target_lang=None):
            return url(self.strings[target_lang or lang]["slugs"][key])

        def app_url(hash_=""):
            """The trainer, opened in the page's language."""
            return url("app/") + ("?lang=en" if lang == "en" else "") + hash_

        ctx = {
            "s": s, "c": self.config, "lang": lang, "page_key": page_key,
            "preview": self.preview, "url": url, "link": link, "f": f,
            "html": lambda text, **more: Markup(f(text, **more)),
            "other_lang": other, "app_url": app_url,
            "other_url": (url(alt_slugs[other]) if alt_slugs else
                          link(page_key, other) if page_key in s["slugs"] else link("home", other)),
            "canonical": self.absolute(slug),
            "alternates": ({l: self.absolute(alt_slugs[l]) for l in LANGS} if alt_slugs else
                           {l: self.absolute(self.strings[l]["slugs"][page_key])
                            for l in LANGS if page_key in self.strings[l]["slugs"]}),
            "updated": UPDATED_FREE if self.free else UPDATED, "year": dt.date.today().year,
            "has_digest": self.free and bool(self.issues),
            "credits": self.credits(),
            "fragment": self.fragment_root and self.page_file(slug) == "index.html",
            "has_quiz": self.issue is not None,
            **extra,
        }
        html = self.env.get_template(template).render(**ctx)
        out = DIST / self.page_file(slug)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        return out

    def legal(self, lang, key):
        name = f"{key}_free" if self.free and not self.signup else key
        src = (ROOT / "content" / "pages" / f"{name}.{lang}.html").read_text(encoding="utf-8")
        body = self.env.from_string(src).render(
            c=self.config, updated=UPDATED_FREE if self.free else UPDATED)
        return Markup(body)

    def quiz(self, lang):
        if not self.issue:
            return None
        data = self.issue["data"]
        ecg = data["ecg"]
        folder = self.issue["folder"]
        dest = DIST / "static" / "img" / "weekly" / folder.name
        dest.mkdir(parents=True, exist_ok=True)
        images = {}
        for key in ("image", "full_image"):
            name = ecg.get(key)
            if name and (folder / name).exists():
                shutil.copy2(folder / name, dest / name)
                images[key] = f"static/img/weekly/{folder.name}/{name}"
        meta = self.issue["meta"]
        return {
            "number": data.get("issue_number", 1),
            "sample": not self.issue["checked"],
            "q": ecg[lang], "images": images,
            "ecg_id": meta.get("ecg_id", "?"),
        }

    # Free site -------------------------------------------------------------
    def trainer_data(self):
        """The trainer's data as it will be published.

        With approved_only (the free launch default), only the cases Alex approved on the
        review screen go live (trainer/content/approved.json), without the layers Alex has
        not reviewed yet: profiles, profile questions and options, follow-ups, deeper
        notes, the plain labels and action cards, and the course from zero.
        """
        cases = load_json(ROOT / "app" / "data" / "cases.json")
        lessons = load_json(ROOT / "app" / "data" / "lessons.json")
        if self.free:  # everything is free, so no "free" badge on one module
            cases["modules"] = [{k: v for k, v in m.items() if k != "free"} for m in cases["modules"]]
        if not self.config.get("approved_only"):
            return {"cases": cases, "lessons": lessons}
        ok = load_json(ROOT / "trainer" / "content" / "approved.json")
        ok_cases, ok_dx = set(ok["cases"]), set(ok["diagnoses"])
        kept = []
        for c in cases["cases"]:
            if c["id"] not in ok_cases:
                continue
            c = {k: v for k, v in c.items() if k not in ("tiers", "tier_options", "followups", "deep")}
            missing = [o for o in c["options"] if o not in ok_dx]
            if missing:
                raise SystemExit(f"approved case {c['id']} uses unapproved diagnoses {missing}")
            kept.append(c)
        used = {o for c in kept for o in c["options"]}
        diagnoses = {k: {f: v for f, v in d.items() if f not in ("plain", "action")}
                     for k, d in cases["diagnoses"].items() if k in used}
        modules = [m for m in cases["modules"] if any(c["module"] == m["id"] for c in kept)]
        out = {**cases, "cases": kept, "diagnoses": diagnoses, "modules": modules, "tiers": []}
        return {"cases": out, "lessons": {**lessons, "lessons": []}}

    def credits(self):
        """Sources of every ECG on the site (hero strip and quiz are PTB-XL)."""
        data = self.app_data["cases"]
        used = {"ptbxl"} | {c.get("source", {}).get("dataset", "ptbxl") for c in data["cases"]}
        names = {"ptbxl": "ecg", "mimic": "mimic", "vfdb": "vfdb", "cudb": "cudb"}
        out = [data["credit"][names[k]] for k in ("ptbxl", "mimic", "vfdb", "cudb")
               if k in used and names[k] in data["credit"]]
        if any(c.get("measure") for c in data["cases"]) and "measurements" in data["credit"]:
            out.insert(1, data["credit"]["measurements"])
        return out

    def modules(self, lang):
        data = self.app_data["cases"]
        return [{"id": m["id"], "title": m["title"][lang], "blurb": m["blurb"][lang],
                 "count": sum(c["module"] == m["id"] for c in data["cases"])}
                for m in data["modules"]]

    def totals(self):
        data = self.app_data["cases"]
        return {"cases": len(data["cases"]),
                "dx": sum(1 for d in data["diagnoses"].values() if d.get("criteria"))}

    def az_entries(self, lang):
        """The diagnoses with an approved teaching text, A to Z in this language."""
        data = self.app_data["cases"]
        titles = {m["id"]: m["title"][lang] for m in data["modules"]}
        first_case = {}
        for c in sorted(data["cases"], key=lambda c: (c["level"], c["id"])):
            first_case.setdefault(c["answer"], c)
        out = []
        for key, d in data["diagnoses"].items():
            if not d.get("criteria"):
                continue
            name = d["name"][lang]
            case = first_case.get(key)
            out.append({
                "key": key, "name": name, "tell": d.get("tell", {}).get(lang, ""),
                "criteria": d["criteria"][lang], "pitfalls": d.get("pitfalls", {}).get(lang, []),
                "case": case["id"] if case else None,
                "module": titles.get(case["module"]) if case else None,
                "search": " ".join([name, key, d.get("tell", {}).get(lang, "")]),
            })
        out.sort(key=lambda e: strip_accents(e["name"]).lower())
        return out

    def build_az(self, lang):
        entries = self.az_entries(lang)
        groups = {}
        for e in entries:
            groups.setdefault(strip_accents(e["name"][0]).upper(), []).append(e)
        self.render("az.html", lang, "az", groups=list(groups.items()), letters=list(groups))
        return entries

    def issue_view(self, issue, lang):
        data, folder = issue["data"], issue["folder"]
        ecg = data["ecg"]
        dest = DIST / "static" / "img" / "weekly" / folder.name
        dest.mkdir(parents=True, exist_ok=True)
        images = {}
        for key in ("image", "full_image"):
            name = ecg.get(key)
            if name and (folder / name).exists():
                shutil.copy2(folder / name, dest / name)
                images[key] = f"static/img/weekly/{folder.name}/{name}"
        tip = data.get("nurse_tip", {}).get(lang)
        return {
            "number": data.get("issue_number", 1), "week": data.get("week"),
            "sample": not issue["checked"],
            "subject": data.get("subject", {}).get(lang, ""),
            "preheader": data.get("preheader", {}).get(lang, ""),
            "q": ecg[lang], "images": images, "ecg_id": issue["meta"].get("ecg_id", "?"),
            "papers_intro": data.get("papers_intro", {}).get(lang),
            "papers": [{**p[lang], "type": p.get("type", {}).get(lang, ""),
                        "citation": p.get("citation", ""), "url": p.get("url")}
                       for p in data.get("papers", []) if lang in p],
            "tip": tip,
        }

    def build_digest(self, lang):
        items = []
        for issue in self.issues:
            slugs = {l: DIGEST_SLUGS[l] + issue["folder"].name + "/" for l in LANGS}
            view = self.issue_view(issue, lang)
            self.render("digest_issue.html", lang, "digest", out_slug=slugs[lang],
                        alt_slugs=slugs, issue=view)
            items.append({**view, "slug": slugs[lang]})
        self.render("digest_index.html", lang, "digest", issues=items)

    def build(self):
        if DIST.exists():
            shutil.rmtree(DIST)
        shutil.copytree(ROOT / "static", DIST / "static",
                        ignore=shutil.ignore_patterns("data"))
        trace_json = Markup(json.dumps(self.trace, separators=(",", ":")))
        for lang in LANGS:
            if self.free:
                az = self.build_az(lang)
                sample = [e["name"] for e in az if e["key"] in AZ_SAMPLE]
                self.render("home_free.html", lang, "home", quiz=self.quiz(lang),
                            trace_json=trace_json, modules=self.modules(lang),
                            totals=self.totals(), az_sample=sample)
                self.build_digest(lang)
            else:
                self.render("home.html", lang, "home", quiz=self.quiz(lang), trace_json=trace_json)
                self.render("founding.html", lang, "founding")
            if self.signup:
                self.render("simple.html", lang, "thanks", which="thanks")
                self.render("simple.html", lang, "confirmed", which="confirmed")
            for key in ("privacy", "terms"):
                self.render("legal.html", lang, key, which=key, body=self.legal(lang, key))
        self.render("simple.html", "ro", "notfound", out_slug="404.html", which="notfound")
        if not self.free or self.config.get("pocket_guide_approved"):
            self.copy_downloads()
        self.copy_app()
        (DIST / "_headers").write_text(HEADERS)
        (DIST / "robots.txt").write_text(
            "User-agent: *\nAllow: /\nSitemap: " + self.absolute("sitemap.xml") + "\n")
        self.sitemap()

    def copy_app(self):
        """The trainer lives at /app/ (not linked from the site until the beta)."""
        shutil.copytree(ROOT / "app", DIST / "app")
        page = DIST / "app" / "index.html"
        html = page.read_text(encoding="utf-8").replace("ECG Compass", self.config["brand"])
        if self.preview:
            html = html.replace('data-mode="live"', 'data-mode="preview"')
        if self.free:
            html = html.replace('data-mode=', f'data-contact="{self.config["contact_email"]}" data-mode=', 1)
            html = html.replace('<meta name="robots" content="noindex">\n', "")
            data_dir = DIST / "app" / "data"
            for name in ("cases", "lessons"):
                (data_dir / f"{name}.json").write_text(
                    json.dumps(self.app_data[name], ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
            if self.config.get("approved_only"):
                # Publish only the tracings of the cases that go live.
                kept = {f"{c['ecg_id']}.json" for c in self.app_data["cases"]["cases"]}
                for f in (data_dir / "signals").glob("*.json"):
                    if f.name not in kept:
                        f.unlink()
        page.write_text(html, encoding="utf-8")

    def copy_downloads(self):
        built = ROOT / "pocket-guide" / "build"
        for lang in LANGS:
            for key in ("guide_pdf", "guide_sheet_pdf"):
                target = DIST / self.strings[lang]["slugs"][key]
                src = built / Path(target).name
                if src.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, target)

    def sitemap(self):
        keys = (["home", "az", "digest", "privacy", "terms"] if self.free
                else ["home", "founding", "privacy", "terms"])
        urls = []
        for key in keys:
            alts = "".join(
                f'<xhtml:link rel="alternate" hreflang="{l}" href="{self.absolute(self.strings[l]["slugs"][key])}"/>'
                for l in LANGS)
            for lang in LANGS:
                urls.append(f"<url><loc>{self.absolute(self.strings[lang]['slugs'][key])}</loc>{alts}</url>")
        (DIST / "sitemap.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">' + "".join(urls) + "</urlset>\n")


HEADERS = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/static/*
  Cache-Control: public, max-age=604800
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--preview", action="store_true",
                    help="preview build: forms send nothing, unchecked issues allowed")
    ap.add_argument("--out", help="output folder (default: dist/)")
    ap.add_argument("--fragment-root", action="store_true",
                    help="write the root page without <html>/<head>/<body> (claude.ai preview)")
    args = ap.parse_args()
    global DIST
    if args.out:
        DIST = Path(args.out).resolve()
    site = Site(args.preview, args.fragment_root)
    site.build()
    pages = sorted(p.relative_to(DIST).as_posix() for p in DIST.rglob("*.html"))
    print(f"Built {len(pages)} pages into {DIST}")
    if site.issue is None:
        print("Note: no checked weekly issue yet, so the home page has no ECG quiz.")
    elif not site.issue["checked"]:
        print(f"Note: home page quiz uses unchecked issue {site.issue['folder'].name} (preview only).")


if __name__ == "__main__":
    main()
