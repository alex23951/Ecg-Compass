"""Render a 12-lead ECG (PTB-XL or MIMIC-IV-ECG) on ECG paper for visual review.

    python3 render.py ptbxl 2486 OUTDIR
    python3 render.py mimic files/p1000/p10000032/s40689238/40689238 OUTDIR

Writes OUTDIR/<name>.png (3x4 layout + 10 s rhythm strips of II and V1, 25 mm/s,
10 mm/mV) and OUTDIR/<name>-zoom.png (first 4 s of I, II, aVF, V1 at 50 mm/s).
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

sys.path.insert(0, "/mnt/project-files/website/tools")
sys.path.insert(0, "/mnt/project-files/website/trainer")
import ptbxl  # noqa: E402

LEADS = ptbxl.LEADS
MIMIC = "https://physionet.org/files/mimic-iv-ecg/1.0/"
MIMIC_CACHE = Path("/mnt/project-files/website/cache/mimic-iv-ecg")


def read_wfdb(hea_path, dat_path):
    header = Path(hea_path).read_text().splitlines()
    n_sig, fs, n = (int(float(x)) for x in header[0].split()[1:4])
    gains, bases, names = [], [], []
    for line in header[1:1 + n_sig]:
        parts = line.split()
        g = parts[2]
        gains.append(float(g.split("(")[0].split("/")[0]) or 200.0)
        bases.append(int(g.split("(")[1].split(")")[0]) if "(" in g else 0)
        names.append(parts[-1])
    raw = np.fromfile(dat_path, dtype="<i2").reshape(-1, n_sig).T.astype(float)
    sig = (raw - np.array(bases)[:, None]) / np.array(gains)[:, None]
    order = [names.index(l) if l in names else [x.upper() for x in names].index(l.upper()) for l in LEADS]
    return sig[order], fs


def mimic_fetch(rel):
    import urllib.request
    out = []
    for ext in (".hea", ".dat"):
        p = MIMIC_CACHE / (rel + ext)
        if not p.exists() or p.stat().st_size == 0:
            p.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(MIMIC + rel + ext, timeout=120) as r:
                p.write_bytes(r.read())
        out.append(p)
    return out


def load(source, ident):
    if source == "ptbxl":
        sig, fs = ptbxl.read_signal(int(ident))
    else:
        hea, dat = mimic_fetch(ident)
        sig, fs = read_wfdb(hea, dat)
    sig = np.nan_to_num(sig)
    # remove baseline wander with a moving median (keeps spikes and QRS intact)
    k = int(0.6 * fs) | 1
    pad = np.pad(sig, ((0, 0), (k // 2, k // 2)), mode="edge")
    from numpy.lib.stride_tricks import sliding_window_view
    base = np.median(sliding_window_view(pad, k, axis=1)[:, ::10], axis=2)
    base = np.repeat(base, 10, axis=1)[:, : sig.shape[1]]
    return sig - base, fs


def paper(ax, w_mm, h_mm):
    ax.set_xlim(0, w_mm)
    ax.set_ylim(0, h_mm)
    ax.set_aspect("equal")
    ax.axis("off")
    for x in np.arange(0, w_mm + 0.01, 1):
        ax.axvline(x, color="#f4c7c3" if x % 5 else "#e58f88", lw=0.3 if x % 5 else 0.6, zorder=0)
    for y in np.arange(0, h_mm + 0.01, 1):
        ax.axhline(y, color="#f4c7c3" if y % 5 else "#e58f88", lw=0.3 if y % 5 else 0.6, zorder=0)


def trace(ax, x0, y0, seg, fs, mm_s, label):
    t = np.arange(len(seg)) / fs * mm_s + x0
    ax.plot(t, y0 + seg * 10, color="black", lw=0.6, zorder=2)
    ax.text(x0 + 1, y0 + 9, label, fontsize=7, zorder=3, weight="bold")


def render(source, ident, outdir, name):
    sig, fs = load(source, ident)
    n = sig.shape[1]
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    # standard sheet
    W, H = 250, 160
    fig = plt.figure(figsize=(W / 10, H / 10), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    paper(ax, W, H)
    grid = [["I", "aVR", "V1", "V4"], ["II", "aVL", "V2", "V5"], ["III", "aVF", "V3", "V6"]]
    seg_n = int(2.5 * fs)
    for r, row in enumerate(grid):
        y0 = H - 20 - r * 30
        for c, lead in enumerate(row):
            i = LEADS.index(lead)
            a = c * seg_n
            trace(ax, c * 62.5, y0, sig[i, a:a + seg_n], fs, 25, lead)
    for k, lead in enumerate(("II", "V1")):
        trace(ax, 0, H - 110 - k * 30, sig[LEADS.index(lead), :n], fs, 25, lead + " (10 s)")
    fig.savefig(outdir / f"{name}.png", dpi=100)
    plt.close(fig)
    # zoom: first 4 s at 50 mm/s
    W2, H2 = 200, 110
    fig = plt.figure(figsize=(W2 / 10 * 1.2, H2 / 10 * 1.2), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    paper(ax, W2, H2)
    for k, lead in enumerate(("I", "II", "aVF", "V1")):
        trace(ax, 0, H2 - 15 - k * 26, sig[LEADS.index(lead), : int(4 * fs)], fs, 50, lead + " 50 mm/s")
    fig.savefig(outdir / f"{name}-zoom.png", dpi=100)
    plt.close(fig)


if __name__ == "__main__":
    src, ident, out = sys.argv[1:4]
    render(src, ident, out, sys.argv[4] if len(sys.argv) > 4 else str(ident).split("/")[-1])
