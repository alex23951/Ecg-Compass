#!/usr/bin/env python3
"""Build the trainer's case library into app/data/.

    python3 trainer/build_cases.py            cases.json + any missing signal files
    python3 trainer/build_cases.py --force    also rewrite every signal file

Reads the hand-written teaching content in trainer/content/:
    modules.json     the modules, in order
    diagnoses.json   every answer option: name, criteria and pitfalls (RO/EN)
    cases.json       each case: the record, answer, options, findings (RO/EN)
    tiers.json       the learner profiles (student, nurse, paramedic, resident, specialist,
                     ep): name, who, goals, explanation depth, drills

Each case says for every profile whether it is "core", "stretch" or "skip" ("tiers"),
and may add "followups" (questions asked after the main answer, each for some
profiles: {id, tiers, kind, question, options, answer, explain}), "tier_question" and
"tier_options" (a profile's own wording or distractors), "action" (what a nurse or
paramedic does; otherwise the diagnosis's "action" is used) and "deep" (an expert note).

A case's record is a PTB-XL number ("ecg_id") or a MIMIC-IV-ECG record path ("mimic",
files/p…/s…/…; used for devices PTB-XL predates, such as CRT). Optional "strips" lists
the full-length rhythm strips under the 3 x 4 grid (default ["II"]; pacing cases use
["II", "V1"]) and "question" replaces the default quiz question.

For PTB-XL cases it adds the patient's age and sex and reference measurements from
PTB-XL+ (two independent algorithms: Glasgow "unig" and GE 12SL). A measurement is used
for drills only when both algorithms agree (and, for the axis, when our own estimate from
leads I and aVF agrees with Glasgow's). MIMIC-IV-ECG has no age or sex and one machine
read, so its cases show the machine's values and are never used for drills.
"""
import argparse
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEBSITE = HERE.parent
sys.path.insert(0, str(WEBSITE / "tools"))
sys.path.insert(0, str(HERE))
import mimic  # noqa: E402
import monitor_db  # noqa: E402
import ptbxl  # noqa: E402
import signals  # noqa: E402

CONTENT = HERE / "content"
OUT = WEBSITE / "app" / "data"
PLUS = WEBSITE / "cache" / "ptbxl-plus"
PLUS_URL = "https://physionet-open.s3.amazonaws.com/ptb-xl-plus/1.0.1/features"
PLUS_CREDIT = ("PTB-XL+ (Strodthoff N, et al. Sci Data 2023;10:279), PhysioNet, CC BY 4.0")

# How far apart the two algorithms may be (ms) for a value to count as agreed.
AGREE_MS = {"pr": 20, "qrs": 12, "qt": 20}
AXIS_AGREE_DEG = 25
LANGS = ("ro", "en")

# Measurement drills only use ECGs where the measurement is taught the standard way.
# paced or mixed paced/native beats: no QRS, axis or QT drills (AAI keeps its own QRS)
PACED = {"VVI_AF", "VVI_DEMAND", "DDD", "VVI_CHB", "DDD_TRACK", "FUSION", "LOC", "UNDERSENSE",
         "OVERSENSE", "RV_APEX", "RV_SEPTAL", "BIV", "LV_ONLY", "CSP"}
NO_QT = {"AF", "AFL", "SVT", "LBBB", "RBBB", "WPW", "CHB"} | PACED
NO_QRS_AXIS = PACED


def drills_for(answer, agree):
    out = []
    if agree.get("pr"):
        out.append("pr")
    if agree.get("qrs") and answer not in NO_QRS_AXIS:
        out.append("qrs")
    if agree.get("qt") and agree.get("qtc_b") and answer not in NO_QT:
        out.append("qt")
    if agree.get("axis") and answer not in NO_QRS_AXIS:
        out.append("axis")
    return out


def load_json(name):
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


def load_plus(name):
    path = PLUS / name
    if not path.exists():
        import urllib.request
        path.parent.mkdir(parents=True, exist_ok=True)
        sub = "12sl" if name.startswith("12sl") else "unig"
        with urllib.request.urlopen(f"{PLUS_URL}/{sub}_features/{name}", timeout=120) as r:
            path.write_bytes(r.read())
    with open(path, newline="") as f:
        return {int(float(r["ecg_id"])): r for r in csv.DictReader(f)}


def num(row, key):
    try:
        v = float(row[key])
    except (KeyError, TypeError, ValueError):
        return None
    return None if math.isnan(v) else v


def own_axis(sig, fs, qrs_ms):
    """Frontal QRS axis from the net QRS deflection in leads I and aVF, averaged
    over all beats. A rough check on the Glasgow value, not a reference itself."""
    x = np.nan_to_num(sig)
    energy = np.abs(np.diff(x, axis=1)).sum(axis=0)
    w = max(1, int(0.04 * fs))
    energy = np.convolve(energy, np.ones(w) / w, "same")
    thr = 0.4 * energy.max()
    peaks = []
    for k in range(1, len(energy) - 1):
        if energy[k] > thr and energy[k] >= energy[k - 1] and energy[k] >= energy[k + 1]:
            if peaks and k - peaks[-1] < 0.3 * fs:
                if energy[k] > energy[peaks[-1]]:
                    peaks[-1] = k
            else:
                peaks.append(k)
    half = int(((qrs_ms or 100) / 1000) * 0.6 * fs)
    nets = []
    for p in peaks:
        a, b = p - half, p + half
        if a < 0 or b >= x.shape[1]:
            continue
        seg_i, seg_f = x[0, a:b], x[5, a:b]
        base_i, base_f = x[0, a], x[5, a]
        nets.append(((seg_i - base_i).sum(), (seg_f - base_f).sum()))
    if not nets:
        return None
    ni, nf = np.median(np.array(nets), axis=0)
    return round(math.degrees(math.atan2(nf, ni)))


def angle_diff(a, b):
    return abs((a - b + 180) % 360 - 180)


def measurements(ecg_id, u, g, sig, fs, override):
    m, agree, src = {}, {}, {}

    def pair(key_u, key_g, name, tol):
        a, b = num(u, key_u) if u else None, num(g, key_g) if g else None
        if a is not None and b is not None:
            m[name] = round((a + b) / 2)
            agree[name] = abs(a - b) <= tol
            src[name] = [a, b]
        elif a is not None or b is not None:
            m[name] = round(a if a is not None else b)
            agree[name] = False
            src[name] = [a, b]

    pair("HR__Global", "HR__Global", "hr", 3)
    pair("RR_Mean_Global", "RR_Mean_Global", "rr", 20)
    pair("PR_Int_Global", "PR_Int_Global", "pr", AGREE_MS["pr"])
    pair("QRS_Dur_Global", "QRS_Dur_Global", "qrs", AGREE_MS["qrs"])
    pair("QT_Int_Global", "QT_Int_Global", "qt", AGREE_MS["qt"])
    pair("QT_IntBazett_Global", "QT_IntBazett_Global", "qtc_b", AGREE_MS["qt"])
    pair("QT_IntFridericia_Global", "QT_IntFridericia_Global", "qtc_f", AGREE_MS["qt"])
    glasgow_axis = num(u, "QRS_AxisFront_Global") if u else None
    mine = own_axis(sig, fs, m.get("qrs"))
    if glasgow_axis is not None:
        m["axis"] = round(glasgow_axis)
        agree["axis"] = mine is not None and angle_diff(glasgow_axis, mine) <= AXIS_AGREE_DEG
        src["axis"] = [glasgow_axis, mine]
    # The case file can blank a value that has no meaning for this ECG (PR in
    # atrial fibrillation, QT in a paced rhythm) or replace one Alex measured.
    for k, v in (override or {}).items():
        if v is None:
            m.pop(k, None)
            agree[k] = False
        else:
            m[k] = v
            agree[k] = True
            src[k] = "manual"
    return m, agree, src


def mimic_measurements(row):
    """The ECG machine's own values for a MIMIC-IV-ECG record (one source, so never agreed)."""
    def v(k):
        x = num(row, k)
        return None if x is None or x >= 29999 else x

    m, src = {}, {}

    def put(name, value):
        if value is not None:
            m[name] = round(value)
            src[name] = [value]

    rr = v("rr_interval")
    put("rr", rr)
    put("hr", 60000 / rr if rr else None)
    p_on, q_on, q_off, t_off = v("p_onset"), v("qrs_onset"), v("qrs_end"), v("t_end")
    put("pr", q_on - p_on if p_on is not None and q_on is not None else None)
    put("qrs", q_off - q_on if q_on is not None and q_off is not None else None)
    put("qt", t_off - q_on if q_on is not None and t_off is not None else None)
    put("axis", v("qrs_axis"))
    return m, {k: False for k in m}, src


def check_text(obj, where, problems):
    for lang in LANGS:
        if not obj or not obj.get(lang):
            problems.append(f"{where}: missing {lang}")


TIER_IDS = ("student", "nurse", "paramedic", "resident", "specialist", "ep")
FIT = ("core", "stretch", "skip")


# follow-up kinds; each has a heading in app/js/i18n.js (follow_<kind>)
FOLLOW_KINDS = {"first", "record", "count", "evidence", "localise", "decision", "mechanism", "device",
                "limits", "beat", "predict", "shock"}


def check_tiers(c, cid, tier_ids, diagnoses, problems):
    fit = c.get("tiers")
    if not isinstance(fit, dict) or set(fit) != set(tier_ids) or any(v not in FIT for v in fit.values()):
        problems.append(f"{cid}: tiers must give core, stretch or skip for {', '.join(tier_ids)}")
    seen = set()
    for f in c.get("followups", []):
        fid = f.get("id")
        where = f"{cid} followup {fid}"
        if not fid or fid in seen:
            problems.append(f"{where}: missing or duplicate id")
        seen.add(fid)
        if not f.get("tiers") or any(t not in tier_ids for t in f["tiers"]):
            problems.append(f"{where}: unknown tiers {f.get('tiers')}")
        if f.get("kind") not in FOLLOW_KINDS:
            problems.append(f"{where}: kind must be one of {', '.join(sorted(FOLLOW_KINDS))}")
        check_text(f.get("question"), f"{where} question", problems)
        check_text(f.get("explain"), f"{where} explain", problems)
        opts = f.get("options", [])
        for i, o in enumerate(opts):
            check_text(o, f"{where} option {i}", problems)
        if not (2 <= len(opts) <= 4) or not (0 <= f.get("answer", -1) < len(opts)):
            problems.append(f"{where}: needs 2-4 options and a valid answer index")
    for tid, q in (c.get("tier_question") or {}).items():
        if tid not in tier_ids:
            problems.append(f"{cid}: tier_question for unknown tier {tid}")
        check_text(q, f"{cid} tier_question {tid}", problems)
    for tid, opts in (c.get("tier_options") or {}).items():
        if tid not in tier_ids:
            problems.append(f"{cid}: tier_options for unknown tier {tid}")
        if c["answer"] not in opts or len(set(opts)) != len(opts) or any(o not in diagnoses for o in opts):
            problems.append(f"{cid}: tier_options {tid} must hold the answer and known, distinct keys")
    for k in ("action", "deep"):
        if k in c:
            check_text(c[k], f"{cid} {k}", problems)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="rewrite all signal files")
    args = ap.parse_args()

    modules = load_json("modules.json")
    diagnoses = load_json("diagnoses.json")
    cases = load_json("cases.json")
    tiers = load_json("tiers.json") if (CONTENT / "tiers.json").exists() else []
    machine = mimic.machine_rows([c["mimic"] for c in cases if c.get("mimic")])
    db = ptbxl.database()
    unig = load_plus("unig_global.csv")
    ge = load_plus("12sl_global.csv")

    problems = []
    module_ids = {m["id"] for m in modules}
    for key, d in diagnoses.items():
        check_text(d.get("name"), f"diagnosis {key} name", problems)
        for k in ("action", "plain"):
            if k in d:
                check_text(d[k], f"diagnosis {key} {k}", problems)
    tier_ids = [t["id"] for t in tiers]
    if tiers and tuple(tier_ids) != TIER_IDS:
        problems.append(f"tiers.json: expected {TIER_IDS}, found {tier_ids}")
    action_sets = {}
    for tr in tiers:
        for k in ("name", "who"):
            check_text(tr.get(k), f"tier {tr['id']} {k}", problems)
        if "question" in tr:
            check_text(tr["question"], f"tier {tr['id']} question", problems)
        if tr.get("first_view", "12lead") not in ("12lead", "strip"):
            problems.append(f"tier {tr['id']}: first_view must be 12lead or strip")
        if "action_set" in tr:
            if len(tr["action_set"]) != 4:
                problems.append(f"tier {tr['id']}: action_set needs 4 options")
            for i, o in enumerate(tr["action_set"]):
                check_text(o, f"tier {tr['id']} action_set {i}", problems)
            action_sets[tr["id"]] = tr["action_set"]
        for f in tr.get("focus", []):
            check_text(f.get("name"), f"tier {tr['id']} focus {f.get('id')}", problems)
            if any(m not in module_ids and m not in {c["id"] for c in cases} for m in f.get("stretch", [])):
                problems.append(f"tier {tr['id']} focus {f.get('id')}: stretch lists an unknown module or case")
        check_text(tr.get("goals"), f"tier {tr['id']} goals", problems)
        if tr.get("explain") not in ("action", "standard", "deep"):
            problems.append(f"tier {tr['id']}: explain must be action, standard or deep")
        if any(d not in ("pr", "qrs", "qt", "axis") for d in tr.get("drills", [])):
            problems.append(f"tier {tr['id']}: unknown drill")

    (OUT / "signals").mkdir(parents=True, exist_ok=True)
    out_cases = []
    seen = set()
    for c in cases:
        cid = c["id"]
        if cid in seen:
            problems.append(f"{cid}: duplicate id")
        seen.add(cid)
        if c["module"] not in module_ids:
            problems.append(f"{cid}: unknown module {c['module']}")
        if sum(bool(c.get(k)) for k in ("ecg_id", "mimic", "monitor")) != 1:
            problems.append(f"{cid}: needs exactly one of ecg_id (PTB-XL), mimic (MIMIC-IV-ECG) "
                            "or monitor (vfdb/cudb strip)")
            continue
        if c["answer"] not in c["options"]:
            problems.append(f"{cid}: answer not among options")
        for o in c["options"]:
            if o not in diagnoses:
                problems.append(f"{cid}: option {o} not in diagnoses.json")
        if not diagnoses.get(c["answer"], {}).get("criteria"):
            problems.append(f"{cid}: answer {c['answer']} has no teaching text")
        strips = c.get("strips", ["II"])
        for lead in strips:
            if lead not in ptbxl.LEADS:
                problems.append(f"{cid}: unknown rhythm strip lead {lead}")
        for lead in c.get("look", []):
            if c.get("monitor"):
                if lead != "MON":
                    problems.append(f"{cid}: a monitor strip has one lead, MON")
            elif lead.replace("-rhythm", "") not in ptbxl.LEADS:
                problems.append(f"{cid}: unknown lead {lead}")
            elif lead.endswith("-rhythm") and lead[:-7] not in strips:
                problems.append(f"{cid}: look names {lead} but strips has no {lead[:-7]}")
        check_text(c.get("rhythm"), f"{cid} rhythm", problems)
        check_text(c.get("findings"), f"{cid} findings", problems)
        check_text(c.get("takeaway"), f"{cid} takeaway", problems)
        if c.get("question"):
            check_text(c["question"], f"{cid} question", problems)
        if c.get("vignette"):
            check_text(c["vignette"], f"{cid} vignette", problems)
        if tiers:
            # "options": "action_set" takes the four fixed action categories of the follow-up's
            # one tier, so they are written and approved once
            c = dict(c)
            fus = []
            for f in c.get("followups", []):
                if f.get("options") == "action_set":
                    if len(f.get("tiers", [])) != 1 or f["tiers"][0] not in action_sets:
                        problems.append(f"{cid} followup {f.get('id')}: action_set needs one tier that has one")
                        continue
                    f = dict(f, options=action_sets[f["tiers"][0]], action_set=True)
                fus.append(f)
            if "followups" in c:
                c["followups"] = fus
            check_tiers(c, cid, tier_ids, diagnoses, problems)

        if c.get("monitor"):
            # a 10-second monitor strip from vfdb or cudb: one unnamed lead, no age or sex,
            # no machine read; the rate comes from the case text
            mon = c["monitor"]
            if mon.get("db") not in monitor_db.BASE:
                problems.append(f"{cid}: monitor db must be one of {sorted(monitor_db.BASE)}")
                continue
            key = f"{mon['db']}-{mon['record']}-{round(mon['start'] * 10)}"
            dest = OUT / "signals" / f"{key}.json"
            if args.force or not dest.exists():
                sig, fs = signals.load_monitor(mon["db"], mon["record"], mon["start"], mon.get("channel", 0))
                dest.write_text(json.dumps(signals.encode(sig, fs, key, ["MON"]), separators=(",", ":")))
            out = dict(c)
            out.pop("monitor")
            out["ecg_id"] = key
            out["patient"] = None
            out["measure"], out["agree"], out["measure_sources"] = {}, {}, {}
            out["drills"] = []
            out["layout"] = "monitor"
            if c.get("gain") not in (None, 5, 10, 20):
                problems.append(f"{cid}: gain must be 5, 10 or 20")
            out["source"] = {"dataset": mon["db"], "record": mon["record"], "start": mon["start"],
                             "channel": mon.get("channel", 0)}
            # the database's own rhythm label for the strip (cardiologists' annotation), for review
            labels = [lab for a, b, lab in monitor_db.episodes(mon["db"], mon["record"])
                      if a < mon["start"] + 10 and b > mon["start"]]
            out["source"]["annotation"] = " → ".join(labels)
            out_cases.append(out)
            continue

        if c.get("mimic"):
            path = c["mimic"]
            key = mimic.key(path)
            dest = OUT / "signals" / f"{key}.json"
            sig, fs = signals.load_clean(path)
            if args.force or not dest.exists():
                dest.write_text(json.dumps(signals.encode(sig, fs, key), separators=(",", ":")))
            row = machine.get(path)
            if not row:
                problems.append(f"{cid}: no machine read for {path}")
                continue
            out = dict(c)
            out.pop("mimic")
            out["ecg_id"] = key
            out["patient"] = None
            m, agree, src = mimic_measurements(row)
            # as for PTB-XL: blank a value with no meaning here, or use one Alex measured
            for k, v in (out.pop("measure_override", None) or {}).items():
                if v is None:
                    m.pop(k, None)
                    src.pop(k, None)
                    agree[k] = False
                else:
                    m[k], agree[k], src[k] = v, True, "manual"
            out["measure"], out["agree"], out["measure_sources"] = m, agree, src
            out["drills"] = []
            out["source"] = {
                "dataset": "mimic",
                "record": path,
                "study_id": mimic.study_id(path),
                "report": "\n".join(row["report"]),
            }
            out_cases.append(out)
            continue

        ecg_id = c["ecg_id"]
        row = db[ecg_id]
        sig, fs = signals.load_clean(ecg_id)
        dest = OUT / "signals" / f"{ecg_id}.json"
        if args.force or not dest.exists():
            dest.write_text(json.dumps(signals.encode(sig, fs, ecg_id), separators=(",", ":")))
        m, agree, src = measurements(ecg_id, unig.get(ecg_id), ge.get(ecg_id), sig, fs,
                                     c.get("measure_override"))
        age = float(row["age"])
        out = dict(c)
        out.pop("measure_override", None)
        out["patient"] = {
            "age": None if age >= 90 else int(age),  # PTB-XL stores 90+ as 300
            "sex": "F" if row["sex"] == "1" else "M",
        }
        out["measure"] = m
        out["agree"] = agree
        out["drills"] = drills_for(c["answer"], agree)
        out["measure_sources"] = src
        out["source"] = {
            "dataset": "ptbxl",
            "ecg_id": ecg_id,
            "report": row["report"].strip(),
            "codes": row["codes"],
            "validated": row["validated_by_human"] == "True",
        }
        out_cases.append(out)

    if problems:
        print("Problems:\n  " + "\n  ".join(problems))
        sys.exit(1)

    data = {
        "version": 1,
        "credit": {"ecg": ptbxl.CREDIT, "measurements": PLUS_CREDIT, "mimic": mimic.CREDIT,
                   **monitor_db.CREDIT},
        "modules": modules,
        "tiers": tiers,
        "diagnoses": diagnoses,
        "cases": out_cases,
    }
    (OUT / "cases.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                                    encoding="utf-8")
    per_module = {m["id"]: sum(1 for c in out_cases if c["module"] == m["id"]) for m in modules}
    print(f"wrote {OUT / 'cases.json'}: {len(out_cases)} cases {per_module}")
    for c in out_cases:
        print(f"  {c['id']:<14} {c['ecg_id']:>14}  drills: {','.join(c['drills']) or '-'}")


if __name__ == "__main__":
    main()
