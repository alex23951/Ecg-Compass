"""Read PTB-XL recordings (CC BY 4.0) without extra libraries.

Records are looked up first in the weekly digest's cache (read only), then in this
folder's own cache, and downloaded from PhysioNet's open S3 mirror if missing.
"""
import ast
import csv
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEBSITE = HERE.parent
DIGEST_CACHE = WEBSITE.parent / "ecg-digest" / "cache" / "ptbxl"
OWN_CACHE = WEBSITE / "cache" / "ptbxl"
MIRROR = "https://physionet-open.s3.amazonaws.com/ptb-xl/1.0.3"
LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
CREDIT = ("PTB-XL (Wagner P, Strodthoff N, et al. Sci Data 2020;7:154), "
          "PhysioNet, CC BY 4.0")


def fetch(rel_path):
    for base in (DIGEST_CACHE, OWN_CACHE):
        p = base / rel_path
        if p.exists() and p.stat().st_size > 0:
            return p
    dest = OWN_CACHE / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(f"{MIRROR}/{rel_path}", timeout=120) as r:
        dest.write_bytes(r.read())
    return dest


@lru_cache(maxsize=1)
def database():
    rows = {}
    with open(fetch("ptbxl_database.csv"), newline="") as f:
        for r in csv.DictReader(f):
            r["codes"] = ast.literal_eval(r["scp_codes"])
            rows[int(float(r["ecg_id"]))] = r
    return rows


def record_path(ecg_id):
    return f"records500/{ecg_id // 1000 * 1000:05d}/{ecg_id:05d}_hr"


def read_signal(ecg_id):
    """Return (signals in mV as array [12, n], sampling rate in Hz)."""
    rel = record_path(ecg_id)
    header = fetch(rel + ".hea").read_text().splitlines()
    n_sig, fs, n = (int(float(x)) for x in header[0].split()[1:4])
    gains, baselines = [], []
    for line in header[1:1 + n_sig]:
        parts = line.split()
        gain_part = parts[2]  # e.g. 1000.0(0)/mV
        gain = float(gain_part.split("(")[0].split("/")[0])
        base = int(gain_part.split("(")[1].split(")")[0]) if "(" in gain_part else 0
        gains.append(gain)
        baselines.append(base)
    raw = np.fromfile(fetch(rel + ".dat"), dtype="<i2")
    raw = raw.reshape(-1, n_sig).T.astype(float)
    sig = (raw - np.array(baselines)[:, None]) / np.array(gains)[:, None]
    return sig, fs
