"""Screen MIMIC-IV-ECG paced records for real malfunctions by signal: spikes with no
capture (outside the refractory period) and spikes too soon after a native QRS."""
import concurrent.futures as cf
import csv
import json
import random
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, "/mnt/project-files/website/tools")
import mimic  # noqa: E402

OUT = Path(__file__).parent / "malf_candidates.json"
WANT = ("Pacemaker spikes or artifacts", "Interpretation is based on unpaced beats",
        "Afib/flut and V-paced complexes", "Ventricular-paced complexes", "Atrial-paced complexes",
        "dual-paced complexes", "ineffective stimuli", "A-noncapt", "with some inhibition",
        "Atrial-sensed ventricular-paced complexes")


def rows():
    seen = set()
    with open(mimic.CACHE / "machine_measurements.csv", newline="") as f:
        for r in csv.DictReader(f):
            rep = " | ".join(x for x in ((r.get(f"report_{i}") or "").strip() for i in range(18)) if x)
            if any(w.lower() in rep.lower() for w in WANT) and r["subject_id"] not in seen:
                seen.add(r["subject_id"])
                s = r["subject_id"]
                yield {"subject_id": s, "study_id": r["study_id"], "report": rep,
                       "path": f"files/p{s[:4]}/p{s}/s{r['study_id']}/{r['study_id']}"}


def analyse(path):
    sig, fs = mimic.read_signal(path)
    x = np.nan_to_num(sig)
    # spikes: narrow deflections, |x[t] - mean(x[t-3], x[t+3])| large in some lead
    k = 3
    sharp = np.abs(x[:, k:-k] - (x[:, :-2 * k] + x[:, 2 * k:]) / 2).max(axis=0)
    sharp = np.pad(sharp, (k, k))
    thr = max(0.35, 6 * np.median(sharp) + 0.15)
    cand = np.nonzero(sharp > thr)[0]
    spikes = []
    for c in cand:
        if spikes and c - spikes[-1] < int(0.03 * fs):
            continue
        spikes.append(int(c))
    # QRS energy with spikes blanked
    y = x.copy()
    for s in spikes:
        a, b = max(0, s - 4), min(y.shape[1] - 1, s + 6)
        y[:, a:b] = np.linspace(y[:, a], y[:, b], b - a, axis=1)
    e = np.abs(np.diff(y, axis=1)).sum(axis=0)
    w = int(0.04 * fs)
    e = np.convolve(e, np.ones(w) / w, "same")
    qthr = 0.4 * np.percentile(e, 99)
    peaks = []
    for t in range(1, len(e) - 1):
        if e[t] > qthr and e[t] >= e[t - 1] and e[t] >= e[t + 1]:
            if peaks and t - peaks[-1] < int(0.25 * fs):
                if e[t] > e[peaks[-1]]:
                    peaks[-1] = t
            else:
                peaks.append(t)
    peaks = np.array(peaks)
    events = []
    n = x.shape[1]
    for i, s in enumerate(spikes):
        if s < 0.1 * fs or s > n - 0.5 * fs:
            continue
        after = peaks[(peaks > s) & (peaks <= s + int(0.25 * fs))]
        before = peaks[(peaks < s) & (peaks >= s - int(0.45 * fs))]
        next_spike = [t for t in spikes[i + 1:] if t - s < int(0.35 * fs)]
        prev_spike = [t for t in spikes[:i] if s - t < int(0.35 * fs)]
        if len(after) == 0 and len(before) == 0 and not next_spike:
            events.append(("no_capture", round(s / fs, 2)))
        elif len(before) and not prev_spike:
            gap = (s - before[-1]) / fs
            # was the QRS before it native (no spike shortly before that QRS)?
            q = before[-1]
            paced_q = any(0 < q - t < int(0.25 * fs) for t in spikes)
            if not paced_q and 0.12 <= gap <= 0.45 and len(after) == 0:
                events.append(("spike_after_native", round(s / fs, 2), round(gap, 2)))
    return {"spikes": len(spikes), "qrs": len(peaks), "events": events}


def work(r):
    for attempt in range(5):
        try:
            r.update(analyse(r["path"]))
            return r
        except Exception as e:  # noqa: BLE001
            r["err"] = str(e)[:80]
            time.sleep(2 * 2 ** attempt)
    return r


def main():
    rs = list(rows())
    random.seed(3)
    random.shuffle(rs)
    rs = rs[:int(sys.argv[1]) if len(sys.argv) > 1 else 900]
    print(len(rs), "records")
    with cf.ThreadPoolExecutor(3) as ex:
        done = list(ex.map(work, rs))
    OUT.write_text(json.dumps(done, indent=0))
    hits = [r for r in done if r.get("events")]
    print("with events:", len(hits), "errors:", sum(1 for r in done if r.get("err") and "events" not in r))


if __name__ == "__main__":
    main()
