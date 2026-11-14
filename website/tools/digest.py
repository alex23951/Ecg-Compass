#!/usr/bin/env python3
"""Put a weekly ECG digest issue on the site, and check the issues already there.

    python3 tools/digest.py add 2026-W47        copy that week's issue from the digest
                                                workspace into the site (repo ecg-digest/issues/)
    python3 tools/digest.py add <issue-folder>  same, from any folder holding issue.json
    python3 tools/digest.py list                every issue on the site and whether it is live
    python3 tools/digest.py check               fail if any issue on the site is broken

Replacing an issue that is already live with changed text but the same check marks is refused,
unless Alex approved that exact change (--change-approved).

Only issue.json, ecg.json and the ECG pictures are copied (not the emails, the paper
shortlist or the candidates). An issue goes live once Alex has checked all of it:
"checked_by_alex": true at the top of issue.json and on every paper. Until then it is
on the site's preview build only. Pushing to main publishes it (see website/README.md,
"Weekly digest").

Runs with plain Python 3 (no Jinja2 needed).
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

WEBSITE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WEBSITE))
import digest_issues as weekly  # noqa: E402

WORKSPACE = Path(os.environ.get("DIGEST_WORKSPACE", "/mnt/project-files/ecg-digest/issues"))


def site_issues_dir():
    config = json.loads((WEBSITE / "site.config.json").read_text(encoding="utf-8"))
    return (WEBSITE / config["issues_dir"]).resolve()


def status_line(item):
    data = item["data"] if isinstance(item["data"], dict) else {}
    name = item["folder"].name
    week = data.get("week")
    when = weekly.date_range(week, "en") if week else "sample (no week)"
    if item["problems"]:
        head = ("BROKEN and marked as checked: the site build stops until this is fixed"
                if item["data"] is None or weekly.meant_to_go_live(item) else "BROKEN, not shown")
        return f"{name}: {head}\n    - " + "\n    - ".join(item["problems"])
    if item["checked"]:
        return f"{name}: LIVE · No. {data.get('issue_number')} · {when}"
    return (f"{name}: waiting for Alex's check, preview only · No. {data.get('issue_number')} · {when}\n"
            "    still to check:\n    - " + "\n    - ".join(weekly.unchecked(data)))


def files_to_copy(data):
    ecg = data["ecg"]
    names = ["issue.json", ecg.get("meta", "ecg.json"), ecg["image"]]
    if ecg.get("full_image"):
        names.append(ecg["full_image"])
    return list(dict.fromkeys(names))


def resolve_source(arg):
    path = Path(arg).expanduser()
    if (path / "issue.json").is_file():
        return path.resolve()
    if path.name == "issue.json" and path.is_file():
        return path.parent.resolve()
    if (WORKSPACE / arg / "issue.json").is_file():
        return (WORKSPACE / arg).resolve()
    raise SystemExit(f"No issue.json in {arg!r} or in {WORKSPACE / arg}. "
                     "Pass the issue folder, or set DIGEST_WORKSPACE to the digest's issues folder.")


def cmd_add(args):
    source = resolve_source(args.issue)
    name = args.name or source.name
    item = weekly.read_folder(source, name)
    if item["problems"]:
        print(f"Not copied: {source} has problems:")
        for p in item["problems"]:
            print("  -", p)
        return 1
    target_root = Path(args.to).resolve() if args.to else site_issues_dir()
    target = target_root / name
    data = item["data"]
    if target.resolve() == source:
        print(f"{source} is already the site's copy; nothing to copy.")
    else:
        others = [i for i in weekly.read_all(target_root)
                  if i["folder"].name != name and isinstance(i["data"], dict) and i["data"].get("week")]
        for key, label in (("week", "week"), ("issue_number", "issue number")):
            same = [o["folder"].name for o in others if o["data"].get(key) == data.get(key)]
            if same and data.get("week"):
                print(f"Warning: {label} {data.get(key)} is also used by {', '.join(same)}")
        existed = target.exists()
        old = weekly.read_folder(target) if existed else None
        if old and old["checked"]:
            changed = weekly.without_checks(old["data"]) != weekly.without_checks(data)
            if item["checked"] and changed and not args.change_approved:
                print(f"Not copied: {name} is live and its text changed since Alex checked it, but the new "
                      "copy still carries the old check marks. Set the changed part's checked_by_alex to "
                      "false (until Alex checks it), or, if Alex approved this exact change, run again "
                      "with --change-approved.")
                return 1
            if not item["checked"]:
                print(f"Warning: {name} was live; this copy is not fully checked, so it comes off the "
                      "live site until Alex checks it again.")
        if existed:
            shutil.rmtree(target)
        target.mkdir(parents=True)
        for file in files_to_copy(item["data"]):
            shutil.copy2(source / file, target / file)
        print(f"{'Updated' if existed else 'Added'} {target} ({', '.join(files_to_copy(item['data']))})")
    print(status_line(weekly.read_folder(target)))
    return 0


def cmd_list(args):
    items = weekly.read_all(Path(args.dir) if args.dir else site_issues_dir())
    if not items:
        print("No issues on the site yet.")
    for item in sorted(items, key=weekly.sort_key, reverse=True):
        print(status_line(item))
    return 0


def cmd_check(args):
    items = weekly.read_all(Path(args.dir) if args.dir else site_issues_dir())
    broken = [i for i in items if i["problems"]]
    for item in broken:
        print(status_line(item))
    live = sum(1 for i in items if i["checked"] and not i["problems"])
    print(f"{len(items)} issue(s), {live} live, {len(broken)} broken")
    return 1 if broken else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    add = sub.add_parser("add", help="copy an issue into the site")
    add.add_argument("issue", help="a week such as 2026-W47 (looked up in the digest workspace) or an issue folder")
    add.add_argument("--name", help="folder name on the site (default: the source folder's name)")
    add.add_argument("--change-approved", action="store_true",
                     help="replace a live issue whose text changed, keeping its check marks "
                          "(only when Alex approved this exact change)")
    add.add_argument("--to", help=argparse.SUPPRESS)  # tests: another issues folder
    add.set_defaults(func=cmd_add)
    for name, func, text in (("list", cmd_list, "show every issue on the site"),
                             ("check", cmd_check, "fail if an issue on the site is broken")):
        p = sub.add_parser(name, help=text)
        p.add_argument("--dir", help=argparse.SUPPRESS)
        p.set_defaults(func=func)
    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
