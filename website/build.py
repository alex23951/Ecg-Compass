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
import sys
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import digest_issues as weekly  # noqa: E402  (lives next to this file)

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


def load_issues(config, preview, issues_dir=None):
    """Every weekly issue the site shows, newest first (see digest_issues.py).

    The real site lists only issues Alex has fully checked: "checked_by_alex": true at
    the top of issue.json and on every paper. The preview also lists unchecked and
    sample issues, marked as samples.
    """
    folder = Path(issues_dir) if issues_dir else (ROOT / config["issues_dir"]).resolve()
    return weekly.select(folder, preview)


class Site:
    def __init__(self, preview, fragment_root=False, issues_dir=None):
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
        # Newest first; the home-page quiz uses the newest one.
        self.issues = load_issues(self.config, preview, issues_dir)
        self.app_data = self.trainer_data()
        self.env = Environment(
            loader=FileSystemLoader(ROOT / "templates"),
            autoescape=select_autoescape(["html"]),
            trim_blocks=True, lstrip_blocks=True)
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
            # The digest page always exists on the free site (a placeholder until the
            # first checked issue); has_issues says whether there is an issue to show.
            "has_digest": self.free, "has_issues": bool(self.issues),
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
        return {
            "number": data.get("issue_number", 1),
            "sample": not self.issue["checked"],
            "q": data["ecg"][lang], "images": self.copy_issue_images(self.issue),
            "ecg_id": self.issue["meta"].get("ecg_id", "?"),
        }

    # Free site -------------------------------------------------------------
    def trainer_data(self):
        """The trainer's data as it will be published.

        With approved_only (the free launch default), only the cases Alex approved on the
        review screen go live (trainer/content/approved.json), without the layers Alex has
        not reviewed yet: profiles, profile questions and options, follow-ups, deeper
        notes, the plain labels and action cards. Lessons and the teaching marks on a case
        go live only when listed in approved.json ("lessons", "annotations").
        """
        cases = load_json(ROOT / "app" / "data" / "cases.json")
        lessons = load_json(ROOT / "app" / "data" / "lessons.json")
        if self.free:  # everything is free, so no "free" badge on one module
            cases["modules"] = [{k: v for k, v in m.items() if k != "free"} for m in cases["modules"]]
        if not self.config.get("approved_only"):
            return {"cases": cases, "lessons": lessons}
        ok = load_json(ROOT / "trainer" / "content" / "approved.json")
        ok_cases, ok_dx = set(ok["cases"]), set(ok["diagnoses"])
        ok_marks, ok_lessons = set(ok.get("annotations", [])), set(ok.get("lessons", []))
        kept = []
        for c in cases["cases"]:
            if c["id"] not in ok_cases:
                continue
            c = {k: v for k, v in c.items() if k not in ("tiers", "tier_options", "followups", "deep")}
            if c["id"] not in ok_marks:
                c.pop("annotations", None)
            missing = [o for o in c["options"] if o not in ok_dx]
            if missing:
                raise SystemExit(f"approved case {c['id']} uses unapproved diagnoses {missing}")
            kept.append(c)
        used = {o for c in kept for o in c["options"]}
        diagnoses = {k: {f: v for f, v in d.items() if f not in ("plain", "action")}
                     for k, d in cases["diagnoses"].items() if k in used}
        modules = [m for m in cases["modules"] if any(c["module"] == m["id"] for c in kept)]
        out = {**cases, "cases": kept, "diagnoses": diagnoses, "modules": modules, "tiers": []}
        live = []
        for l in lessons["lessons"]:
            if l["id"] not in ok_lessons:
                continue
            steps = []
            for st in l["steps"]:
                if st.get("type") == "cases":  # links only to cases that are live
                    st = {**st, "cases": [x for x in st["cases"] if x in ok_cases]}
                    if not st["cases"]:
                        continue
                steps.append(st)
            live.append({**l, "steps": steps})
        return {"cases": out, "lessons": {**lessons, "lessons": live}}

    def basics(self, lang):
        """The beginner course (read an ECG step by step), for the home page."""
        return [{"id": l["id"], "step": l.get("step"), "title": l["title"][lang]}
                for l in self.app_data["lessons"]["lessons"] if l.get("course") == "basics"]

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

    def copy_issue_images(self, issue):
        """Copy an issue's ECG pictures next to the site; returns their site paths."""
        ecg, folder = issue["data"]["ecg"], issue["folder"]
        dest = DIST / "static" / "img" / "weekly" / folder.name
        dest.mkdir(parents=True, exist_ok=True)
        images = {}
        for key in ("image", "full_image"):
            name = ecg.get(key)
            if name and (folder / name).exists():
                shutil.copy2(folder / name, dest / name)
                images[key] = f"static/img/weekly/{folder.name}/{name}"
        return images

    def issue_view(self, issue, lang):
        data = issue["data"]
        week = data.get("week")
        papers = [{**p[lang], "type": p["type"][lang],
                   "citation": p.get("citation", ""), "url": p.get("url"),
                   "pubmed": "pubmed" in (p.get("url") or "")}
                  for p in data.get("papers", []) if lang in p]
        images = self.copy_issue_images(issue)
        return {
            "number": data.get("issue_number", 1), "week": week,
            "dates": weekly.date_range(week, lang), "month": weekly.month_label(week, lang),
            "sample": not issue["checked"],
            "title": weekly.title(data, lang),
            "subject": data["subject"][lang],
            "q": data["ecg"][lang], "images": images, "ecg_id": issue["meta"].get("ecg_id", "?"),
            "og_image": self.absolute(images["image"]) if images.get("image") else None,
            "papers_intro": (data.get("papers_intro") or {}).get(lang),
            "papers": papers,
            "tip": (data.get("nurse_tip") or {}).get(lang),
        }

    def build_digest(self, lang):
        """The digest page (latest issue + archive, or a placeholder), one page per issue,
        and an Atom feed."""
        views = []
        for issue in self.issues:
            slugs = {l: DIGEST_SLUGS[l] + issue["folder"].name + "/" for l in LANGS}
            views.append({**self.issue_view(issue, lang), "slug": slugs[lang], "slugs": slugs})
        feed = DIGEST_SLUGS[lang] + "feed.xml"
        for i, view in enumerate(views):
            self.render("digest_issue.html", lang, "digest", out_slug=view["slug"],
                        alt_slugs=view["slugs"], issue=view, feed=feed,
                        newer=views[i - 1] if i > 0 else None,
                        older=views[i + 1] if i + 1 < len(views) else None)
        groups = []
        for view in views[1:]:
            label = view["month"] or self.strings[lang]["free"]["digest"]["samples_group"]
            if not groups or groups[-1]["label"] != label:
                groups.append({"label": label, "issues": []})
            groups[-1]["issues"].append(view)
        self.render("digest_index.html", lang, "digest", latest=views[0] if views else None,
                    groups=groups, feed=feed)
        self.write_feed(lang, views, feed)
        return views

    def write_feed(self, lang, views, feed):
        """An Atom feed of the issues, so readers can follow without giving an email."""
        s = self.strings[lang]["free"]
        name = fill(s["meta"]["digest_title"], self.values(lang))
        entries = []
        for view in views[:20]:
            dates = weekly.week_dates(view["week"])
            if not dates:  # samples have no week (preview only)
                continue
            stamp = dates[0].isoformat() + "T08:00:00Z"
            url = self.absolute(view["slug"])
            summary = " · ".join([view["q"]["prompt"]] + [p["headline"] for p in view["papers"]])
            entries.append(
                f"<entry><title>{xml_escape(view['title'])}</title>"
                f'<link rel="alternate" href="{xml_escape(url)}"/><id>{xml_escape(url)}</id>'
                f"<updated>{stamp}</updated><published>{stamp}</published>"
                f"<summary>{xml_escape(summary)}</summary></entry>")
        latest = next((weekly.week_dates(v["week"]) for v in views if weekly.week_dates(v["week"])), None)
        updated = (latest[0].isoformat() if latest else (UPDATED_FREE if self.free else UPDATED)) + "T08:00:00Z"
        page = self.absolute(DIGEST_SLUGS[lang])
        xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
               f'<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="{lang}">'
               f"<title>{xml_escape(name)}</title>"
               f"<subtitle>{xml_escape(s['meta']['digest_description'])}</subtitle>"
               f'<link rel="alternate" href="{xml_escape(page)}"/>'
               f'<link rel="self" href="{xml_escape(self.absolute(feed))}"/>'
               f"<id>{xml_escape(page)}</id><updated>{updated}</updated>"
               f"<author><name>{xml_escape(self.config['brand'])}</name></author>"
               + "".join(entries) + "</feed>\n")
        out = DIST / feed
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(xml, encoding="utf-8")

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
                basics = self.basics(lang)
                self.render("home_free.html", lang, "home", quiz=self.quiz(lang),
                            trace_json=trace_json, modules=self.modules(lang),
                            totals=self.totals(), az_sample=sample, basics=basics,
                            basics_by_step={b["step"]: b for b in basics if b.get("step")})
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
                # Publish only the tracings of the cases and lessons that go live.
                kept = {f"{c['ecg_id']}.json" for c in self.app_data["cases"]["cases"]}
                for l in self.app_data["lessons"]["lessons"]:
                    for st in l["steps"]:
                        for f in (st, st.get("figure") or {}):
                            if f.get("ecg") is not None:
                                kept.add(f"{f['ecg']}.json")
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
        if self.free:
            for issue in self.issues:
                slugs = {l: DIGEST_SLUGS[l] + issue["folder"].name + "/" for l in LANGS}
                alts = "".join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{self.absolute(slugs[l])}"/>'
                               for l in LANGS)
                for lang in LANGS:
                    urls.append(f"<url><loc>{self.absolute(slugs[lang])}</loc>{alts}</url>")
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
        print("Note: no checked weekly issue yet, so the home page has no ECG quiz and the "
              "ECG of the week page shows its placeholder.")
    else:
        live = [i["folder"].name for i in site.issues if i["checked"]]
        print(f"Weekly issues on the site: {', '.join(live) or 'none checked'}"
              + ("" if len(live) == len(site.issues) else
                 f" (preview also shows unchecked: {', '.join(i['folder'].name for i in site.issues if not i['checked'])})"))


if __name__ == "__main__":
    main()
