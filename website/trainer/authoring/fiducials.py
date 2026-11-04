#!/usr/bin/env python3
"""Print where the named points of each beat fall on a tracing, lead by lead, as the
annotation builder (trainer/annotate.py) will find them. Use it to choose "at" and "beat"
for an annotation, or to read times for hand-placed marks ("t").

    python3 trainer/authoring/fiducials.py CASE_ID                 the 12-lead grid of a case
    python3 trainer/authoring/fiducials.py CASE_ID --leads II,V1   chosen leads (12-lead cells)
    python3 trainer/authoring/fiducials.py CASE_ID --strip II --window 0.5,3.5   a strip figure
    python3 trainer/authoring/fiducials.py --ecg 1484 --strip II --window 0,10   any PTB-XL ECG
                                                                     (signal file must exist)
Times in seconds, voltages in mV (10 mm/mV: 0.1 mV = 1 small square), "base" is the PR
segment level of that beat in that lead (the baseline for ST and heights). Without PTB-XL+
measurements (MIMIC, monitor strips) there are no named points: the QRS times are listed
so you can place marks with "t" (and "snap").
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import annotate  # noqa: E402

NAMES = ["Pon", "P", "Poff", "QRSon", "Q", "R", "S", "J", "ST", "T", "Tend"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case", nargs="?")
    ap.add_argument("--ecg", help="a signal key instead of a case (PTB-XL number, mimic-..., vfdb-...)")
    ap.add_argument("--leads", help="12-lead cells to list (default: all)")
    ap.add_argument("--strip", help="a strip figure: these leads, comma separated")
    ap.add_argument("--window", help="strip window t0,t1 in seconds (default 0,10)")
    ap.add_argument("--signals", help="extra folder of signal files (a dry run's emit/signals)")
    args = ap.parse_args()
    strips = ["II"]
    if args.case:
        built = {c["id"]: c for c in json.loads((annotate.OUT / "cases.json").read_text())["cases"]}
        c = built[args.case]
        key = c["ecg_id"]
        strips = c.get("strips") or ["II"]
        print(f"{args.case}: {c['answer']} · signal {key} · strips {strips}")
        print("findings (index: text):")
        for i, f in enumerate(c.get("findings", {}).get("en", [])):
            print(f"  {i}: {f}")
        if c.get("layout") == "monitor" and not args.strip:
            args.strip = "MON"
    else:
        key = args.ecg
    rec = annotate.load(key, args.signals)
    print(f"{len(rec.leads)} leads, {rec.dur:.1f} s, {len(rec.beats)} measured beats")
    peaks = rec.qrs_peaks()
    print("QRS complexes (s): " + ", ".join(f"{p:.3f}" for p in peaks))
    if args.strip:
        leads = args.strip.split(",")
        win = [float(x) for x in args.window.split(",")] if args.window else [0, rec.dur]
        cells = [(lead, False, "strip", win) for lead in leads]
        print(f"strip window {win[0]}-{win[1]} s; thick grid lines at t = {win[0] + 0.12:.2f} + 0.2·k s")
    else:
        leads = args.leads.split(",") if args.leads else [x for col in annotate.COLS for x in col]
        cells = [(lead, False, "standard", None) for lead in leads] + [(s, True, "standard", None) for s in strips]
        print("12-lead grid: each column shows 2.5 s (I-III 0-2.5, aVR-aVF 2.5-5, V1-V3 5-7.5, V4-V6 7.5-10);"
              " thick grid lines at t = 0.12 + 0.2·k s")
    for lead, rhythm, layout, win in cells:
        span = annotate.cell(rec, lead, rhythm, layout, strips, win)
        tag = f"{lead} (rhythm strip)" if rhythm else lead
        print(f"\n{tag}: visible {span[0]:.2f}-{span[1]:.2f} s")
        if not rec.beats:
            inside = [p for p in peaks if span[0] <= p <= span[1]]
            print("  QRS at " + ", ".join(f"{p:.3f} ({rec.at(lead, annotate.snap(rec, lead, p, 'abs', 0.05)):+.2f} mV)" for p in inside))
            continue
        k = 0
        while True:
            try:
                b = annotate.pick_beat(rec, span, k)
            except ValueError:
                break
            base = annotate.baseline(rec, lead, b)
            pts = []
            for n in NAMES:
                t = annotate.point(rec, lead, b, n)
                pts.append(f"{n} {t:.3f}/{rec.at(lead, t):+.2f}")
            print(f"  beat {k}: base {base:+.2f} mV | " + " | ".join(pts))
            print(f"          PR {round((b['q_on'] - b['p_on']) * 1000)} ms, QRS {round((b['q_off'] - b['q_on']) * 1000)} ms,"
                  f" QT {round((b['t_end'] - b['q_on']) * 1000)} ms, J-point deviation {(rec.at(lead, b['q_off']) - base) * 10:+.1f} mm,"
                  f" ST at J+60 {(rec.at(lead, annotate.point(rec, lead, b, 'ST')) - base) * 10:+.1f} mm")
            k += 1
            if k > 30:
                break
        if k == 0:
            print("  no complete beat in this span")


if __name__ == "__main__":
    main()
