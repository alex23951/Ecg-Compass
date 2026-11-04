#!/usr/bin/env python3
"""Write a review sheet of the new medical text for Alex: the beginner lessons (every text,
question, answer and mark label) and the marks on each case (label per finding).

    python3 trainer/authoring/review_sheet.py OUT.md

Reads the built data (app/data/lessons.json and app/data/cases.json), so run
build_cases.py and build_lessons.py first.
"""
import json
import sys
from pathlib import Path

WEBSITE = Path(__file__).resolve().parents[2]
DATA = WEBSITE / "app" / "data"
STEP_NAMES = {0: "Before step 1", 1: "Step 1", 2: "Step 2", 3: "Step 3", 4: "Step 4", 5: "Step 5",
              6: "Step 6", 7: "Step 7", 8: "Step 8"}


def two(v):
    if v is None:
        return []
    if isinstance(v, str):
        return [f"{v}"]
    ro, en = v.get("ro"), v.get("en")
    if isinstance(ro, list):
        return [f"RO: {r}  \n  EN: {e}" for r, e in zip(ro, en)]
    return [f"RO: {ro}  \n  EN: {en}"]


def label(a):
    lab = a.get("label")
    if lab is None:
        return ""
    if isinstance(lab, str):
        return lab
    return f"{lab['ro']} / {lab['en']}"


def mark_line(a):
    where = a.get("lead", "all rows") + (" (rhythm strip)" if a.get("rhythm") else "")
    extra = []
    if "mm" in a:
        extra.append(f"measured {a['mm']} mm")
    if "ms" in a:
        extra.append(f"{a['ms']} ms")
    return f"{a['kind']} on {where}: {label(a) or '(no label)'}" + (f" [{', '.join(extra)}]" if extra else "")


def main():
    out = Path(sys.argv[1])
    lessons = [l for l in json.loads((DATA / "lessons.json").read_text())["lessons"] if l.get("course") == "basics"]
    data = json.loads((DATA / "cases.json").read_text())
    approved = set(json.loads((WEBSITE / "trainer" / "content" / "approved.json").read_text())["cases"])
    lines = ["# Review sheet: beginner module and marked findings", "",
             "New medical text for Alex's check. Everything here is new; nothing approved before was changed.", ""]
    lines += ["## Part 1. Beginner module: read an ECG step by step", ""]
    for l in lessons:
        lines += [f"### {STEP_NAMES.get(l.get('step'), '')}: {l['title']['en']} ({l['id']}, {l['minutes']} min)", ""]
        lines += [f"- Title: {x}" for x in two(l["title"])]
        lines += [f"- Summary: {x}" for x in two(l["summary"])]
        lines += [f"- Goal: {x}" for x in two(l["objectives"])]
        lines.append("")
        for st in l["steps"]:
            kind = st["type"]
            head = st.get("heading") or st.get("question") or st.get("prompt")
            lines.append(f"**{st['id']} · {kind}**" + (f": {head['en']}" if head else ""))
            if head:
                lines += [f"- {x}" for x in two(head)]
            for x in two(st.get("body")):
                lines.append(f"- {x}")
            if kind == "diagram":
                lines.append(f"- Diagram: {st['name']}")
            if kind in ("figure", "guided", "task") or st.get("figure"):
                f = st.get("figure") or st
                src = f.get("source", {})
                lines.append(f"- Tracing: PTB-XL {src.get('ecg_id', f.get('ecg'))}, "
                             + (f"leads {', '.join(f.get('leads', []))}, {f.get('window')} s" if f.get("layout") != "standard" else "12-lead"))
            for s in st.get("sets", []):
                lines.append(f"- Set „{s['label']['ro']}” / \"{s['label']['en']}\"")
                lines += [f"  - Note: {x}" for x in two(s.get("note"))]
                lines += [f"  - Mark: {mark_line(a)}" for a in s.get("annotations", [])]
            for k, fr in enumerate(st.get("frames", [])):
                lines.append(f"- Frame {k + 1}: {fr['title']['ro']} / {fr['title']['en']}")
                lines += [f"  - {x}" for x in two(fr.get("text"))]
                lines += [f"  - Mark: {mark_line(a)}" for a in fr.get("annotations", [])]
            if st.get("figure"):
                lines += [f"  - Mark shown after the answer: {mark_line(a)}" for a in st["figure"].get("annotations", [])]
            if kind == "check":
                for i, o in enumerate(st["options"]):
                    lines.append(f"- {'✔' if i == st['answer'] else '·'} {o['ro']} / {o['en']}")
                lines += [f"- Why: {x}" for x in two(st.get("explain"))]
            if kind == "task":
                lines.append(f"- Measure {st['measure']}: reference {st.get('ref')} ± {st.get('tol')}")
                lines += [f"- Why: {x}" for x in two(st.get("explain"))]
            if kind == "cases":
                lines.append(f"- Cases: {', '.join(st['cases'])}")
            lines.append("")
    lines += ["## Part 2. Marked findings on the trainer ECGs", "",
              "Each mark is numbered like the finding it shows. Cases marked (live) are on the site now; the others "
              "wait for your review of the case itself.", ""]
    for c in data["cases"]:
        anns = c.get("annotations") or []
        if not anns:
            continue
        name = data["diagnoses"][c["answer"]]["name"]["en"]
        lines += [f"### {c['id']}: {name}{' (live)' if c['id'] in approved else ''}", ""]
        fs = c["findings"]["en"]
        for i, f in enumerate(fs):
            mine = [a for a in anns if a.get("finding") == i]
            if mine:
                lines.append(f"{i + 1}. {f}")
                lines += [f"   - {mark_line(a)}" for a in mine]
        other = [a for a in anns if a.get("finding") is None]
        lines += [f"- (no finding) {mark_line(a)}" for a in other]
        lines.append("")
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {out}: {len(lessons)} lessons, {sum(1 for c in data['cases'] if c.get('annotations'))} marked cases")


if __name__ == "__main__":
    main()
