"""The weekly ECG digest on the site: reading, checking and dating the issues.

Shared by build.py (the "ECG of the week" pages) and tools/digest.py (adding each
week's issue). An issue is one folder in ecg-digest/issues/ holding issue.json, the
ECG picture(s) and ecg.json (the PTB-XL record it came from).

The live site shows an issue only when Alex has checked all of it:
  - "checked_by_alex": true at the top of issue.json (the ECG, its answer and the
    nurse tip), and
  - "checked_by_alex": true on every paper (each summary against its abstract).
The preview build (build.py --preview) also shows unchecked issues, marked as samples.
"""
import datetime as dt
import json
import re
from pathlib import Path

LANGS = ("ro", "en")
FOLDER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]*$")
FILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
WEEK_RE = re.compile(r"^(\d{4})-W(\d{2})$")
MONTHS = {
    "ro": ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie",
           "august", "septembrie", "octombrie", "noiembrie", "decembrie"],
    "en": ["January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"],
}
# The email subject starts with the digest's name; on the site the page already says it.
TITLE_PREFIXES = ("ECG-ul săptămânii:", "ECG of the week:")
TOP_LEVEL_CHECK = "the ECG, its answer and the nurse tip (checked_by_alex at the top of issue.json)"


# Dates ----------------------------------------------------------------------
def week_dates(week):
    """Monday and Sunday of an ISO week such as "2026-W42", or None."""
    m = WEEK_RE.match(week) if isinstance(week, str) else None
    if not m:
        return None
    try:
        monday = dt.date.fromisocalendar(int(m.group(1)), int(m.group(2)), 1)
    except ValueError:
        return None
    return monday, monday + dt.timedelta(days=6)


def date_range(week, lang):
    """ "12–18 octombrie 2026" / "12–18 October 2026" for an ISO week ("" if none)."""
    dates = week_dates(week)
    if not dates:
        return ""
    a, b = dates
    names = MONTHS[lang]
    if a.year != b.year:
        return f"{a.day} {names[a.month - 1]} {a.year} – {b.day} {names[b.month - 1]} {b.year}"
    if a.month != b.month:
        return f"{a.day} {names[a.month - 1]} – {b.day} {names[b.month - 1]} {b.year}"
    return f"{a.day}–{b.day} {names[a.month - 1]} {a.year}"


def month_label(week, lang):
    """ "Octombrie 2026" / "October 2026": the month of the issue's Monday."""
    dates = week_dates(week)
    if not dates:
        return ""
    name = MONTHS[lang][dates[0].month - 1]
    return f"{name[:1].upper()}{name[1:]} {dates[0].year}"


def title(issue, lang):
    """The issue's page title: "title" if given, else the email subject without its prefix."""
    custom = _get(issue, "title", lang)
    if isinstance(custom, str) and custom.strip():
        return custom.strip()
    subject = (_get(issue, "subject", lang) or "").strip()
    for prefix in TITLE_PREFIXES:
        if subject.startswith(prefix):
            rest = subject[len(prefix):].strip()
            return rest[:1].upper() + rest[1:] if rest else subject
    return subject


# Checking -------------------------------------------------------------------
def _get(data, *keys):
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        elif isinstance(data, list) and isinstance(key, int) and 0 <= key < len(data):
            data = data[key]
        else:
            return None
    return data


def _is_text(value):
    return isinstance(value, str) and bool(value.strip())


def _is_lines(value, minimum=1):
    return (isinstance(value, list) and len(value) >= minimum
            and all(_is_text(v) for v in value))


def problems(issue, folder):
    """Everything wrong with one issue folder, as plain sentences (empty list = fine)."""
    folder = Path(folder)
    out = []

    def need_text(value, where):
        if not _is_text(value):
            out.append(f"{where} is missing or empty")

    def need_lines(value, where, minimum=1):
        if not _is_lines(value, minimum):
            out.append(f"{where} needs at least {minimum} non-empty line{'s' if minimum > 1 else ''}")

    def optional_text(value, where):
        if value is not None and not _is_text(value):
            out.append(f"{where} must be text")

    def need_file(name, where):
        if not _is_text(name):
            out.append(f"{where} is missing")
        elif not FILE_RE.match(name):
            out.append(f"{where} {name!r} must be a plain file name in the issue folder")
        elif not (folder / name).is_file():
            out.append(f"{where} {name!r} is not in the folder")

    if not isinstance(issue, dict):
        return ["issue.json must hold one JSON object"]
    if not FOLDER_RE.match(folder.name):
        out.append(f"folder name {folder.name!r} may use only letters, digits and dashes "
                   "(it becomes the page address)")
    number = issue.get("issue_number")
    if not isinstance(number, int) or isinstance(number, bool) or number < 1:
        out.append("issue_number must be a whole number, 1 or more")
    week = issue.get("week")
    if week is not None and not week_dates(week):
        out.append(f"week {week!r} is not a real ISO week such as 2026-W42")
    if "checked_by_alex" in issue and not isinstance(issue["checked_by_alex"], bool):
        out.append("checked_by_alex must be true or false")
    for lang in LANGS:
        need_text(_get(issue, "subject", lang), f"subject.{lang}")
        optional_text(_get(issue, "title", lang), f"title.{lang}")
        optional_text(_get(issue, "preheader", lang), f"preheader.{lang}")
        optional_text(_get(issue, "papers_intro", lang), f"papers_intro.{lang}")

    ecg = issue.get("ecg")
    if not isinstance(ecg, dict):
        out.append("ecg is missing")
    else:
        need_file(ecg.get("image"), "ecg.image")
        if ecg.get("full_image") is not None:
            need_file(ecg.get("full_image"), "ecg.full_image")
        meta_name = ecg.get("meta", "ecg.json")
        need_file(meta_name, "ecg.meta")
        if _is_text(meta_name) and FILE_RE.match(meta_name) and (folder / meta_name).is_file():
            try:
                meta = json.loads((folder / meta_name).read_text(encoding="utf-8"))
            except (OSError, ValueError) as err:
                out.append(f"{meta_name} cannot be read: {err}")
            else:
                if not isinstance(meta, dict) or meta.get("ecg_id") in (None, ""):
                    out.append(f"{meta_name} needs the PTB-XL record number (ecg_id) for the credit line")
        for lang in LANGS:
            q = ecg.get(lang)
            where = f"ecg.{lang}"
            if not isinstance(q, dict):
                out.append(f"{where} is missing")
                continue
            need_text(q.get("prompt"), f"{where}.prompt")
            options = q.get("options")
            need_lines(options, f"{where}.options", 2)
            index = q.get("answer_index")
            if (not isinstance(index, int) or isinstance(index, bool)
                    or not isinstance(options, list) or not 0 <= index < len(options)):
                out.append(f"{where}.answer_index must point at one of the options (counting from 0)")
            need_lines(q.get("answer_points"), f"{where}.answer_points")
            for key in ("deeper", "why_it_matters", "pearl"):
                optional_text(q.get(key), f"{where}.{key}")
        if all(isinstance(ecg.get(l), dict) for l in LANGS):
            ro, en = ecg["ro"], ecg["en"]
            if (isinstance(ro.get("options"), list) and isinstance(en.get("options"), list)
                    and len(ro["options"]) != len(en["options"])):
                out.append("ecg.ro and ecg.en have a different number of options")
            if ro.get("answer_index") != en.get("answer_index"):
                out.append("ecg.ro and ecg.en point at different answers")

    papers = issue.get("papers")
    if not isinstance(papers, list) or not papers:
        out.append("papers is missing (a weekly issue has three)")
    else:
        for i, paper in enumerate(papers, 1):
            where = f"paper {i}"
            if not isinstance(paper, dict):
                out.append(f"{where} must be a JSON object")
                continue
            need_text(paper.get("citation"), f"{where} citation")
            url = paper.get("url")
            if not (isinstance(url, str) and re.match(r"^https?://\S+$", url)):
                out.append(f"{where} url must be a web address (https://…)")
            if "checked_by_alex" in paper and not isinstance(paper["checked_by_alex"], bool):
                out.append(f"{where} checked_by_alex must be true or false")
            for lang in LANGS:
                need_text(_get(paper, "type", lang), f"{where} type.{lang}")
                need_text(_get(paper, lang, "headline"), f"{where} {lang}.headline")
                need_text(_get(paper, lang, "summary"), f"{where} {lang}.summary")
                optional_text(_get(paper, lang, "practice"), f"{where} {lang}.practice")

    tip = issue.get("nurse_tip")
    if tip is not None:
        for lang in LANGS:
            where = f"nurse_tip.{lang}"
            if not isinstance(_get(tip, lang), dict):
                out.append(f"{where} is missing")
                continue
            need_text(_get(tip, lang, "title"), f"{where}.title")
            need_lines(_get(tip, lang, "points"), f"{where}.points")
            optional_text(_get(tip, lang, "action"), f"{where}.action")
    return out


def unchecked(issue):
    """What Alex still has to check before the issue can go live (empty list = ready)."""
    if not isinstance(issue, dict):
        return ["the whole issue"]
    out = []
    if issue.get("checked_by_alex") is not True:
        out.append(TOP_LEVEL_CHECK)
    papers = issue.get("papers")
    if not isinstance(papers, list) or not papers:
        out.append("the papers (there are none)")
    else:
        for i, paper in enumerate(papers, 1):
            if not isinstance(paper, dict) or paper.get("checked_by_alex") is not True:
                cite = paper.get("citation") if isinstance(paper, dict) else None
                out.append(f"paper {i}" + (f": {cite}" if cite else ""))
    return out


def is_checked(issue):
    return not unchecked(issue)


# Reading --------------------------------------------------------------------
def read_folder(folder):
    """One issue folder as a dict: folder, data, meta, problems, checked."""
    folder = Path(folder)
    item = {"folder": folder, "data": None, "meta": {}, "problems": [], "checked": False}
    try:
        data = json.loads((folder / "issue.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        item["problems"] = [f"issue.json cannot be read: {err}"]
        return item
    item["data"] = data
    item["problems"] = problems(data, folder)
    item["checked"] = is_checked(data)
    if not item["problems"]:
        item["meta"] = json.loads((folder / data["ecg"].get("meta", "ecg.json")).read_text(encoding="utf-8"))
    return item


def read_all(issues_dir):
    """Every issue folder under issues_dir (a folder counts if it has issue.json)."""
    issues_dir = Path(issues_dir)
    if not issues_dir.is_dir():
        return []
    return [read_folder(p.parent) for p in sorted(issues_dir.glob("*/issue.json"))]


def sort_key(item):
    """Real issues (with a week) first, newest week first; samples after."""
    data = item["data"] or {}
    week = data.get("week") if week_dates(data.get("week")) else None
    number = data.get("issue_number") if isinstance(data.get("issue_number"), int) else 0
    return (week is not None, week or "", number, item["folder"].name)


def select(issues_dir, preview, warn=print):
    """The issues the site shows, newest first.

    Live build: only issues Alex has checked. Preview: every issue that reads cleanly.
    A broken issue is skipped with a warning, except one already marked as checked:
    that stops the build, because it was meant to go live.
    """
    shown = []
    for item in read_all(issues_dir):
        name = item["folder"].name
        if item["problems"]:
            if item["data"] is not None and is_checked(item["data"]):
                raise SystemExit(f"Weekly issue {name} is marked as checked but has problems:\n  - "
                                 + "\n  - ".join(item["problems"]))
            warn(f"Skipping weekly issue {name}: " + "; ".join(item["problems"]))
            continue
        if item["checked"] or preview:
            shown.append(item)
    shown.sort(key=sort_key, reverse=True)
    return shown
