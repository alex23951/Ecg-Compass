"""Turn a PTB-XL or MIMIC-IV-ECG recording into the compact signal file the trainer draws.

Each lead goes through a zero-phase 0.5 Hz high-pass filter (removes baseline wander
without shifting the ST segment, as the AHA recommends for diagnostic ECGs) and is
stored as 16-bit microvolts, base64-encoded, at the original 500 samples per second.
No low-pass filter, so pacing spikes stay visible.

PTB-XL records end with about 100 ms of flat line after a step, and many start with a
settling transient of up to 100 ms. Those edges are blanked (stored as -32768, drawn as a gap) so the
filter cannot turn the step into a fake ST shift.

A filter also needs a guess of what came before the first sample and after the last.
Two guesses are tried: the mirrored signal, and a flat line at the baseline. Near each
edge of each lead the one that keeps the isoelectric line closer to the middle of the
recording wins, faded into the other over one second.
"""
import base64
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import mimic  # noqa: E402
import monitor_db  # noqa: E402
import ptbxl  # noqa: E402

HIGHPASS_HZ = 0.5


def _biquad_highpass(fs, f0):
    w0 = 2 * math.pi * f0 / fs
    alpha = math.sin(w0) / (2 * (1 / math.sqrt(2)))
    c = math.cos(w0)
    b = np.array([(1 + c) / 2, -(1 + c), (1 + c) / 2])
    a = np.array([1 + alpha, -2 * c, 1 - alpha])
    return b / a[0], a / a[0]


def _lfilter(b, a, x):
    """Direct form II transposed, run over all leads at once (x: [leads, n])."""
    y = np.empty_like(x)
    z1 = np.zeros(x.shape[0])
    z2 = np.zeros(x.shape[0])
    for i in range(x.shape[1]):
        xi = x[:, i]
        yi = b[0] * xi + z1
        z1 = b[1] * xi - a[1] * yi + z2
        z2 = b[2] * xi - a[2] * yi
        y[:, i] = yi
    return y


def highpass(sig, fs, f0=HIGHPASS_HZ, left=None, right=None):
    """Zero-phase (forward-backward) Butterworth high-pass. The edges are padded with
    the mirrored signal (odd reflection), or with the constant columns left/right."""
    b, a = _biquad_highpass(fs, f0)
    pad = min(int(2 * fs), sig.shape[1] - 1)
    lpad = 2 * sig[:, :1] - sig[:, pad:0:-1] if left is None else np.repeat(left, pad, axis=1)
    rpad = 2 * sig[:, -1:] - sig[:, -2:-pad - 2:-1] if right is None else np.repeat(right, pad, axis=1)
    x = np.concatenate([lpad, sig, rpad], axis=1)
    x = _lfilter(b, a, x)
    x = _lfilter(b, a, x[:, ::-1])[:, ::-1]
    return x[:, pad:pad + sig.shape[1]]


def isoelectric(seg):
    """The most common level in each lead's segment: the isoelectric line, at the
    usual rates where the baseline takes up most of the time."""
    out = []
    for row in seg:
        lo, hi = np.percentile(row, 2), np.percentile(row, 98)
        bins = np.arange(lo, hi + 0.01, 0.01)
        if len(bins) < 3:
            out.append(float(np.median(row)))
            continue
        hist, edges = np.histogram(row, bins=bins)
        i = int(np.argmax(np.convolve(hist, np.ones(5) / 5, "same")))
        out.append((edges[i] + edges[i + 1]) / 2)
    return np.array(out)


GAP = -32768


def load_monitor(db, record, start, channel=0, dur=10.0):
    """A 10-second monitor strip (one channel) from vfdb or cudb, in mV [1, n], and the rate.
    Filtered like the 12-lead ECGs (zero-phase 0.5 Hz high-pass) on 5 s of recording either
    side, so the edges of the strip carry no filter transient."""
    sig, fs = monitor_db.read_signal(db, record)
    fs = int(fs)
    a, b = int(start * fs), int((start + dur) * fs)
    pad = 5 * fs
    lo, hi = max(0, a - pad), min(sig.shape[1], b + pad)
    seg = sig[channel:channel + 1, lo:hi].copy()
    bad = np.isnan(seg[0])
    if bad.any():
        idx = np.arange(seg.shape[1])
        seg[0, bad] = np.interp(idx[bad], idx[~bad], seg[0, ~bad])
    seg = highpass(seg, fs)
    seg[0, bad] = np.nan
    return seg[:, a - lo:b - lo], fs


def valid_range(sig, fs):
    """First and last+1 sample of the real recording, without the flat edges."""
    moving = np.nonzero(np.abs(np.diff(sig, axis=1)).max(axis=0) > 1e-9)[0]
    if len(moving) == 0:
        return 0, sig.shape[1]
    head = int(moving[0])
    tail = sig.shape[1] - 2 - int(moving[-1])
    i0 = max(head + int(0.01 * fs), int(0.1 * fs))
    i1 = sig.shape[1] - tail - (int(0.03 * fs) if tail > 5 else 0)
    return i0, i1


def load_clean(ecg_id):
    """Signals in mV [12, n] with NaN where the recording is blank, and the rate.
    ecg_id is a PTB-XL number or a MIMIC-IV-ECG record path (files/p…/s…/…)."""
    if isinstance(ecg_id, str):
        sig, fs = mimic.read_signal(ecg_id)
        # a few MIMIC records have missing samples: hold the last value, blank them after filtering
        missing = np.isnan(sig)
        if missing.any():
            for i in range(sig.shape[0]):
                bad = missing[i]
                if bad.all():
                    sig[i] = 0
                elif bad.any():
                    idx = np.arange(sig.shape[1])
                    sig[i, bad] = np.interp(idx[bad], idx[~bad], sig[i, ~bad])
    else:
        sig, fs = ptbxl.read_signal(ecg_id)
        missing = None
    i0, i1 = valid_range(sig, fs)
    held = sig.copy()
    held[:, :i0] = sig[:, i0:i0 + 1]
    held[:, i1:] = sig[:, i1 - 1:i1]
    mirrored = highpass(held, fs)
    b0 = np.median(sig[:, i0:i0 + fs], axis=1, keepdims=True)
    b1 = np.median(sig[:, i1 - fs:i1], axis=1, keepdims=True)
    flat = sig.copy()
    flat[:, :i0] = b0
    flat[:, i1:] = b1
    flat = highpass(flat, fs, left=b0, right=b1)

    def drift(y):
        # how far the local baseline (median of each 0.2 s) strays from the
        # isoelectric line of the middle of the recording, over the first and last second
        mid = isoelectric(y[:, 3 * fs:7 * fs])
        step = int(0.2 * fs)

        def stray(a, b):
            meds = [np.median(y[:, k:k + step], axis=1) for k in range(a, b - step + 1, step)]
            return np.mean(np.abs(np.array(meds) - mid), axis=0)

        return stray(i0, i0 + fs), stray(i1 - fs, i1)

    (mh, mt), (fh, ft) = drift(mirrored), drift(flat)
    t = np.arange(sig.shape[1]) / fs
    head = np.clip(2.5 - t, 0, 1)  # 1 until 1.5 s, fading to 0 at 2.5 s
    tail = np.clip(t - (sig.shape[1] / fs - 2.5), 0, 1)
    weight = (fh < mh)[:, None] * head + (ft < mt)[:, None] * tail
    out = mirrored * (1 - weight) + flat * weight
    out[:, :i0] = np.nan
    out[:, i1:] = np.nan
    if missing is not None:
        out[missing] = np.nan
    return out, fs


def encode(sig, fs, ecg_id, leads=None):
    uv = np.clip(np.round(np.nan_to_num(sig, nan=GAP / 1000) * 1000), GAP + 1, 32767)
    uv[np.isnan(sig)] = GAP
    uv = uv.astype("<i2")
    return {
        "ecg_id": ecg_id,
        "fs": fs,
        "unit": "uV",
        "leads": leads or ptbxl.LEADS,
        "n": int(sig.shape[1]),
        "data": [base64.b64encode(uv[i].tobytes()).decode("ascii") for i in range(len(uv))],
    }
