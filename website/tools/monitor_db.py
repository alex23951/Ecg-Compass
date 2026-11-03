"""Read monitor (Holter) recordings from two PhysioNet databases without extra libraries.

- MIT-BIH Malignant Ventricular Ectopy Database (vfdb): 22 half-hour two-lead recordings at
  250 Hz from patients with sustained VT, ventricular flutter and VF. Rhythm episodes are
  annotated by cardiologists. Greenwald SD, MS thesis, MIT, 1986. doi:10.13026/C22P44.
- Creighton University Ventricular Tachyarrhythmia Database (cudb): 35 eight-minute one-lead
  recordings at 250 Hz, with the onset and end of VF / ventricular flutter marked. Nolle FM
  et al., Computers in Cardiology 1986. doi:10.13026/C2X59M.

Both are open access under the Open Data Commons Attribution License v1.0 (credit only).
They are monitor strips: the lead is not named in the files, so the trainer calls it
"monitor lead" and never "II". Records are cached in cache/<db>/ and downloaded from
PhysioNet when missing (no login).
"""
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEBSITE = HERE.parent
CACHE = WEBSITE / "cache"
BASE = {"vfdb": "https://physionet.org/files/vfdb/1.0.0/",
        "cudb": "https://physionet.org/files/cudb/1.0.0/"}
CREDIT = {
    "vfdb": ("MIT-BIH Malignant Ventricular Ectopy Database (Greenwald SD, MIT 1986; PhysioNet, "
             "doi:10.13026/C22P44), ODC-By 1.0"),
    "cudb": ("CU Ventricular Tachyarrhythmia Database (Nolle FM et al., Computers in Cardiology 1986; "
             "PhysioNet, doi:10.13026/C2X59M), ODC-By 1.0"),
}

# MIT annotation codes we need (see the WFDB ecgcodes.h)
RHYTHM, NOISE, VFON, VFOFF = 28, 14, 32, 33
SKIP, NUM, SUB, CHN, AUX = 59, 60, 61, 62, 63


def fetch(db, rel):
    p = CACHE / db / rel
    if not p.exists() or p.stat().st_size == 0:
        p.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE[db] + rel, timeout=120) as r:
            p.write_bytes(r.read())
    return p


def records(db):
    return fetch(db, "RECORDS").read_text().split()


def header(db, rec):
    lines = [x for x in fetch(db, rec + ".hea").read_text().splitlines() if x and not x.startswith("#")]
    n_sig, fs, n = lines[0].split()[1:4]
    sigs = []
    for line in lines[1:1 + int(n_sig)]:
        parts = line.split()
        g = parts[2]
        gain = float(g.split("(")[0].split("/")[0]) or 200.0
        base = int(g.split("(")[1].split(")")[0]) if "(" in g else int(parts[4]) if len(parts) > 4 else 0
        sigs.append({"fmt": parts[1], "gain": gain, "baseline": base})
    return {"n_sig": int(n_sig), "fs": float(fs), "n": int(n), "sigs": sigs}


def read_signal(db, rec):
    """Return (signals in mV as array [n_sig, n], rate in Hz). Format 212 only."""
    h = header(db, rec)
    assert all(s["fmt"] == "212" for s in h["sigs"]), "only format 212 is supported"
    raw = np.fromfile(fetch(db, rec + ".dat"), dtype=np.uint8)
    raw = raw[: len(raw) // 3 * 3].reshape(-1, 3).astype(np.int32)
    a = raw[:, 0] | ((raw[:, 1] & 0x0F) << 8)
    b = raw[:, 2] | ((raw[:, 1] & 0xF0) << 4)
    flat = np.empty(2 * len(raw), dtype=np.int32)
    flat[0::2], flat[1::2] = a, b
    flat[flat > 2047] -= 4096
    k = h["n_sig"]
    flat = flat[: len(flat) // k * k].reshape(-1, k).T.astype(float)
    invalid = flat == -2048
    gains = np.array([s["gain"] for s in h["sigs"]])[:, None]
    bases = np.array([s["baseline"] for s in h["sigs"]])[:, None]
    sig = (flat - bases) / gains
    sig[invalid] = np.nan
    return sig, h["fs"]


def annotations(db, rec, ext="atr"):
    """Return a list of (sample, code, aux text) from an MIT-format annotation file."""
    words = np.fromfile(fetch(db, f"{rec}.{ext}"), dtype="<u2")
    out, t, i = [], 0, 0
    while i < len(words):
        w = int(words[i])
        code, val = w >> 10, w & 0x3FF
        i += 1
        if code == 0 and val == 0:
            break
        if code == SKIP:
            hi, lo = int(words[i]), int(words[i + 1])
            t += (hi << 16) | lo
            i += 2
        elif code == AUX:
            n = val
            data = words[i:i + (n + 1) // 2].tobytes()[:n]
            i += (n + 1) // 2
            if out:
                s, c, _ = out[-1]
                out[-1] = (s, c, data.decode("latin-1").rstrip("\x00"))
        elif code in (NUM, SUB, CHN):
            pass
        else:
            t += val
            out.append((t, code, ""))
    return out


def episodes(db, rec):
    """Rhythm episodes as (start s, end s, label). vfdb uses rhythm annotations such as
    "(VF"; cudb marks VF onset and end with [ and ]."""
    h = header(db, rec)
    fs, total = h["fs"], h["n"] / h["fs"]
    ann = annotations(db, rec)
    eps = []
    if db == "cudb":
        start = None
        for s, c, _ in ann:
            if c == VFON:
                start = s / fs
            elif c == VFOFF and start is not None:
                eps.append((start, s / fs, "VF/VFL"))
                start = None
        if start is not None:
            eps.append((start, total, "VF/VFL"))
        return eps
    cur = None
    for s, c, aux in ann:
        if c == RHYTHM and aux:
            if cur:
                eps.append((cur[0], s / fs, cur[1]))
            cur = (s / fs, aux.strip("(").strip())
    if cur:
        eps.append((cur[0], total, cur[1]))
    return eps
