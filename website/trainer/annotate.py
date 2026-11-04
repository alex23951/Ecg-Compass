#!/usr/bin/env python3
"""Teaching marks drawn on real ECGs: arrows, labels, brackets, boxes, baselines.

The content says what to point at; this module finds it on the tracing that is drawn
(the filtered signal file in app/data/signals/), so an arrow lands on the wave itself.

    python3 trainer/annotate.py --cases FRAGMENT.json --out DIR
        resolve the annotations of a fragment {case_id: [annotation, ...]} against the
        built cases (run build_cases.py first) and write DIR/resolved.json for
        trainer/authoring/render.mjs. Writes nothing into app/.

Content form of one annotation (hand-written):

    {"kind": "arrow", "lead": "III", "at": "J", "label": {"ro": "...", "en": "..."}}

    kind      arrow  an arrow pointing at a point of the trace, label at its tail
              dot    a ring around a point of the trace, label beside it
              bracket  a horizontal interval with end ticks (PR, QRS, QT, RR ...)
              rise   a vertical double arrow from the baseline to the trace (ST in mm, R height)
              baseline a dashed horizontal line (the isoelectric line), optional label
              box    a rounded frame around a stretch of trace (a P wave, a QRS, a pause)
              count  numbered circles over every QRS of a strip (1, 2, 3 ...)
              tag    a badge in the corner of a lead's cell ("ST ↑")
              vline  a dashed vertical line across the lead's cell (or every row of a strip)
    lead      the lead (I, II, III, aVR, aVL, aVF, V1-V6; MON on a monitor strip)
    rhythm    true: draw on the full-length rhythm strip under the 12-lead grid (lead must be one
              of the case's strips) instead of the lead's own 2.5 s cell
    label     {"ro", "en"} or a plain string for language-neutral labels ("P", "R'", "QRS")
              Keep it short: 1-4 words.
    finding   (cases) index of the finding (0 = first bullet) this mark illustrates
    dir       where the label sits from the point: n ne e se s sw w nw (default: away from
              the baseline)
    len       arrow length factor (default 1 = 34 px on screen; 0.6 to 2.5)

Where (any kind that needs a time):
    at        a named point of one beat, found on the recording (PTB-XL ECGs only):
              Pon, P (P peak in this lead), Poff, QRSon, Q, R, S, QRS (largest QRS deflection
              in this lead), J (end of QRS), ST (J + 60 ms), T (T peak in this lead), Tend
    beat      which complete beat: 0 = the first complete beat visible in this lead's cell
              (or in the strip window). Default 0.
    t         instead of at: a time in seconds, read off the tracing (any recording)
    snap      with t: max | min | abs moves t to the highest, lowest or largest point within
              ±40 ms (±12 ms for "spike"): use it to hit an R peak or a pacing spike
    v         a voltage in mV; by default the trace's own value at t

    bracket   from + to (named points, "to_beat" for another beat, e.g. R to R of beat 1) or
              t0 + t1; side below (default) | above; "ms": true appends the duration
    rise      at/t; from the beat's baseline (PR segment) unless "v0"; "mm": true appends the
              height in mm
    baseline  beat (PR segment level, across that beat) or t0 + t1 + v
    box       around P | QRS | T | PR | ST | beat (or t0 + t1); padded to the trace
    count     no position needed: every QRS in the cell; or "times": [t, ...]
    vline     at/t; optional label

Built form: the same objects with explicit seconds and millivolts (t, v, t0, t1, v0, v1,
times, vs), so the browser only draws.
"""
import argparse
import base64
import json
import re
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEBSITE = HERE.parent
OUT = WEBSITE / "app" / "data"
sys.path.insert(0, str(HERE))

KINDS = {"arrow", "dot", "bracket", "rise", "baseline", "box", "count", "tag", "vline"}
DIRS = {"n", "ne", "e", "se", "s", "sw", "w", "nw"}
AT = {"Pon", "P", "Poff", "QRSon", "Q", "R", "S", "QRS", "J", "ST", "T", "Tend"}
AROUND = {"P", "QRS", "T", "PR", "ST", "beat"}
COLS = [["I", "II", "III"], ["aVR", "aVL", "aVF"], ["V1", "V2", "V3"], ["V4", "V5", "V6"]]
LANGS = ("ro", "en")
MAX_LABEL = 34
KEYS = {"kind", "lead", "rhythm", "label", "finding", "dir", "len", "at", "beat", "t", "snap", "v",
        "from", "to", "to_beat", "t0", "t1", "side", "ms", "mm", "v0", "v1", "around", "times", "note"}


class Recording:
    """The drawn signal of one ECG (as stored for the browser) and its beats."""

    def __init__(self, key, folder=None):
        self.key = str(key)
        path = None
        for base in ([Path(folder)] if folder else []) + [OUT / "signals"]:
            p = base / f"{self.key}.json"
            if p.exists():
                path = p
                break
        if path is None:
            raise ValueError(f"no signal file for {self.key} (run build_cases.py / build_lessons.py)")
        sj = json.loads(path.read_text())
        sig = np.array([np.frombuffer(base64.b64decode(x), dtype="<i2").astype(float) for x in sj["data"]])
        sig[sig == -32768] = np.nan
        self.sig = sig / 1000
        self.fs = sj["fs"]
        self.n = sj["n"]
        self.leads = sj["leads"]
        self.dur = min(10, self.n / self.fs)
        self.beats = []
        self.peaks = None

    def lead(self, name):
        if name not in self.leads:
            raise ValueError(f"no lead {name} in this recording")
        return self.sig[self.leads.index(name)]

    def at(self, name, t):
        x = self.lead(name)
        i = int(round(t * self.fs))
        i = min(max(i, 0), len(x) - 1)
        return float(x[i])

    def qrs_peaks(self):
        """Times of every QRS complex (spatial velocity of all leads), edges included."""
        if self.peaks is None:
            sig = np.nan_to_num(self.sig)
            vel = np.sum(np.abs(np.diff(sig, axis=1)), axis=0)
            k = max(1, int(0.01 * self.fs))
            vel = np.convolve(vel, np.ones(k) / k, mode="same")
            thr = 0.4 * np.percentile(vel, 99.5)
            peaks = []
            for i in np.where((vel[1:-1] > thr) & (vel[1:-1] >= vel[:-2]) & (vel[1:-1] > vel[2:]))[0] + 1:
                if peaks and i - peaks[-1] < 0.25 * self.fs:
                    if vel[i] > vel[peaks[-1]]:
                        peaks[-1] = i
                else:
                    peaks.append(i)
            self.peaks = [p / self.fs for p in peaks]
        return self.peaks


@lru_cache(maxsize=1)
def _glasgow():
    from build_lessons import glasgow
    return glasgow()


def load(key, folder=None):
    """A Recording with PTB-XL beats when the PTB-XL+ measurements exist."""
    rec = Recording(key, folder)
    base = str(key).split("-")[0]
    if base.isdigit() and rec.leads[:2] == ["I", "II"] and len(rec.leads) == 12:
        from build_lessons import beats
        u = _glasgow().get(int(base)) or {}
        try:
            pr, qrs, qt = (float(u[k]) for k in ("PR_Int_Global", "QRS_Dur_Global", "QT_Int_Global"))
        except (KeyError, TypeError, ValueError):
            pr = qrs = qt = None
        if None not in (pr, qrs, qt) and all(np.isfinite([pr, qrs, qt])):
            rec.beats = beats(rec.sig, rec.fs, pr, qrs, qt)
    return rec


def cell(rec, lead, rhythm, layout, strips, window):
    """The time span (s) in which this lead is drawn."""
    if layout == "standard":
        if rhythm:
            if lead not in strips:
                raise ValueError(f"rhythm strip {lead} is not one of the strips {strips}")
            return 0.0, rec.dur
        for c, col in enumerate(COLS):
            if lead in col:
                return c * rec.dur / 4, (c + 1) * rec.dur / 4
        raise ValueError(f"lead {lead} is not in the 12-lead grid")
    w0, w1 = window or (0, rec.dur)
    return float(w0), float(min(w1, rec.dur))


def pick_beat(rec, span, idx):
    a, b = span
    inside = [x for x in rec.beats if x["p_on"] >= a - 1e-6 and x["t_end"] <= b + 1e-6]
    if idx < len(inside):
        return inside[idx]
    # no complete beat: one whose QRS is well inside (fine for R, J and ST points)
    part = [x for x in rec.beats if a + 0.05 <= x["q_on"] and x["q_off"] <= b - 0.05]
    if not inside and idx < len(part):
        return part[idx]
    raise ValueError(f"beat {idx} is not in {a:.2f}-{b:.2f} s ({len(inside)} complete beats)")


def baseline(rec, lead, b):
    x = rec.lead(lead)
    i0, i1 = int(b["p_off"] * rec.fs), int(b["q_on"] * rec.fs)
    if i1 - i0 < int(0.02 * rec.fs):
        i0, i1 = int((b["p_on"] - 0.04) * rec.fs), int(b["p_on"] * rec.fs)
    return float(np.nanmedian(x[max(0, i0):i1 + 1]))


def point(rec, lead, b, name):
    """Time (s) of a named point of beat b in this lead."""
    x = rec.lead(lead)
    fs = rec.fs
    base = baseline(rec, lead, b)

    def arg(t0, t1, how):
        i0, i1 = int(t0 * fs), max(int(t0 * fs) + 1, int(t1 * fs))
        seg = x[i0:i1]
        if how == "max":
            k = np.nanargmax(seg)
        elif how == "min":
            k = np.nanargmin(seg)
        else:
            k = np.nanargmax(np.abs(seg - base))
        return (i0 + int(k)) / fs

    if name == "Pon":
        return b["p_on"]
    if name == "Poff":
        return b["p_off"]
    if name == "QRSon":
        return b["q_on"]
    if name == "J":
        return b["q_off"]
    if name == "Tend":
        return b["t_end"]
    if name == "ST":
        return min(b["q_off"] + 0.06, b["t_end"] - 0.02)
    if name == "P":
        return arg(b["p_on"], b["p_off"], "abs")
    if name == "R":
        return arg(b["q_on"], b["q_off"], "max")
    if name == "QRS":
        return arg(b["q_on"], b["q_off"], "abs")
    if name == "S":
        return arg(point(rec, lead, b, "R"), b["q_off"], "min")
    if name == "Q":
        return arg(b["q_on"], max(point(rec, lead, b, "R"), b["q_on"] + 0.012), "min")
    if name == "T":
        return arg(b["t_on"], b["t_end"], "abs")
    raise ValueError(f"unknown point {name}")


def snap(rec, lead, t, how, wide=0.04):
    x = rec.lead(lead)
    fs = rec.fs
    i0, i1 = max(0, int((t - wide) * fs)), min(len(x), int((t + wide) * fs) + 1)
    seg = x[i0:i1]
    if how == "max":
        k = np.nanargmax(seg)
    elif how == "min":
        k = np.nanargmin(seg)
    elif how == "abs":
        k = np.nanargmax(np.abs(seg - np.nanmedian(seg)))
    else:
        raise ValueError(f"snap must be max, min or abs, not {how}")
    return (i0 + int(k)) / fs


def check_label(label, where, problems, need=True):
    if label is None:
        if need:
            problems.append(f"{where}: needs a label")
        return
    if isinstance(label, str):
        if not label.strip():
            problems.append(f"{where}: empty label")
        elif len(label) > MAX_LABEL:
            problems.append(f"{where}: label longer than {MAX_LABEL} characters")
        return
    if not isinstance(label, dict) or any(not isinstance(label.get(l), str) or not label[l].strip() for l in LANGS):
        problems.append(f"{where}: label needs ro and en (or one plain string)")
        return
    for l in LANGS:
        if len(label[l]) > MAX_LABEL:
            problems.append(f"{where}: label.{l} longer than {MAX_LABEL} characters: {label[l]!r}")
        if l == "ro" and re.search(r"\d\.\d", label[l]):
            problems.append(f"{where}: Romanian label uses a decimal point, use a comma: {label[l]!r}")


def fmt_num(v, lang):
    s = f"{v:.1f}".rstrip("0").rstrip(".") if abs(v - round(v)) > 1e-9 else str(int(round(v)))
    return s.replace(".", ",") if lang == "ro" else s


def append(label, extra):
    """Add a measured value to a label ({ro, en} or plain)."""
    if label is None:
        return {l: extra[l] for l in LANGS}
    if isinstance(label, str):
        return {l: f"{label} {extra[l]}" for l in LANGS}
    return {l: f"{label[l]} {extra[l]}" for l in LANGS}


def resolve_one(a, rec, layout, strips, window, where, problems, findings=0):
    kind = a.get("kind")
    if kind not in KINDS:
        problems.append(f"{where}: kind must be one of {sorted(KINDS)}")
        return None
    unknown = set(a) - KEYS
    if unknown:
        problems.append(f"{where}: unknown keys {sorted(unknown)}")
    lead = a.get("lead")
    rhythm = bool(a.get("rhythm"))
    out = {"kind": kind}
    if lead is None and kind != "vline":
        problems.append(f"{where}: needs a lead")
        return None
    if lead is not None:
        if lead not in rec.leads:
            problems.append(f"{where}: no lead {lead} in this recording")
            return None
        out["lead"] = lead
    if rhythm:
        out["rhythm"] = True
    if "finding" in a:
        if not isinstance(a["finding"], int) or not 0 <= a["finding"] < max(findings, 0) or isinstance(a["finding"], bool):
            problems.append(f"{where}: finding must be the index of one of the {findings} findings")
        else:
            out["finding"] = a["finding"]
    if "dir" in a:
        if a["dir"] not in DIRS:
            problems.append(f"{where}: dir must be one of {sorted(DIRS)}")
        else:
            out["dir"] = a["dir"]
    if "len" in a:
        if not isinstance(a["len"], (int, float)) or not 0.4 <= a["len"] <= 3:
            problems.append(f"{where}: len must be between 0.4 and 3")
        else:
            out["len"] = a["len"]
    need_label = (kind in ("arrow", "dot", "tag", "box") or (kind == "bracket" and not a.get("ms"))
                  or (kind == "rise" and not a.get("mm")))
    check_label(a.get("label"), where, problems, need_label)
    if a.get("label") is not None:
        out["label"] = a["label"]

    try:
        if lead is not None:
            span = cell(rec, lead, rhythm, layout, strips, window)
        else:
            span = (0.0, rec.dur) if layout == "standard" else cell(rec, None, False, layout, strips, window)

        def beat(k="beat"):
            if not rec.beats:
                raise ValueError("named points need a PTB-XL ECG with measurements: give t (seconds) instead")
            return pick_beat(rec, span, int(a.get(k, a.get("beat", 0)) or 0))

        def when(name_key="at", t_key="t", snap_ok=True):
            if a.get(name_key) is not None:
                if a[name_key] not in AT:
                    raise ValueError(f"{name_key} must be one of {sorted(AT)}")
                b = beat()
                return point(rec, lead, b, a[name_key]), b
            if not isinstance(a.get(t_key), (int, float)):
                raise ValueError(f"needs {name_key} (a named point) or {t_key} (seconds)")
            t = float(a[t_key])
            if snap_ok and a.get("snap"):
                t = snap(rec, lead, t, a["snap"])
            return t, None

        def inside(t, what="time"):
            if not span[0] - 1e-6 <= t <= span[1] + 1e-6:
                raise ValueError(f"{what} {t:.3f} s is outside the visible {span[0]:.2f}-{span[1]:.2f} s of {lead}"
                                 + ("" if rhythm or layout != "standard" else " (use rhythm: true for the strip)"))
            return round(t, 3)

        if kind in ("arrow", "dot"):
            t, b = when()
            out["t"] = inside(t)
            v = float(a["v"]) if isinstance(a.get("v"), (int, float)) else rec.at(lead, t)
            if not np.isfinite(v):
                raise ValueError(f"the trace is blank at {t:.3f} s")
            out["v"] = round(v, 3)
            if "dir" not in out:
                x = rec.lead(lead)
                ref = baseline(rec, lead, b) if b else float(np.nanmedian(x[int(span[0] * rec.fs):int(span[1] * rec.fs)]))
                out["dir"] = "n" if v >= ref else "s"
        elif kind == "bracket":
            if a.get("from") is not None:
                if a["from"] not in AT or a.get("to") not in AT:
                    raise ValueError(f"from and to must be named points {sorted(AT)}")
                b0 = beat()
                b1 = beat("to_beat") if "to_beat" in a else b0
                t0, t1 = point(rec, lead, b0, a["from"]), point(rec, lead, b1, a["to"])
            else:
                t0, t1 = float(a["t0"]), float(a["t1"])
            if t1 <= t0:
                raise ValueError("bracket ends before it starts")
            out["t0"], out["t1"] = inside(t0, "start"), inside(t1, "end")
            side = a.get("side", "below")
            if side not in ("below", "above"):
                raise ValueError("side must be below or above")
            x = rec.lead(lead)
            seg = x[int(max(span[0], t0 - 0.06) * rec.fs):int(min(span[1], t1 + 0.06) * rec.fs) + 1]
            out["side"] = side
            out["v"] = round(float(a["v"]) if isinstance(a.get("v"), (int, float))
                             else float(np.nanmin(seg)) - 0.12 if side == "below" else float(np.nanmax(seg)) + 0.12, 3)
            if a.get("ms"):
                ms = round((t1 - t0) * 1000)
                out["label"] = append(a.get("label"), {"ro": f"{ms} ms", "en": f"{ms} ms"})
                out["ms"] = ms
        elif kind == "rise":
            t, b = when()
            out["t"] = inside(t)
            v1 = float(a["v1"]) if isinstance(a.get("v1"), (int, float)) else rec.at(lead, t)
            if isinstance(a.get("v0"), (int, float)):
                v0 = float(a["v0"])
            elif b:
                v0 = baseline(rec, lead, b)
            else:
                raise ValueError("rise without a named point needs v0 (the baseline in mV)")
            out["v0"], out["v1"] = round(v0, 3), round(v1, 3)
            mm = abs(v1 - v0) * 10
            out["mm"] = round(mm * 2) / 2
            if a.get("mm"):
                out["label"] = append(a.get("label"), {l: f"{fmt_num(round(mm * 2) / 2, l)} mm" for l in LANGS})
        elif kind == "baseline":
            if isinstance(a.get("t0"), (int, float)):
                t0, t1 = float(a["t0"]), float(a["t1"])
                if not isinstance(a.get("v"), (int, float)):
                    raise ValueError("a hand-placed baseline needs t0, t1 and v")
                v = float(a["v"])
            else:
                b = beat()
                t0, t1 = b["p_on"] - 0.06, b["t_end"] + 0.06
                v = baseline(rec, lead, b)
            out["t0"], out["t1"] = round(max(span[0], t0), 3), round(min(span[1], t1), 3)
            out["v"] = round(v, 3)
        elif kind == "box":
            around = a.get("around")
            if around is not None:
                if around not in AROUND:
                    raise ValueError(f"around must be one of {sorted(AROUND)}")
                b = beat()
                t0, t1 = {
                    "P": (b["p_on"], b["p_off"]), "QRS": (b["q_on"], b["q_off"]), "T": (b["t_on"], b["t_end"]),
                    "PR": (b["p_on"], b["q_on"]), "ST": (b["q_off"], b["t_on"]), "beat": (b["p_on"], b["t_end"]),
                }[around]
                t0, t1 = t0 - 0.015, t1 + 0.015
            else:
                t0, t1 = float(a["t0"]), float(a["t1"])
            if t1 <= t0:
                raise ValueError("box ends before it starts")
            out["t0"], out["t1"] = inside(t0, "start"), inside(t1, "end")
            x = rec.lead(lead)
            seg = x[int(t0 * rec.fs):int(t1 * rec.fs) + 1]
            lo = float(a["v0"]) if isinstance(a.get("v0"), (int, float)) else float(np.nanmin(seg)) - 0.08
            hi = float(a["v1"]) if isinstance(a.get("v1"), (int, float)) else float(np.nanmax(seg)) + 0.08
            out["v0"], out["v1"] = round(lo, 3), round(hi, 3)
        elif kind == "count":
            if isinstance(a.get("times"), list):
                times = [float(t) for t in a["times"]]
            else:
                times = [p for p in rec.qrs_peaks() if span[0] + 0.02 <= p <= span[1] - 0.02]
            times = [snap(rec, lead, t, "abs", 0.05) for t in times]
            out["times"] = [inside(t) for t in times]
            out["vs"] = [round(rec.at(lead, t), 3) for t in times]
        elif kind == "tag":
            pass
        elif kind == "vline":
            if lead is None:
                if not isinstance(a.get("t"), (int, float)):
                    raise ValueError("a vline across every row needs t (seconds)")
                t = float(a["t"])
            else:
                t, _ = when()
            out["t"] = inside(t)
    except (ValueError, KeyError, TypeError) as e:
        problems.append(f"{where}: {e}")
        return None
    return out


def resolve(anns, rec, where, problems, layout="standard", strips=("II",), window=None, findings=0):
    if not isinstance(anns, list):
        problems.append(f"{where}: annotations must be a list")
        return []
    out = []
    for i, a in enumerate(anns):
        r = resolve_one(a, rec, layout, list(strips or ["II"]), window, f"{where}[{i}]", problems, findings)
        if r:
            out.append(r)
    return out


def resolve_case(case, anns, problems, folder=None):
    """Annotations of a built case (12-lead grid, or the monitor strip)."""
    rec = load(case["ecg_id"], folder)
    monitor = case.get("layout") == "monitor"
    n = min(len(case.get("findings", {}).get(l, [])) for l in LANGS) if case.get("findings") else 0
    return resolve(anns, rec, case["id"], problems, layout="strip" if monitor else "standard",
                   strips=case.get("strips") or ["II"], window=None, findings=n)


def main():
    ap = argparse.ArgumentParser(description="Resolve case annotations against the built cases")
    ap.add_argument("--cases", required=True, help="JSON {case_id: [annotation, ...]}")
    ap.add_argument("--out", required=True, help="folder for resolved.json")
    args = ap.parse_args()
    frag = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    built = {c["id"]: c for c in json.loads((OUT / "cases.json").read_text(encoding="utf-8"))["cases"]}
    problems = []
    resolved = {}
    for cid, anns in frag.items():
        if cid.startswith("_"):
            continue
        c = built.get(cid)
        if not c:
            problems.append(f"{cid}: unknown case")
            continue
        resolved[cid] = resolve_case(c, anns, problems)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "resolved.json").write_text(json.dumps(resolved, ensure_ascii=False, indent=1), encoding="utf-8")
    for cid, anns in resolved.items():
        for a in anns:
            extra = {k: a[k] for k in ("t", "t0", "t1", "v", "v0", "v1", "mm", "ms") if k in a}
            print(f"  {cid} {a['kind']:<8} {a.get('lead', ''):<4}{' (strip)' if a.get('rhythm') else ''} {extra}")
    if problems:
        print("Problems:\n  " + "\n  ".join(problems))
        sys.exit(1)
    print(f"resolved {sum(len(v) for v in resolved.values())} annotations on {len(resolved)} cases: {out / 'resolved.json'}")


if __name__ == "__main__":
    main()
