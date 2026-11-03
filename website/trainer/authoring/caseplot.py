"""Plot a trainer ECG on ECG paper (25 mm/s, 10 mm/mV) for reading and checking texts.

  python3 caseplot.py CASE_ID out.png                    # 12-lead layout + the case's rhythm strips
  python3 caseplot.py CASE_ID out.png --leads II,V1      # chosen leads, full 10 s each
  python3 caseplot.py CASE_ID out.png --leads II --window 2,5   # zoomed: 3 s of lead II
  python3 caseplot.py --signal 1196-la_ra out.png        # any signal file in app/data/signals

Signals come from /mnt/project-files/website/app/data/signals (already filtered as the app
shows them). Monitor strips have one lead, MON. Time ticks are in seconds from the start.
"""
import argparse
import base64
import json
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

DATA = Path("/mnt/project-files/website/app/data")
COLS = [["I", "II", "III"], ["aVR", "aVL", "aVF"], ["V1", "V2", "V3"], ["V4", "V5", "V6"]]


def load(key):
    j = json.loads((DATA / "signals" / f"{key}.json").read_text())
    leads = {}
    for name, b64 in zip(j["leads"], j["data"]):
        raw = np.frombuffer(base64.b64decode(b64), dtype="<i2").astype(float)
        raw[raw == -32768] = np.nan
        leads[name] = raw / 1000
    return leads, j["fs"]


def paper(ax, t0, t1, y0, y1):
    for x in np.arange(np.floor(t0 / 0.04) * 0.04, t1 + 1e-9, 0.04):
        major = abs(x / 0.2 - round(x / 0.2)) < 1e-6
        ax.axvline(x, color="#e8a0a0" if major else "#f6d8d8", lw=0.9 if major else 0.4, zorder=0)
    for y in np.arange(np.floor(y0 / 0.1) * 0.1, y1 + 1e-9, 0.1):
        major = abs(y / 0.5 - round(y / 0.5)) < 1e-6
        ax.axhline(y, color="#e8a0a0" if major else "#f6d8d8", lw=0.9 if major else 0.4, zorder=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case", nargs="?")
    ap.add_argument("out")
    ap.add_argument("--signal")
    ap.add_argument("--leads")
    ap.add_argument("--window")
    ap.add_argument("--scale", type=float, default=1.0, help="figure size multiplier")
    a = ap.parse_args()
    strips = ["II"]
    if a.signal:
        key, title = a.signal, a.signal
    else:
        cases = {c["id"]: c for c in json.loads((DATA / "cases.json").read_text())["cases"]}
        c = cases[a.case]
        key, title = c["ecg_id"], f"{a.case} ({c['ecg_id']})"
        strips = c.get("strips") or ["II"]
    leads, fs = load(key)
    n = len(next(iter(leads.values())))
    dur = n / fs
    if "MON" in leads and not a.leads:
        a.leads = "MON"
    if a.leads:
        names = a.leads.split(",")
        t0, t1 = (float(x) for x in a.window.split(",")) if a.window else (0, dur)
        rows = []
        for nm in names:
            y = leads[nm][int(t0 * fs):int(t1 * fs)]
            rows.append((nm, np.arange(len(y)) / fs + t0, y))
        lo = min(np.nanmin(r[2]) for r in rows) - 0.2
        hi = max(np.nanmax(r[2]) for r in rows) + 0.2
        span = hi - lo
        w = (t1 - t0) * 25 / 25.4 * a.scale  # inches at true scale (25 mm/s)
        fig, axs = plt.subplots(len(rows), 1, figsize=(max(w, 6), len(rows) * span * 10 / 25.4 * a.scale + 0.6), squeeze=False)
        for (nm, t, y), ax in zip(rows, axs[:, 0]):
            ylo, yhi = np.nanmin(y) - 0.2, np.nanmax(y) + 0.2
            paper(ax, t0, t1, ylo, yhi)
            ax.plot(t, y, color="black", lw=0.9)
            ax.set_xlim(t0, t1)
            ax.set_ylim(ylo, yhi)
            ax.set_aspect(0.4 / 1.0 * 1)  # 25 mm/s : 10 mm/mV -> 1 s = 2.5 mV visually
            ax.set_xticks(np.arange(np.ceil(t0 * 5) / 5, t1 + 1e-9, 0.2), minor=True)
            ax.set_xticks(np.arange(np.ceil(t0), t1 + 1e-9, 1.0 if t1 - t0 > 4 else 0.2))
            ax.tick_params(labelsize=7)
            ax.set_yticks([])
            ax.text(t0 + 0.03, yhi - 0.1, nm, fontsize=10, weight="bold", va="top")
        axs[0, 0].set_title(title, fontsize=9, loc="left")
    else:
        colw = dur / 4
        nrow = 3 + len(strips)
        fig, ax = plt.subplots(figsize=(dur * 25 / 25.4 * a.scale, nrow * 3.3 / 2.54 * a.scale))
        rowh = 3.3  # mV per row
        ymax = nrow * rowh
        paper(ax, 0, dur, 0, ymax)
        for ci, col in enumerate(COLS):
            for ri, nm in enumerate(col):
                base = ymax - (ri + 0.5) * rowh
                i0, i1 = int(ci * colw * fs), int((ci + 1) * colw * fs)
                y = leads[nm][i0:i1]
                ax.plot(np.arange(i0, i0 + len(y)) / fs, np.clip(y, -1.6, 1.6) + base, color="black", lw=0.8)
                ax.text(ci * colw + 0.04, base + 1.1, nm, fontsize=9, weight="bold")
        for si, nm in enumerate(strips):
            base = ymax - (3 + si + 0.5) * rowh
            y = leads[nm]
            ax.plot(np.arange(len(y)) / fs, np.clip(y, -1.6, 1.6) + base, color="black", lw=0.8)
            ax.text(0.04, base + 1.1, nm, fontsize=9, weight="bold")
        ax.set_xlim(0, dur)
        ax.set_ylim(0, ymax)
        ax.set_aspect(0.4)
        ax.set_xticks(np.arange(0, dur + 1e-9, 1.0))
        ax.set_yticks([])
        ax.tick_params(labelsize=7)
        ax.set_title(title, fontsize=9, loc="left")
    fig.tight_layout()
    fig.savefig(a.out, dpi=110)


if __name__ == "__main__":
    main()
