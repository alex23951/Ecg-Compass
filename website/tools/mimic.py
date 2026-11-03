"""Read MIMIC-IV-ECG recordings (ODbL v1.0) without extra libraries.

MIMIC-IV-ECG holds about 800,000 diagnostic 12-lead ECGs recorded at Beth Israel Deaconess
Medical Center, Boston, in 2008-2019 (so, unlike PTB-XL, it has CRT and other modern
devices). Records are WFDB files at 500 Hz, gain 200/mV, and come without age or sex.
A record is named by its path, e.g. files/p1000/p10000032/s40689238/40689238.

Records and the machine statements we use are cached in cache/mimic-iv-ecg/ and
downloaded from PhysioNet when missing (open access, no login).
"""
import csv
import json
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEBSITE = HERE.parent
CACHE = WEBSITE / "cache" / "mimic-iv-ecg"
BASE = "https://physionet.org/files/mimic-iv-ecg/1.0/"
LEADS = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
CREDIT = ("MIMIC-IV-ECG (Gow B, Pollard T, Nathanson LA, et al. PhysioNet 2023, "
          "doi:10.13026/4nqg-sb35), ODbL v1.0")
MISSING = -32768


def study_id(path):
    return path.rstrip("/").split("/")[-1]


def key(path):
    """The name of the record's signal file in the trainer: mimic-<study id>."""
    return f"mimic-{study_id(path)}"


def fetch(rel):
    p = CACHE / rel
    if not p.exists() or p.stat().st_size == 0:
        p.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE + rel, timeout=120) as r:
            p.write_bytes(r.read())
    return p


def read_signal(path):
    """Return (signals in mV as array [12, n] in LEADS order, NaN where missing; rate in Hz)."""
    header = fetch(path + ".hea").read_text().splitlines()
    n_sig, fs = (int(float(x)) for x in header[0].split()[1:3])
    gains, bases, names = [], [], []
    for line in header[1:1 + n_sig]:
        parts = line.split()
        g = parts[2]  # e.g. 200.0(0)/mV
        gains.append(float(g.split("(")[0].split("/")[0]) or 200.0)
        bases.append(int(g.split("(")[1].split(")")[0]) if "(" in g else 0)
        names.append(parts[-1])
    raw = np.fromfile(fetch(path + ".dat"), dtype="<i2").reshape(-1, n_sig).T.astype(float)
    raw[raw == MISSING] = np.nan
    sig = (raw - np.array(bases)[:, None]) / np.array(gains)[:, None]
    upper = [x.upper() for x in names]
    return sig[[upper.index(lead.upper()) for lead in LEADS]], fs


def machine_rows(paths):
    """The machine statements and measurements for these records, from
    machine_measurements.csv (cached per study in machine_rows.json, since the CSV is 180 MB)."""
    store = CACHE / "machine_rows.json"
    rows = json.loads(store.read_text()) if store.exists() else {}
    want = {study_id(p) for p in paths} - rows.keys()
    if want:
        with open(fetch("machine_measurements.csv"), newline="") as f:
            for r in csv.DictReader(f):
                if r["study_id"] in want:
                    reports = [(r.get(f"report_{i}") or "").strip() for i in range(18)]
                    rows[r["study_id"]] = {
                        "report": [x for x in reports if x],
                        **{k: r[k] for k in ("ecg_time", "rr_interval", "p_onset", "p_end", "qrs_onset",
                                             "qrs_end", "t_end", "p_axis", "qrs_axis", "t_axis")},
                    }
        store.write_text(json.dumps(rows, indent=0))
    return {p: rows.get(study_id(p)) for p in paths}
