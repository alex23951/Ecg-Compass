#!/usr/bin/env python3
"""Write static/data/hero-trace.json: 10 s of lead II from a normal PTB-XL ECG.

Used by the animated trace at the top of the home page. Values are in 0.01 mV
steps at 250 samples per second.
"""
import json
import sys

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

import ptbxl

ECG_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 33
LEAD = "II"


def remove_baseline(x, fs):
    w = int(0.6 * fs) | 1
    padded = np.pad(x, w // 2, mode="edge")
    return x - np.median(sliding_window_view(padded, w), axis=1)


def r_peaks(x, fs):
    thr = 0.5 * x.max()
    peaks = []
    for i in range(1, len(x) - 1):
        if x[i] > thr and x[i] >= x[i - 1] and x[i] >= x[i + 1]:
            if peaks and i - peaks[-1] < 0.3 * fs:
                if x[i] > x[peaks[-1]]:
                    peaks[-1] = i
            else:
                peaks.append(i)
    return peaks


def main():
    sig, fs = ptbxl.read_signal(ECG_ID)
    x = remove_baseline(sig[ptbxl.LEADS.index(LEAD)], fs)
    x = (x[0::2] + x[1::2]) / 2  # 500 Hz -> 250 Hz
    fs = 250
    peaks = r_peaks(x, fs)
    # Cut from mid-diastole before the 2nd beat to the same point before the last
    # beat, so the loop joins without a step.
    lead_in = int(0.35 * fs)
    start, end = peaks[1] - lead_in, peaks[-1] - lead_in
    x = x[start:end]
    x = x - x[0]
    out = {
        "ecg_id": ECG_ID, "lead": LEAD, "fs": fs, "unit": "0.01 mV",
        "credit": ptbxl.CREDIT,
        "r_peaks": [p - start for p in peaks[1:-1]],
        "samples": [int(round(v * 100)) for v in x],
    }
    dest = ptbxl.WEBSITE / "static" / "data" / "hero-trace.json"
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dest} ({len(out['samples'])} samples)")


if __name__ == "__main__":
    main()
