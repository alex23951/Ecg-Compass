"""Check a writer's content fragment against the trainer's rules. Writes nothing.

    python3 check_fragment.py FRAGMENT.json [MORE.json ...]

A fragment is a JSON object with any of:
    "tiers":     the full list of 6 profiles (tiers.json)
    "diagnoses": {KEY: {fields}}   fields are merged into an existing key, or make a new key
    "modules":   [new module objects]
    "cases":     {CASE_ID: {fields}} fields added to an existing case (followups, tier_question,
                 tier_options, action, deep, vignette, question, tiers)
    "new_cases": [full new case objects]
Several fragments are merged in order. Case "tiers" (core/stretch/skip) default to the
spec's case_map. Prints problems (must fix) and warnings (look again); exit 1 on problems.
"""
import json
import re
import sys
from pathlib import Path

WEB = Path("/mnt/project-files/website")
sys.path.insert(0, str(WEB / "trainer"))
sys.path.insert(0, str(WEB / "tools"))
import build_cases as bc  # noqa: E402
import monitor_db  # noqa: E402

HERE = Path(__file__).resolve().parent
CONTENT = WEB / "trainer" / "content"
SIGNALS = WEB / "app" / "data" / "signals"
STUB_TIERS = [{"id": t, "name": {"ro": t, "en": t}, "who": {"ro": t, "en": t}, "goals": {"ro": [t], "en": [t]},
               "explain": "standard"} for t in bc.TIER_IDS]
for t in STUB_TIERS:
    if t["id"] in ("nurse", "paramedic"):
        t["action_set"] = [{"ro": k, "en": k} for k in "ABCD"]

DOSE = re.compile(r"\b\d+([.,]\d+)?\s?(mg|mcg|µg|ug|ml|mL|UI|IU|J|joule)\b")
RO_DECIMAL = re.compile(r"(?<![\w.,])\d+\.\d+(?![\w.])")
RO_LIMB = re.compile(r"\b(derivați(a|ile)|în|din)\s+(I|II|III)\b(?!-)")


def strings(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from strings(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def lint(frag, problems, warnings):
    for path, s in strings(frag):
        ro = ".ro" in path or path.endswith("ro")
        if "—" in s:
            problems.append(f"{path}: em-dash in learner text")
        if re.search(r"\bbpm\b", s, re.I):
            problems.append(f"{path}: use /min, not bpm")
        if DOSE.search(s):
            problems.append(f"{path}: looks like a dose or energy ({DOSE.search(s).group(0)}); say 'conform protocolului'")
        if ro and RO_DECIMAL.search(s):
            warnings.append(f"{path}: decimal point in Romanian ({RO_DECIMAL.search(s).group(0)}); use a comma")
        if ro and RO_LIMB.search(s):
            warnings.append(f"{path}: limb lead in Romanian should read DI/DII/DIII ({RO_LIMB.search(s).group(0)})")
        if ro and re.search(r"bătăi\s*/\s*min|b/min", s):
            warnings.append(f"{path}: house style is /min")


def main():
    frags = [json.loads(Path(p).read_text()) for p in sys.argv[1:]]
    cases = bc.load_json("cases.json")
    diagnoses = bc.load_json("diagnoses.json")
    modules = bc.load_json("modules.json")
    tiers = STUB_TIERS
    spec = json.loads((HERE / "spec.json").read_text())
    fit = {r["id"]: {t: r[t] for t in bc.TIER_IDS} for r in spec["case_map"]}
    touched_cases, touched_dx = set(), set()
    by_id = {c["id"]: c for c in cases}
    problems, warnings = [], []
    for fr in frags:
        lint(fr, problems, warnings)
        if "tiers" in fr:
            tiers = fr["tiers"]
        for k, v in fr.get("diagnoses", {}).items():
            diagnoses.setdefault(k, {}).update(v)
            touched_dx.add(k)
        modules += fr.get("modules", [])
        for cid, v in fr.get("cases", {}).items():
            if cid not in by_id:
                problems.append(f"{cid}: no such case")
                continue
            by_id[cid].update(v)
            touched_cases.add(cid)
        for c in fr.get("new_cases", []):
            if c.get("id") in by_id:
                problems.append(f"{c.get('id')}: new case id already exists")
            cases.append(c)
            by_id[c["id"]] = c
            touched_cases.add(c["id"])
    module_ids = {m["id"] for m in modules}

    # profiles
    tier_ids = [t["id"] for t in tiers]
    if tuple(tier_ids) != bc.TIER_IDS:
        problems.append(f"tiers: expected {bc.TIER_IDS}, found {tier_ids}")
    action_sets = {}
    for tr in tiers:
        for k in ("name", "who", "goals"):
            bc.check_text(tr.get(k), f"tier {tr['id']} {k}", problems)
        if "question" in tr:
            bc.check_text(tr["question"], f"tier {tr['id']} question", problems)
        if tr.get("first_view", "12lead") not in ("12lead", "strip"):
            problems.append(f"tier {tr['id']}: first_view must be 12lead or strip")
        if "action_set" in tr:
            if len(tr["action_set"]) != 4:
                problems.append(f"tier {tr['id']}: action_set needs 4 options")
            for i, o in enumerate(tr["action_set"]):
                bc.check_text(o, f"tier {tr['id']} action_set {i}", problems)
            action_sets[tr["id"]] = tr["action_set"]
        for f in tr.get("focus", []):
            bc.check_text(f.get("name"), f"tier {tr['id']} focus {f.get('id')}", problems)
            if any(m not in module_ids and m not in by_id for m in f.get("stretch", [])):
                problems.append(f"tier {tr['id']} focus {f.get('id')}: stretch lists an unknown module or case")
        if tr.get("explain") not in ("action", "standard", "deep"):
            problems.append(f"tier {tr['id']}: explain must be action, standard or deep")
        if any(d not in ("pr", "qrs", "qt", "axis") for d in tr.get("drills", [])):
            problems.append(f"tier {tr['id']}: unknown drill (pr, qrs, qt, axis)")
        if not isinstance(tr.get("hints", False), bool):
            problems.append(f"tier {tr['id']}: hints must be true or false")

    # diagnoses
    for key in sorted(touched_dx):
        d = diagnoses[key]
        bc.check_text(d.get("name"), f"diagnosis {key} name", problems)
        for k in ("tell", "criteria", "pitfalls", "plain", "action"):
            if k in d:
                bc.check_text(d[k], f"diagnosis {key} {k}", problems)

    # cases
    for cid in sorted(touched_cases):
        c = dict(by_id[cid])
        c.setdefault("tiers", fit.get(cid))
        if c.get("module") not in module_ids:
            problems.append(f"{cid}: unknown module {c.get('module')}")
        if sum(bool(c.get(k)) for k in ("ecg_id", "mimic", "monitor")) != 1:
            problems.append(f"{cid}: needs exactly one of ecg_id, mimic or monitor")
        if c.get("answer") not in c.get("options", []):
            problems.append(f"{cid}: answer not among options")
        for o in c.get("options", []):
            if o not in diagnoses:
                problems.append(f"{cid}: option {o} not in diagnoses")
        if not diagnoses.get(c.get("answer"), {}).get("criteria"):
            problems.append(f"{cid}: answer {c.get('answer')} has no criteria (teaching text)")
        if c.get("monitor"):
            m = c["monitor"]
            if m.get("db") not in monitor_db.BASE:
                problems.append(f"{cid}: monitor db must be one of {sorted(monitor_db.BASE)}")
            key = f"{m.get('db')}-{m.get('record')}-{round(m.get('start', 0) * 10)}"
            if not (SIGNALS / f"{key}.json").exists():
                warnings.append(f"{cid}: signal {key} not built yet (fine if the strip is new)")
            if any(lead != "MON" for lead in c.get("look", [])):
                problems.append(f"{cid}: a monitor strip has one lead, MON")
            if c.get("gain") not in (None, 5, 10, 20):
                problems.append(f"{cid}: gain must be 5, 10 or 20")
        for k in ("rhythm", "findings", "takeaway"):
            bc.check_text(c.get(k), f"{cid} {k}", problems)
        for k in ("question", "vignette", "action", "deep"):
            if c.get(k):
                bc.check_text(c[k], f"{cid} {k}", problems)
        fus = []
        for f in c.get("followups", []):
            if f.get("options") == "action_set":
                if len(f.get("tiers", [])) != 1 or f["tiers"][0] not in action_sets:
                    problems.append(f"{cid} followup {f.get('id')}: action_set needs exactly one tier that has one")
                    continue
                f = dict(f, options=action_sets[f["tiers"][0]])
            fus.append(f)
            for t in f.get("tiers", []):
                if (c.get("tiers") or {}).get(t) == "skip":
                    warnings.append(f"{cid} followup {f.get('id')}: tier {t} skips this case, so it never sees it")
        c["followups"] = fus
        bc.check_tiers(c, cid, tier_ids, diagnoses, problems)
        for t, opts in (c.get("tier_options") or {}).items():
            if len(opts) != 4:
                warnings.append(f"{cid}: tier_options {t} should have 4 keys")
            for o in opts:
                if not diagnoses.get(o, {}).get("plain") and t in ("nurse", "paramedic"):
                    warnings.append(f"{cid}: {o} has no plain label yet (writer of profiles adds them)")

    for p in problems:
        print("PROBLEM", p)
    for w in warnings:
        print("warning", w)
    print(f"checked {len(touched_cases)} cases, {len(touched_dx)} diagnoses, {len(tiers)} profiles: "
          f"{len(problems)} problems, {len(warnings)} warnings")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
