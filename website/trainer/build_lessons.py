#!/usr/bin/env python3
"""Build the "ECG from scratch" lessons into app/data/lessons.json.

    python3 trainer/build_lessons.py           lessons.json + any missing signal files
    python3 trainer/build_lessons.py --plot D  also draw every figure's marks to D/*.png for checking

Reads trainer/content/lessons.json. Each lesson has RO/EN texts, a "tiers" map
(required | optional | skip for student, nurse, paramedic, resident, specialist, ep)
and a list of steps:

    text      heading?, body (RO/EN lists of paragraphs)
    diagram   name (one of DIAGRAMS below), caption?
    figure    a real ECG: "ecg" (PTB-XL number) or "case" (a trainer case id; MIMIC-IV-ECG and
              monitor-strip cases work too, but only with hand-placed "marks"), "transform"
              (la_ra, ra_ll or ra_rl: the same ECG as if two electrodes had been swapped,
              computed and labelled as such), "leads"
              (default ["II"]), "window" [t0, t1] in seconds, or "layout": "standard" for the
              12-lead; "sets": buttons that switch between sets of marks, each
              {label, note?, beat, show: [...]} or {label, note?, marks: [{t0, t1, tone, label,
              bracket?}]} with times read off the tracing (tone p | qrs | t | seg | rr)
              "gain" (5, 10 or 20 mm/mV, default 10) sets the starting gain of a figure or task
    task      measure with the calipers: "measure" rr | rate | pr | qrs | qt, "beat", "tol";
              on a PTB-XL ECG the reference is computed, elsewhere give "ref" and "init" by hand.
              "count" (QRS complexes in the window, no calipers) and "volt" (mm with voltage
              calipers on one lead, e.g. ST at the J point) always take "ref" by hand
Any step can carry "only": [tiers] to be shown to those profiles alone (the review shows all).
A lesson can list "teaches": [diagnosis keys]; a wrong answer on those links back to it.
    check     question, options (RO/EN), answer (index), explain
    cases     links to trainer cases

Marks ("show") name what to draw on beat number "beat" (0 = first complete beat in
the window): P, QRS, T, ST, TP (bands), PR, QRSd, QT, RR (brackets under the trace),
PRseg (the PR segment). The waves are found on the recording itself: QRS onset from
the spatial velocity of all 12 leads, then the PR, QRS and QT durations of the PTB-XL+
Glasgow measurement (so the numbers shown match the trainer's reference values), and
the end of P and start of T from lead II.
"""
import argparse
import base64
import csv
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEBSITE = HERE.parent
sys.path.insert(0, str(WEBSITE / "tools"))
sys.path.insert(0, str(HERE))
import ptbxl  # noqa: E402
import signals  # noqa: E402

CONTENT = HERE / "content"
OUT = WEBSITE / "app" / "data"
PLUS = WEBSITE / "cache" / "ptbxl-plus" / "unig_global.csv"
LANGS = ("ro", "en")
TIERS = ("student", "nurse", "paramedic", "resident", "specialist", "ep")
DIAGRAMS = {"paper", "beat", "conduction", "limb_leads", "chest_leads", "extra_leads", "monitor", "pads",
            "hexaxial", "lead_groups", "rate300", "av_blocks"}
TONES = {"p", "qrs", "t", "seg", "rr"}
BANDS = {"P": "p", "QRS": "qrs", "T": "t", "ST": "seg", "TP": "rr", "PRseg": "seg"}
BRACKETS = {"PR", "QRSd", "QT", "RR"}
TOL = {"rr": 40, "rate": 5, "pr": 20, "qrs": 16, "qt": 30, "count": 1, "volt": 0.5}
HAND = {"count", "volt"}  # references always measured by hand (count of QRS, mm with voltage calipers)
L = {name: i for i, name in enumerate(ptbxl.LEADS)}


def swap(sig, kind):
    """The 12 leads as if two electrodes had been swapped. la_ra and ra_ll are exact;
    ra_rl assumes the right leg sits at the left leg's potential (the usual teaching
    approximation): lead II goes flat and the chest leads shift by -II/3."""
    out = sig.copy()
    g = lambda n: sig[L[n]]  # noqa: E731
    if kind == "la_ra":
        new = {"I": -g("I"), "II": g("III"), "III": g("II"), "aVR": g("aVL"), "aVL": g("aVR"), "aVF": g("aVF")}
    elif kind == "ra_ll":
        new = {"I": -g("III"), "II": -g("II"), "III": -g("I"), "aVR": g("aVF"), "aVL": g("aVL"), "aVF": g("aVR")}
    elif kind == "ra_rl":
        i2, i3 = np.zeros_like(g("II")), g("III")
        i1 = -i3
        new = {"I": i1, "II": i2, "III": i3, "aVR": -(i1 + i2) / 2, "aVL": (i1 - i3) / 2, "aVF": (i2 + i3) / 2}
        for v in ("V1", "V2", "V3", "V4", "V5", "V6"):
            new[v] = g(v) - g("II") / 3
    else:
        raise ValueError(f"unknown transform {kind}")
    for n, x in new.items():
        out[L[n]] = x
    return out


def glasgow():
    with open(PLUS, newline="") as f:
        return {int(float(r["ecg_id"])): r for r in csv.DictReader(f)}


def beats(sig, fs, pr, qrs, qt):
    """Fiducial points (seconds) of every complete beat."""
    ii = sig[1]
    vel = np.nansum(np.abs(np.diff(sig, axis=1)), axis=0)
    k = max(1, int(0.01 * fs))
    vel = np.convolve(np.nan_to_num(vel), np.ones(k) / k, mode="same")
    # complexes: peaks of the spatial velocity above half its high percentile, 250 ms apart
    thr = 0.4 * np.percentile(vel, 99.5)
    peaks = []
    for i in np.where((vel[1:-1] > thr) & (vel[1:-1] >= vel[:-2]) & (vel[1:-1] > vel[2:]))[0] + 1:
        if peaks and i - peaks[-1] < 0.25 * fs:
            if vel[i] > vel[peaks[-1]]:
                peaks[-1] = i
        else:
            peaks.append(i)
    out = []
    n = sig.shape[1]
    for p in peaks:
        if p < 0.35 * fs or p > n - 0.6 * fs:
            continue
        lo = p - int(0.1 * fs)
        base = np.median(vel[max(0, p - int(0.3 * fs)):p - int(0.14 * fs)])
        top = vel[p - int(0.03 * fs):p + int(0.03 * fs)].max()
        level = base + 0.12 * (top - base)
        on = p
        while on > lo and vel[on] > level:
            on -= 1
        q_on = on / fs
        q_off = q_on + qrs / 1000
        p_on = q_on - pr / 1000
        t_end = q_on + qt / 1000
        if not np.isfinite(ii[int(p_on * fs)]) or not np.isfinite(ii[min(n - 1, int(t_end * fs))]):
            continue
        # R: the tallest point of lead II inside the QRS
        seg = ii[int(q_on * fs):int(q_off * fs)]
        r = (int(q_on * fs) + int(np.nanargmax(np.abs(seg)))) / fs
        # baseline: just before the P wave
        b0 = int(p_on * fs)
        bl = np.nanmedian(ii[max(0, b0 - int(0.05 * fs)):b0 + 1])
        # end of P: after its peak, where the signal is back within 20 % of its height
        pseg = ii[b0:int((q_on - 0.02) * fs)] - bl
        pk = int(np.nanargmax(np.abs(pseg)))
        amp = abs(pseg[pk])
        j = pk
        while j < len(pseg) - 1 and abs(pseg[j]) > 0.2 * amp:
            j += 1
        p_off = (b0 + j) / fs
        # start of T: walking back from its peak, where the signal comes within 15 % of the
        # T height of the ST level (taken just after the J point)
        st = np.nanmean(ii[int((q_off + 0.02) * fs):int((q_off + 0.06) * fs)])
        s0 = int((q_off + 0.08) * fs)
        s1 = int((t_end - 0.02) * fs)
        tseg = ii[s0:s1] - st
        tp = int(np.nanargmax(np.abs(tseg)))
        j = tp
        while j > 0 and abs(tseg[j]) > 0.15 * abs(tseg[tp]):
            j -= 1
        t_on = max(q_off + 0.04, (s0 + j) / fs)
        out.append({"p_on": p_on, "p_off": p_off, "q_on": q_on, "r": r, "q_off": q_off,
                    "t_on": t_on, "t_peak": (s0 + tp) / fs, "t_end": t_end})
    return out


def marks_for(bs, idx, show, window):
    """Resolve mark names on beat idx (counted from the first complete beat in the window)."""
    inside = [b for b in bs if b["p_on"] >= window[0] and b["t_end"] <= window[1]]
    if idx >= len(inside):
        raise ValueError(f"beat {idx} not in window {window} ({len(inside)} complete beats)")
    b = inside[idx]
    nxt = next((x for x in bs if x["q_on"] > b["q_on"] + 0.2), None)
    out = []
    level = 0
    for name in show:
        if name == "P":
            out.append({"t0": b["p_on"], "t1": b["p_off"], "tone": "p", "label": "P"})
        elif name == "QRS":
            out.append({"t0": b["q_on"], "t1": b["q_off"], "tone": "qrs", "label": "QRS"})
        elif name == "T":
            out.append({"t0": b["t_on"], "t1": b["t_end"], "tone": "t", "label": "T"})
        elif name == "ST":
            out.append({"t0": b["q_off"], "t1": b["t_on"], "tone": "seg", "label": "ST"})
        elif name == "PRseg":
            out.append({"t0": b["p_off"], "t1": b["q_on"], "tone": "seg", "label": "PR"})
        elif name == "TP":
            if not nxt:
                raise ValueError("TP needs a next beat")
            out.append({"t0": b["t_end"], "t1": nxt["p_on"], "tone": "rr", "label": "TP"})
        elif name in BRACKETS:
            if name == "PR":
                a, z = b["p_on"], b["q_on"]
            elif name == "QRSd":
                a, z = b["q_on"], b["q_off"]
            elif name == "QT":
                a, z = b["q_on"], b["t_end"]
            else:
                if not nxt:
                    raise ValueError("RR needs a next beat")
                a, z = b["r"], nxt["r"]
            label = {"QRSd": "QRS"}.get(name, name)
            out.append({"t0": a, "t1": z, "tone": "rr", "label": f"{label} {round((z - a) * 1000)} ms",
                        "bracket": True, "level": level})
            level += 1
        else:
            raise ValueError(f"unknown mark {name}")
    for m in out:
        m["t0"] = round(m["t0"], 3)
        m["t1"] = round(m["t1"], 3)
    return out, b, nxt


def check_text(v, where, problems, kind=str):
    if not isinstance(v, dict) or any(not v.get(l) for l in LANGS):
        problems.append(f"{where}: needs ro and en")
        return
    for l in LANGS:
        if not isinstance(v[l], kind):
            problems.append(f"{where}.{l}: expected {kind.__name__}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plot", help="draw each figure with its marks into this folder")
    ap.add_argument("--content", help="read lessons from this file instead of content/lessons.json")
    ap.add_argument("--dry-run", action="store_true", help="check and plot only; write nothing into app/")
    ap.add_argument("--cases", help="with --dry-run: also know the new_cases of this content fragment "
                    "(monitor strips whose signal files exist), before they are merged and built")
    args = ap.parse_args()
    dry = args.dry_run
    if args.cases and not dry:
        sys.exit("--cases only works with --dry-run")

    src = Path(args.content) if args.content else CONTENT / "lessons.json"
    lessons = json.loads(src.read_text(encoding="utf-8"))
    cases = {c["id"]: c for c in json.loads((CONTENT / "cases.json").read_text(encoding="utf-8"))}
    diagnoses = json.loads((CONTENT / "diagnoses.json").read_text(encoding="utf-8"))
    # built cases (run build_cases.py first): signal keys and sources of MIMIC and monitor cases
    built = {c["id"]: c for c in json.loads((OUT / "cases.json").read_text(encoding="utf-8"))["cases"]}
    frag = json.loads(Path(args.cases).read_text(encoding="utf-8")) if args.cases else {}
    for k, v in frag.get("diagnoses", {}).items():
        diagnoses[k] = {**diagnoses.get(k, {}), **v}
    for c in frag.get("new_cases", []):
        cases[c["id"]] = c
        m = c.get("monitor")
        if m:
            built[c["id"]] = {"id": c["id"], "ecg_id": f"{m['db']}-{m['record']}-{round(m['start'] * 10)}",
                              "layout": "monitor", "source": {"dataset": m["db"], "record": m["record"],
                                                              "start": m["start"], "channel": m.get("channel", 0)}}
    plus = glasgow()
    db = ptbxl.database()
    problems = []
    cache = {}

    def record(step, where):
        if step.get("case"):
            c = cases.get(step["case"])
            if not c:
                problems.append(f"{where}: unknown case {step.get('case')}")
                return None
            if not c.get("ecg_id"):
                # MIMIC-IV-ECG or monitor strip: the signal file written by build_cases.py
                b = built.get(step["case"])
                if not b or step.get("transform"):
                    problems.append(f"{where}: case {step['case']} is not built (or cannot be transformed)")
                    return None
                key = b["ecg_id"]
                if key not in cache:
                    sj = json.loads((OUT / "signals" / f"{key}.json").read_text())
                    sig = np.array([np.frombuffer(base64.b64decode(x), dtype="<i2").astype(float) for x in sj["data"]])
                    sig[sig == -32768] = np.nan
                    cache[key] = {"sig": sig / 1000, "fs": sj["fs"], "beats": [], "leads": sj["leads"],
                                  "source": b["source"], "monitor": b.get("layout") == "monitor",
                                  "pr": None, "qrs": None, "qt": None, "hr": None}
                return key
            ecg_id = c["ecg_id"]
        else:
            ecg_id = step.get("ecg")
        if step.get("transform"):
            key = f"{ecg_id}-{step['transform']}"
            if key not in cache:
                record({"ecg": ecg_id}, where)
                base = cache[ecg_id]
                sig = swap(base["sig"], step["transform"])
                if not dry:
                    (OUT / "signals" / f"{key}.json").write_text(
                        json.dumps(signals.encode(sig, base["fs"], key), separators=(",", ":")))
                cache[key] = dict(base, sig=sig, base=ecg_id)
            return key
        if ecg_id not in cache:
            sig, fs = signals.load_clean(ecg_id)
            dest = OUT / "signals" / f"{ecg_id}.json"
            if not dest.exists() and not dry:
                dest.write_text(json.dumps(signals.encode(sig, fs, ecg_id), separators=(",", ":")))
            u = plus.get(ecg_id) or {}
            num = lambda k: float(u[k]) if u.get(k) not in (None, "", "nan") else None  # noqa: E731
            pr, qrs, qt, hr = num("PR_Int_Global"), num("QRS_Dur_Global"), num("QT_Int_Global"), num("HR__Global")
            bs = beats(sig, fs, pr or 160, qrs or 90, qt or 380) if None not in (pr, qrs, qt) else []
            cache[ecg_id] = {"sig": sig, "fs": fs, "beats": bs, "pr": pr, "qrs": qrs, "qt": qt, "hr": hr}
        return ecg_id

    ids = set()
    out_lessons = []
    plots = []
    for l in lessons:
        lid = l["id"]
        if lid in ids:
            problems.append(f"{lid}: duplicate id")
        ids.add(lid)
        for k in ("title", "summary"):
            check_text(l.get(k), f"{lid}.{k}", problems)
        check_text(l.get("objectives"), f"{lid}.objectives", problems, list)
        for key in l.get("teaches", []):
            if key not in diagnoses:
                problems.append(f"{lid}: teaches unknown diagnosis {key}")
        for tr in TIERS:
            if l.get("tiers", {}).get(tr) not in ("required", "optional", "skip"):
                problems.append(f"{lid}: tiers.{tr} must be required, optional or skip")
        steps = []
        sids = set()
        for i, st in enumerate(l["steps"]):
            st = dict(st)
            st.setdefault("id", f"s{i + 1}")
            where = f"{lid}.{st['id']}"
            if st["id"] in sids:
                problems.append(f"{where}: duplicate step id")
            sids.add(st["id"])
            kind = st.get("type")
            if "only" in st and (not st["only"] or any(x not in TIERS for x in st["only"])):
                problems.append(f"{where}: only must list known tiers")
            for k in ("heading", "caption", "prompt", "question", "explain"):
                if k in st:
                    check_text(st[k], f"{where}.{k}", problems)
            if "body" in st:
                check_text(st["body"], f"{where}.body", problems, list)
            if kind == "diagram":
                if st.get("name") not in DIAGRAMS:
                    problems.append(f"{where}: unknown diagram {st.get('name')}")
            elif kind in ("figure", "task"):
                if st.get("gain", 10) not in (5, 10, 20):
                    problems.append(f"{where}: gain must be 5, 10 or 20 (mm/mV)")
                ecg_id = record(st, where)
                if ecg_id is None:
                    continue
                st.pop("case", None)
                info = cache[ecg_id]
                st["ecg"] = ecg_id
                st["source"] = info.get("source") or {"dataset": "ptbxl", "ecg_id": info.get("base", ecg_id)}
                if info.get("monitor"):
                    st["monitor"] = True
                    st["leads"] = ["MON"]
                    st.pop("layout", None)
                for lead in st.get("leads", []):
                    if lead not in info.get("leads", ptbxl.LEADS):
                        problems.append(f"{where}: no lead {lead} in this recording")
                if st.get("transform"):
                    st["source"]["transform"] = st.pop("transform")
                if st.get("layout") != "standard":
                    st.setdefault("leads", ["II"])
                    st.setdefault("window", [0, 10])
                win = st.get("window", [0, 10])
                try:
                    if kind == "figure":
                        sets = []
                        for s in st.get("sets", []):
                            check_text(s.get("label"), f"{where}.sets.label", problems)
                            if "note" in s:
                                check_text(s["note"], f"{where}.sets.note", problems)
                            if s.get("show"):
                                if not info["beats"]:
                                    raise ValueError("named marks need a PTB-XL ECG; place marks by hand here")
                                marks, _, _ = marks_for(info["beats"], s.get("beat", 0), s["show"], win)
                            else:
                                marks = s.get("marks", [])
                                for m in marks:
                                    if m.get("tone") not in TONES or not isinstance(m.get("label"), str) \
                                            or not (win[0] <= m.get("t0", -1) < m.get("t1", -1) <= win[1]):
                                        problems.append(f"{where}: hand mark {m} needs t0 < t1 inside the window, a tone and a label")
                            sets.append({k: v for k, v in s.items() if k not in ("beat", "show")} | {"marks": marks})
                        st["sets"] = sets
                        plots.append((f"{lid}-{st['id']}", ecg_id, win, [m for s in sets for m in s["marks"]], st.get("leads", ["II"])))
                    else:
                        what = st.get("measure")
                        if what not in TOL:
                            problems.append(f"{where}: measure must be one of {sorted(TOL)}")
                            continue
                        if what in HAND or not info["beats"]:
                            # no computed reference: measured by hand on the tracing
                            if not isinstance(st.get("ref"), (int, float)):
                                problems.append(f"{where}: give ref by hand for {what}")
                            if what == "volt" and len(st.get("leads", [])) != 1:
                                problems.append(f"{where}: a volt task works on one lead")
                            if what not in HAND and len(st.get("init", [])) != 2:
                                problems.append(f"{where}: give init [t0, t1] for the calipers")
                            if what == "rate":
                                st["unit"] = "bpm"
                            st.setdefault("tol", TOL[what])
                            st["marks"] = []
                            steps.append(st)
                            continue
                        _, b, nxt = marks_for(info["beats"], st.get("beat", 0), [], win)
                        if what == "rr":
                            st["ref"] = round((nxt["r"] - b["r"]) * 1000)
                            st["init"] = [round(b["r"] - 0.25, 3), round(b["r"] + 0.3, 3)]
                        elif what == "rate":
                            st["ref"] = round(info["hr"])
                            st["unit"] = "bpm"
                            st["init"] = [round(b["r"] - 0.25, 3), round(b["r"] + 0.3, 3)]
                        else:
                            st["ref"] = round(info[what])
                            st["init"] = [round(b["p_on"] - 0.12, 3), round(b["p_on"] - 0.04, 3)]
                        st.setdefault("tol", TOL[what])
                        st["marks"] = []
                except ValueError as e:
                    problems.append(f"{where}: {e}")
            elif kind == "check":
                opts = st.get("options", [])
                for j, o in enumerate(opts):
                    check_text(o, f"{where}.options[{j}]", problems)
                if not (2 <= len(opts) <= 4) or not (0 <= st.get("answer", -1) < len(opts)):
                    problems.append(f"{where}: 2-4 options and a valid answer index")
            elif kind == "cases":
                for cid in st.get("cases", []):
                    if cid not in cases:
                        problems.append(f"{where}: unknown case {cid}")
            elif kind != "text":
                problems.append(f"{where}: unknown step type {kind}")
            steps.append(st)
        out_lessons.append(dict(l, steps=steps))

    if problems:
        print("Problems:\n  " + "\n  ".join(problems))
        if args.plot:
            plot(Path(args.plot), plots, cache)
        sys.exit(1)
    if dry:
        print(f"checked {len(out_lessons)} lessons: no problems (dry run, nothing written)")
        for l in out_lessons:
            for st in l["steps"]:
                if st.get("type") == "task":
                    print(f"  task {l['id']}.{st['id']}: {st['measure']} reference {st.get('ref')} ± {st.get('tol')}")
        if args.plot:
            plot(Path(args.plot), plots, cache)
        return
    (OUT / "lessons.json").write_text(json.dumps({"version": 1, "lessons": out_lessons}, ensure_ascii=False,
                                                 separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT / 'lessons.json'}: {len(out_lessons)} lessons, ECGs {sorted(cache, key=str)}")
    for eid, info in cache.items():
        b = info["beats"]
        print(f"  ECG {eid}: {len(b)} beats; PR {info['pr']} QRS {info['qrs']} QT {info['qt']} HR {info['hr']}")
    if args.plot:
        plot(Path(args.plot), plots, cache)


def plot(folder, plots, cache):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    folder.mkdir(parents=True, exist_ok=True)
    colors = {"p": "tab:blue", "qrs": "tab:red", "t": "tab:green", "seg": "tab:orange", "rr": "tab:purple"}
    for name, eid, win, marks, leads in plots:
        info = cache[eid]
        sig, fs = info["sig"], info["fs"]
        fig, axes = plt.subplots(len(leads), 1, figsize=(max(8, 4 * (win[1] - win[0])), 3 * len(leads)), squeeze=False)
        t = np.arange(sig.shape[1]) / fs
        m = (t >= win[0]) & (t <= win[1])
        for ax, lead in zip(axes[:, 0], leads):
            x = sig[info.get("leads", ptbxl.LEADS).index(lead)]
            ax.plot(t[m], x[m], "k", lw=1)
            for mk in marks:
                if mk.get("bracket"):
                    y = np.nanmin(x[m]) - 0.1 - 0.12 * mk.get("level", 0)
                    ax.plot([mk["t0"], mk["t1"]], [y, y], color=colors[mk["tone"]], lw=2)
                    ax.text((mk["t0"] + mk["t1"]) / 2, y - 0.06, mk["label"], ha="center", va="top", fontsize=8)
                else:
                    ax.axvspan(mk["t0"], mk["t1"], color=colors[mk["tone"]], alpha=0.18)
                    ax.text((mk["t0"] + mk["t1"]) / 2, np.nanmax(x[m]) + 0.05, mk["label"], ha="center", fontsize=8)
            ax.set_xticks(np.arange(win[0], win[1], 0.04), minor=True)
            ax.set_xticks(np.arange(win[0], win[1] + 1e-6, 0.2))
            ax.grid(which="minor", color="#f4c7c3", lw=0.4)
            ax.grid(which="major", color="#e57373", lw=0.8)
            ax.set_xlim(*win)
            ax.set_title(f"{name} · {eid} · {lead}", fontsize=9)
        fig.tight_layout()
        fig.savefig(folder / f"{name}.png", dpi=100)
        plt.close(fig)
    print(f"plots in {folder}")


if __name__ == "__main__":
    main()
