"""Tests for the weekly digest pages and tools/digest.py.

    cd website && python3 -m unittest tests/test_digest.py

Builds the site into temporary folders from made-up issues (copies of the week 42 issue
with different weeks and check marks), so the real issues are never changed.
"""
import contextlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.dom.minidom
from pathlib import Path

WEBSITE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WEBSITE))
sys.path.insert(0, str(WEBSITE / "tools"))
import build  # noqa: E402
import digest  # noqa: E402  (tools/digest.py)
import digest_issues as weekly  # noqa: E402

REAL_ISSUES = (WEBSITE / json.loads((WEBSITE / "site.config.json").read_text())["issues_dir"]).resolve()
TEMPLATE = REAL_ISSUES / "2026-W42"


def make_issue(root, name, week, number, top=True, papers=True, edit=None):
    """A copy of the week 42 issue with its own week, number and check marks."""
    folder = Path(root) / name
    shutil.copytree(TEMPLATE, folder)
    data = json.loads((folder / "issue.json").read_text(encoding="utf-8"))
    if week is None:
        data.pop("week", None)
    else:
        data["week"] = week
    data["issue_number"] = number
    data["checked_by_alex"] = top
    for p in data["papers"]:
        p["checked_by_alex"] = papers
    if edit:
        edit(data)
    (folder / "issue.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return folder


class Built:
    """Build the site into a temporary folder from a given issues folder."""

    def __init__(self, issues_dir, preview=False):
        self.tmp = tempfile.TemporaryDirectory()
        self.dist = Path(self.tmp.name) / "dist"
        old = build.DIST
        build.DIST = self.dist
        try:
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.site = build.Site(preview, issues_dir=issues_dir)
                self.site.build()
            self.log = out.getvalue()
        finally:
            build.DIST = old

    def page(self, rel):
        return (self.dist / rel).read_text(encoding="utf-8")

    def close(self):
        self.tmp.cleanup()


class DatesTest(unittest.TestCase):
    def test_ranges(self):
        self.assertEqual(weekly.date_range("2026-W42", "ro"), "12–18 octombrie 2026")
        self.assertEqual(weekly.date_range("2026-W42", "en"), "12–18 October 2026")
        self.assertEqual(weekly.date_range("2026-W44", "ro"), "26 octombrie – 1 noiembrie 2026")
        self.assertEqual(weekly.date_range("2026-W53", "en"), "28 December 2026 – 3 January 2027")
        self.assertEqual(weekly.date_range("2025-W53", "en"), "")  # 2025 has 52 weeks
        self.assertEqual(weekly.date_range(None, "ro"), "")
        self.assertEqual(weekly.month_label("2026-W44", "ro"), "Octombrie 2026")

    def test_title_drops_the_email_prefix(self):
        data = {"subject": {"ro": "ECG-ul săptămânii: tahicardie regulată", "en": "ECG of the week: regular tachycardia"}}
        self.assertEqual(weekly.title(data, "ro"), "Tahicardie regulată")
        self.assertEqual(weekly.title(data, "en"), "Regular tachycardia")
        data["title"] = {"ro": "Alt titlu"}
        self.assertEqual(weekly.title(data, "ro"), "Alt titlu")


class CheckingTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_real_issues_are_valid(self):
        for item in weekly.read_all(REAL_ISSUES):
            self.assertEqual(item["problems"], [], item["folder"].name)

    def test_live_needs_every_check(self):
        cases = {"all": (True, True, True), "no-top": (False, True, False),
                 "no-papers": (True, False, False), "none": (False, False, False)}
        for name, (top, papers, live) in cases.items():
            folder = make_issue(self.root, name, "2026-W43", 2, top, papers)
            self.assertEqual(weekly.read_folder(folder)["checked"], live, name)

    def test_one_unchecked_paper_blocks(self):
        folder = make_issue(self.root, "x", "2026-W43", 2,
                            edit=lambda d: d["papers"][1].update(checked_by_alex=False))
        item = weekly.read_folder(folder)
        self.assertFalse(item["checked"])
        self.assertEqual(len(weekly.unchecked(item["data"])), 1)

    def test_problems_are_found(self):
        def breaks(d):
            d["ecg"]["ro"]["answer_index"] = 9
            d["papers"][0]["en"]["headline"] = ""
            d["week"] = "2026-W60"
        folder = make_issue(self.root, "bad", "2026-W43", 2, top=False, papers=False, edit=breaks)
        (folder / "ecg.png").unlink()
        text = " | ".join(weekly.problems(json.loads((folder / "issue.json").read_text()), folder))
        for bit in ("answer_index", "paper 1 en.headline", "ISO week", "'ecg.png' is not in the folder",
                    "point at different answers"):
            self.assertIn(bit, text)

    def test_checked_but_broken_stops_the_build(self):
        make_issue(self.root, "2026-W43", "2026-W43", 2,
                   edit=lambda d: d["ecg"]["en"].pop("prompt"))
        with self.assertRaises(SystemExit):
            weekly.select(self.root, preview=False, warn=lambda _: None)

    def test_unchecked_and_broken_is_skipped(self):
        make_issue(self.root, "2026-W43", "2026-W43", 2, top=False,
                   edit=lambda d: d["ecg"]["en"].pop("prompt"))
        warnings = []
        self.assertEqual(weekly.select(self.root, preview=True, warn=warnings.append), [])
        self.assertEqual(len(warnings), 1)


class PagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        cls.issues = root / "issues"
        cls.issues.mkdir()
        make_issue(cls.issues, "2026-W42", "2026-W42", 1)
        make_issue(cls.issues, "2026-W43", "2026-W43", 2,
                   edit=lambda d: d["subject"].update(ro="ECG-ul săptămânii: al doilea număr",
                                                      en="ECG of the week: the second issue"))
        make_issue(cls.issues, "2026-W44", "2026-W44", 3, top=False)  # waiting for Alex
        cls.live = Built(cls.issues)
        cls.preview = Built(cls.issues, preview=True)
        cls.empty_dir = root / "empty"
        cls.empty_dir.mkdir()
        cls.empty = Built(cls.empty_dir)

    @classmethod
    def tearDownClass(cls):
        for b in (cls.live, cls.preview, cls.empty):
            b.close()
        cls.tmp.cleanup()

    def test_live_shows_only_checked_issues(self):
        d = self.live.dist
        self.assertTrue((d / "ecg-saptamanii/2026-W42/index.html").exists())
        self.assertTrue((d / "en/ecg-of-the-week/2026-W43/index.html").exists())
        self.assertFalse((d / "ecg-saptamanii/2026-W44").exists())
        self.assertFalse((d / "static/img/weekly/2026-W44").exists())
        index = self.live.page("ecg-saptamanii/index.html")
        self.assertNotIn("2026-W44", index)
        self.assertNotIn("număr de probă", index)

    def test_index_features_the_newest_and_lists_the_rest(self):
        index = self.live.page("ecg-saptamanii/index.html")
        latest = index.index("Cel mai recent număr")
        archive = index.index("Numere anterioare")
        self.assertLess(latest, index.index("Al doilea număr"), "newest issue is featured first")
        self.assertLess(archive, index.index('href="2026-W42/"'), "older issue is in the archive")
        self.assertIn("Octombrie 2026", index)
        self.assertIn("19–25 October 2026", self.live.page("en/ecg-of-the-week/index.html"))

    def test_issue_pages_link_to_each_other(self):
        newer = self.live.page("ecg-saptamanii/2026-W43/index.html")
        older = self.live.page("ecg-saptamanii/2026-W42/index.html")
        self.assertIn('rel="prev" href="../2026-W42/"', newer)
        self.assertNotIn('rel="next"', newer)
        self.assertIn('rel="next" href="../2026-W43/"', older)
        self.assertIn("Săptămâna 19–25 octombrie 2026", newer)
        self.assertIn('hreflang="en" href="https://', newer)
        self.assertIn("Deschide în PubMed", newer)

    def test_preview_marks_unchecked_issues(self):
        index = self.preview.page("ecg-saptamanii/index.html")
        self.assertIn("2026-W44", index)
        self.assertIn("număr de probă", index)
        page = self.preview.page("ecg-saptamanii/2026-W44/index.html")
        self.assertIn("neverificat încă de medic", page)

    def test_placeholder_until_the_first_checked_issue(self):
        for rel, text in (("ecg-saptamanii/index.html", "Primul număr apare în curând"),
                          ("en/ecg-of-the-week/index.html", "The first issue is coming soon")):
            page = self.empty.page(rel)
            self.assertIn(text, page)
            self.assertNotIn("issue-list", page)
        home = self.empty.page("index.html")
        self.assertIn('href="ecg-saptamanii/"', home, "the menu links the digest page")
        self.assertNotIn('class="quiz"', home)

    def test_feed_and_sitemap(self):
        feed = xml.dom.minidom.parse(str(self.live.dist / "ecg-saptamanii/feed.xml"))
        entries = feed.getElementsByTagName("entry")
        self.assertEqual(len(entries), 2)
        self.assertIn("Al doilea număr", entries[0].getElementsByTagName("title")[0].firstChild.data)
        empty = xml.dom.minidom.parse(str(self.empty.dist / "en/ecg-of-the-week/feed.xml"))
        self.assertEqual(len(empty.getElementsByTagName("entry")), 0)
        sitemap = self.live.page("sitemap.xml")
        self.assertIn("/ecg-saptamanii/2026-W43/", sitemap)
        self.assertNotIn("2026-W44", sitemap)

    def test_no_broken_links(self):
        for b in (self.live, self.preview, self.empty):
            run = subprocess.run([sys.executable, str(WEBSITE / "tests" / "check_links.py"), str(b.dist)],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stdout)


class ToolTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.site = self.root / "site"
        self.site.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def run_tool(self, *args):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            code = digest.main(list(args))
        return code, out.getvalue()

    def test_add_copies_only_what_the_site_needs(self):
        source = make_issue(self.root / "workspace", "2026-W45", "2026-W45", 4, top=False)
        (source / "shortlist.md").write_text("not for the site")
        code, out = self.run_tool("add", str(source), "--to", str(self.site))
        self.assertEqual(code, 0)
        copied = sorted(p.name for p in (self.site / "2026-W45").iterdir())
        self.assertEqual(copied, ["ecg-email.png", "ecg.json", "ecg.png", "issue.json"])
        self.assertIn("waiting for Alex's check", out)
        # Adding again replaces the copy (an updated issue).
        code, out = self.run_tool("add", str(source), "--to", str(self.site))
        self.assertIn("Updated", out)

    def test_add_refuses_a_broken_issue(self):
        source = make_issue(self.root / "workspace", "2026-W45", "2026-W45", 4,
                            edit=lambda d: d.pop("papers"))
        code, out = self.run_tool("add", str(source), "--to", str(self.site))
        self.assertEqual(code, 1)
        self.assertFalse((self.site / "2026-W45").exists())

    def test_check(self):
        make_issue(self.site, "2026-W45", "2026-W45", 4)
        self.assertEqual(self.run_tool("check", "--dir", str(self.site))[0], 0)
        make_issue(self.site, "2026-W46", "2026-W46", 5, edit=lambda d: d.pop("subject"))
        code, out = self.run_tool("check", "--dir", str(self.site))
        self.assertEqual(code, 1)
        self.assertIn("2026-W46: BROKEN", out)


if __name__ == "__main__":
    unittest.main()
