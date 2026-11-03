"""Screen MIMIC-IV-ECG for paced ECGs useful for the pacing module.

Step 1 (csv): find studies whose machine read mentions pacing, with QRS width and axis.
Step 2 (signals): download candidate waveforms and measure the paced QRS polarity in I and V1.
Writes mimic_candidates.json.
"""
import concurrent.futures as cf
import csv
import json
import random
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from render import mimic_fetch, read_wfdb  # noqa: E402

CSV = "/mnt/project-files/website/cache/mimic-iv-ecg/machine_measurements.csv"
OUT = Path(__file__).parent / "mimic_candidates.json"

PACED = re.compile(r"pac(ed|ing|emaker)", re.I)
VENT = re.compile(r"ventricular pacing|ventricular-paced|v-paced|a-v sequential|dual-paced|av sequential|"
                  r"dual chamber|pacemaker rhythm|demand pacing(?! atrial)|- demand ventricular", re.I)
MALF = re.compile(r"ineffective|non-?capt|failure|undersens|oversens|malfunction|no capture|loss of capture", re.I)
WANDER = re.compile(r"wandering", re.I)


def num(r, k):
    try:
        v = float(r[k])
    except (TypeError, ValueError):
        return None
    return None if v >= 29999 else v


def step1():
    rows = []
    with open(CSV, newline="") as f:
        for r in csv.DictReader(f):
            reps = [(r.get(f"report_{i}") or "").strip() for i in range(18)]
            reps = [x for x in reps if x]
            text = " | ".join(reps)
            if not PACED.search(text) or WANDER.search(text) and not VENT.search(text):
                continue
            qon, qoff = num(r, "qrs_onset"), num(r, "qrs_end")
            rows.append({
                "subject_id": r["subject_id"], "study_id": r["study_id"], "time": r["ecg_time"],
                "report": text, "qrs": (qoff - qon) if qon is not None and qoff is not None else None,
                "axis": num(r, "qrs_axis"), "rr": num(r, "rr_interval"),
                "vent": bool(VENT.search(text)), "malf": bool(MALF.search(text)),
            })
    return rows


def path_of(r):
    s = r["subject_id"]
    return f"files/p{s[:4]}/p{s}/s{r['study_id']}/{r['study_id']}"


def polarity(rel):
    """Median net QRS area (mV*ms) in I and V1 and the QRS width estimate, over detected beats."""
    hea, dat = mimic_fetch(rel)
    sig, fs = read_wfdb(hea, dat)
    sig = np.nan_to_num(sig)
    x = sig - np.median(sig, axis=1, keepdims=True)
    energy = np.abs(np.diff(x, axis=1)).sum(axis=0)
    w = max(1, int(0.04 * fs))
    energy = np.convolve(energy, np.ones(w) / w, "same")
    thr = 0.35 * np.percentile(energy, 99.5)
    peaks = []
    for k in range(1, len(energy) - 1):
        if energy[k] > thr and energy[k] >= energy[k - 1] and energy[k] >= energy[k + 1]:
            if peaks and k - peaks[-1] < 0.3 * fs:
                if energy[k] > energy[peaks[-1]]:
                    peaks[-1] = k
            else:
                peaks.append(k)
    half = int(0.08 * fs)
    nets = []
    for p in peaks:
        a, b = p - half, p + half
        if a < 0 or b >= x.shape[1]:
            continue
        seg = x[:, a:b] - x[:, a:a + 1]
        nets.append(seg.sum(axis=1) / fs * 1000)
    if not nets:
        return None
    med = np.median(np.array(nets), axis=0)
    lead = {n: i for i, n in enumerate(["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"])}
    return {"I": round(float(med[lead["I"]]), 1), "V1": round(float(med[lead["V1"]]), 1),
            "aVF": round(float(med[lead["aVF"]]), 1), "II": round(float(med[lead["II"]]), 1),
            "beats": len(nets)}


def classify(r):
    ax, q = r["axis"], r["qrs"]
    if ax is None or q is None:
        return "unknown"
    right = ax > 90 or ax < -90
    if right and q <= 170:
        return "biv?"
    if right:
        return "lv?"
    if q < 125:
        return "narrow?"
    if -90 <= ax <= -30:
        return "rv_apex?"
    if 45 <= ax <= 110:
        return "rv_septal?"
    return "other"


def main():
    rows = step1()
    print(len(rows), "paced studies;", sum(r["vent"] for r in rows), "ventricular;", sum(r["malf"] for r in rows), "malfunction words")
    for r in rows:
        r["guess"] = classify(r) if r["vent"] else "atrial/other"
    from collections import Counter
    print(Counter(r["guess"] for r in rows))
    random.seed(11)
    pick = []
    quota = {"biv?": 140, "lv?": 50, "narrow?": 60, "rv_apex?": 30, "rv_septal?": 30, "atrial/other": 20, "other": 10}
    for g, n in quota.items():
        pool = [r for r in rows if r["guess"] == g and not r["malf"]]
        # one study per patient
        seen, uniq = set(), []
        random.shuffle(pool)
        for r in pool:
            if r["subject_id"] not in seen:
                seen.add(r["subject_id"])
                uniq.append(r)
        pick += uniq[:n]
    malf = [r for r in rows if r["malf"]]
    random.shuffle(malf)
    pick += malf[:40]
    print(len(pick), "to download")

    def work(r):
        try:
            r["pol"] = polarity(path_of(r))
        except Exception as e:  # noqa: BLE001
            r["pol"] = None
            r["err"] = str(e)[:100]
        r["path"] = path_of(r)
        return r

    with cf.ThreadPoolExecutor(8) as ex:
        done = list(ex.map(work, pick))
    OUT.write_text(json.dumps(done, indent=0))
    print("errors:", sum(1 for r in done if r.get("err")))


if __name__ == "__main__":
    main()
