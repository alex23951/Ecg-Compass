"""Stricter second pass over the malfunction screen's hits (cached signals only).
A dropped spike: no QRS within 450 ms either side and no other spike within 350 ms
(so an atrial spike with a long AV conduction or an A-V pair does not count)."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, "/mnt/project-files/website/tools")
import mimic  # noqa: E402

HERE = Path(__file__).parent


def detect(path):
    sig, fs = mimic.read_signal(path)
    x = np.nan_to_num(sig)
    k = 3
    sharp = np.abs(x[:, k:-k] - (x[:, :-2 * k] + x[:, 2 * k:]) / 2).max(axis=0)
    sharp = np.pad(sharp, (k, k))
    thr = max(0.35, 6 * np.median(sharp) + 0.15)
    spikes = []
    for c in np.nonzero(sharp > thr)[0]:
        if spikes and c - spikes[-1] < int(0.03 * fs):
            continue
        spikes.append(int(c))
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
    return np.array(spikes), np.array(peaks), fs, x.shape[1]


def events(path):
    spikes, peaks, fs, n = detect(path)
    out = []
    for i, s in enumerate(spikes):
        if s < 0.5 * fs or s > n - 0.6 * fs:
            continue
        near_q = peaks[(peaks > s - 0.45 * fs) & (peaks < s + 0.45 * fs)]
        near_s = spikes[(np.abs(spikes - s) < 0.35 * fs) & (spikes != s)]
        if len(near_q) == 0 and len(near_s) == 0:
            nxt = peaks[peaks > s]
            out.append({"t": round(s / fs, 2), "next_qrs": round((nxt[0] - s) / fs, 2) if len(nxt) else None})
    rr = np.diff(peaks) / fs if len(peaks) > 1 else np.array([0])
    return {"dropped": out, "n_spikes": int(len(spikes)), "n_qrs": int(len(peaks)),
            "max_rr": round(float(rr.max()), 2), "median_rr": round(float(np.median(rr)), 2)}


def main():
    hits = [r for r in json.loads((HERE / "malf_candidates.json").read_text()) if r.get("events")]
    res = []
    for r in hits:
        try:
            r2 = events(r["path"])
        except Exception as ex:  # noqa: BLE001
            print("err", r["study_id"], ex)
            continue
        if r2["dropped"] and r2["n_qrs"] >= 5:
            res.append({**{k: r[k] for k in ("study_id", "path", "report")}, **r2})
    res.sort(key=lambda r: (-len(r["dropped"]), -r["max_rr"]))
    (HERE / "malf_strict.json").write_text(json.dumps(res, indent=0))
    print(len(res), "records with dropped spikes")
    for r in res[:40]:
        print(r["study_id"], "sp", r["n_spikes"], "qrs", r["n_qrs"], "maxRR", r["max_rr"], "medRR", r["median_rr"],
              [(d["t"], d["next_qrs"]) for d in r["dropped"]][:5], "|", r["report"][:90])


main()
