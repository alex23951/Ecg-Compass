# Authoring guide: tiers, follow-ups and lessons for the ECG trainer

You are writing teaching content for an ECG trainer built by an EP-trained cardiologist (Alex) for
Romania first. Everything is RO + EN. Romanian is the primary language and must read like a
Romanian hospital, not a translation.

## Files (read, do not edit unless your task says so)

- `/mnt/project-files/website/trainer/STYLE-RO.md`: the Romanian style guide and glossary. Read it
  in full before writing any Romanian. Formal "dumneavoastră" (imperative: „Măsurați”, „Verificați”).
  App house style: „linia izoelectrică”, „/min” (not bpm), DI/DII/DIII for limb leads in Romanian,
  „fibrilație atrială” spelled out, decimal comma in Romanian (0,12 s), „ms” for intervals.
- `/mnt/project-files/website/trainer/content/cases.json`: the 58 cases (texts you must stay
  consistent with: rhythm, findings, takeaway, answer key, options).
- `/mnt/project-files/website/trainer/content/diagnoses.json`: diagnosis keys with name, tell,
  criteria, pitfalls.
- `/mnt/project-files/website/app/data/cases.json`: the built cases, including the measured
  values (`measure`: hr, pr, qrs, qt, qtc_b, qtc_f, axis) for each case.
- The synthesized plan: `SPEC` below (given in your prompt).

## Seeing the tracings (mandatory before you write anything about a tracing)

    python3 /mnt/project-files/website/trainer/authoring/caseplot.py CASE_ID out.png
    python3 .../caseplot.py CASE_ID out.png --leads II,V1            # full 10 s of chosen leads
    python3 .../caseplot.py CASE_ID out.png --leads III,aVL --window 2,5   # zoomed
    python3 .../caseplot.py --signal vfdb-422-15450 out.png            # any signal file by key

Write your PNGs into your own folder under
`your own scratch folder (never /mnt/project-files)`
and look at them with the Read tool. 25 mm/s, 10 mm/mV: one small square = 40 ms and 0.1 mV.
Every statement about a tracing (a rate, an interval, which beat, which lead) must be true on the
plot. If the plan suggests a follow-up whose answer is not visible on the tracing, drop it or
rewrite it so the tracing supports it. Do not invent findings.

## Rules that never bend

- Education only. Never interpret a learner's own ECG; no individual medical advice.
- Nurse and paramedic "what to do" content: generic, aligned with ERC 2025 / ESC guidelines, within
  scope of practice in Romania (nurses act on a doctor's order or a unit protocol; paramedic and
  ambulance crews follow SAJ/SMURD protocols). No drug doses anywhere. Say "according to your
  unit's protocol" / „conform protocolului unității” where a drug or a device setting comes up.
- Cite the guideline family in the text where a threshold comes from one (ESC 2023 ACS, ESC 2021
  pacing, ESC 2024 AF, ERC 2025). Be correct and current. If unsure of a number, leave it out.
- Keep every option of a multiple-choice question plausible, about the same length, and only one
  clearly correct. No "all of the above".
- Short sentences. One idea per sentence. No em-dashes in learner-facing text.

## Data shapes

### Follow-up (on a case, in `followups`)

```json
{"id": "fu1", "tiers": ["nurse", "paramedic"], "kind": "first",
 "question": {"ro": "...", "en": "..."},
 "options": [{"ro": "...", "en": "..."}, {"ro": "...", "en": "..."}, {"ro": "...", "en": "..."}],
 "answer": 0,
 "explain": {"ro": "...", "en": "..."}}
```

- 2 to 4 options; `answer` is the 0-based index of the correct option (vary its position).
- `kind` is exactly one of: `first` (what do you do first), `record` (which extra leads / how to
  record), `count` (rate or count from the tracing), `evidence` (which finding proves it),
  `localise` (territory / culprit artery, level of block, accessory pathway location, pacing site),
  `decision` (next step / management), `mechanism`, `device` (programming / device behaviour),
  `limits` (what the surface ECG cannot show), `beat` (which complex on the strip), `predict`
  (what happens next), `shock` (shockable or not). The app shows a fixed heading per kind.
- `explain` (1 to 3 sentences) says why the answer is right, pointing at what is on the tracing.

### Per-case tier fields

- `tier_question`: `{"nurse": {"ro": "...", "en": "..."}, ...}` (only where the wording should differ).
- `tier_options`: `{"nurse": ["CHB", "SBRAD", "1AVB", "AF"], ...}` — exactly 4 diagnosis keys,
  must include the case's answer; only keys that exist in diagnoses.json.
- `action`: `{"ro": "...", "en": "..."}` — case-specific action card for nurse/paramedic (2 to 4
  sentences). If absent, the diagnosis-level `action` is used.
- `deep`: `{"ro": "...", "en": "..."}` — for specialist and EP profiles: mechanism, the decision
  it drives, and the pitfall an expert would check (2 to 4 sentences).

### Diagnosis-level `action` (in diagnoses.json)

`{"ro": "...", "en": "..."}`: what a nurse or paramedic does when they see this, generic, 2 to 4
sentences, no doses.

### Lessons (trainer/content/lessons.json, a list)

```json
{"id": "l01-heart", "title": {"ro": "...", "en": "..."}, "summary": {"ro": "...", "en": "..."},
 "minutes": 5,
 "objectives": {"ro": ["...", "..."], "en": ["...", "..."]},
 "tiers": {"student": "required", "nurse": "required", "paramedic": "required",
           "resident": "optional", "specialist": "optional", "ep": "skip"},
 "steps": [ ... ]}
```

Step types:

- `{"type": "text", "heading": {...}?, "body": {"ro": ["paragraph", ...], "en": [...]}}`
- `{"type": "diagram", "name": "conduction", "caption": {...}?}` — names: paper, beat, conduction,
  limb_leads, chest_leads, extra_leads (V4R and V7-V9), monitor (3- and 5-electrode monitoring),
  pads (defibrillation pad positions and the 8 cm rule), hexaxial, lead_groups, rate300.
- `{"type": "figure", "case": "rhythm-01", "leads": ["II"], "window": [0.5, 3.0],
   "heading": {...}?, "body": {...}?, "caption": {...}?,
   "sets": [{"label": {"ro": "Undele", "en": "Waves"}, "note": {...}?, "beat": 0, "show": ["P", "QRS", "T"]}]}`
  - `"layout": "standard"` instead of `leads`/`window` shows the full 12-lead.
  - `show` names (PTB-XL cases only, computed automatically on the recording): bands P, QRS, T,
    ST, TP, PRseg (labelled "PR segment" / "segment PR"); brackets PR (start of P to start of QRS),
    QRSd, QT, RR. `beat` 0 = the first complete beat in the window.
  - For MIMIC or monitor cases, give hand marks instead of `show`:
    `"marks": [{"t0": 1.20, "t1": 1.32, "tone": "qrs", "label": "QRS"}]` with times read off the plot
    (`label` may also be `{"ro": ..., "en": ...}`).
  - `"transform": "la_ra"` (or `ra_ll`, `ra_rl`) shows the same PTB-XL ECG as if two electrodes were
    swapped (computed, labelled as such). Use it on rhythm-01 (ECG 33).
- `{"type": "task", "case": "rhythm-01", "leads": ["II"], "window": [0, 4], "measure": "rr",
   "beat": 0, "prompt": {...}, "body": {...}?, "explain": {...}}` — measure with the calipers;
  `measure` is rr | rate | pr | qrs | qt; the reference value is computed from the recording
  (PTB-XL cases only). Do not state the expected value in the prompt.
- `{"type": "check", "question": {...}, "options": [{...}, ...], "answer": 1, "explain": {...}}`
- `{"type": "cases", "body": {...}?, "cases": ["rhythm-01", "rhythm-02"]}` — links to practise.

PTB-XL cases (usable with `show`, transforms and computed tasks): every case whose content entry
has `ecg_id` (rhythm-*, blocks-*, isch-*, tachy-*, patt-*, and the PTB-XL pacing cases).
MIMIC cases (`mimic` field) and monitor strips: hand marks only, no computed tasks.

### Fixed action categories ("What do you do first?")

For nurse and paramedic, a `first` follow-up uses `"options": "action_set"` and exactly one tier,
e.g. `{"id": "first-n", "tiers": ["nurse"], "kind": "first", "question": ..., "options": "action_set",
"answer": 1, "explain": ...}`. The app fills in that profile's four fixed options, in this order:

- nurse: 0 = start BLS/AED and call the arrest team; 1 = call the doctor now, keep the patient
  monitored with the defibrillator at hand, record a 12-lead; 2 = check the electrodes and the
  patient, record again; 3 = document it and report at the round.
- paramedic: 0 = shock / CPR per ERC; 1 = pads on, pacing or synchronised cardioversion ready,
  request physician support (SMURD / echipaj medical); 2 = transmit the 12-lead and pre-alert the
  PCI centre; 3 = monitor, transport and hand over.

The question can be the tier default (omit nothing: still give `question`, e.g. „Ce faceți mai
întâi?” / "What do you do first?", optionally with one line of context that the tracing supports).
The `explain` is case-specific: why that category, what on the tracing drives it.
Every case that is core or stretch for nurse gets one nurse `first` follow-up; same for paramedic.

### Other case fields

- `vignette`: `{"ro","en"}` one line of clinical context shown above the tracing. Only where the
  diagnosis needs it (PEA). It must say it is an invented scenario on a real tracing.
- `gain` (monitor cases): 5, 10 or 20 mm/mV.
- Monitor case: `{"id": "arrest-01", "monitor": {"db": "vfdb", "record": "422", "start": 1545.0,
  "channel": 0}, "module": "arrest", "level": 1, "answer": "VF", "options": [4 keys], "look": ["MON"],
  "rhythm": {...}, "findings": {"ro": [...], "en": [...]}, "takeaway": {...}, "tiers": {...},
  "followups": [...], "action": {...}, "deep": {...}}`. The signal key is
  `${db}-${record}-${start*10}` (plot it with `caseplot.py --signal vfdb-422-15450`).

### Diagnosis fields

`{"name", "tell", "criteria", "pitfalls", "plain"?, "action"?}`, all `{"ro","en"}`; criteria and
pitfalls are `{"ro": [..], "en": [..]}` lists like the existing entries. `plain` is a short
plain-language label shown before the name to nurses and paramedics (e.g. „Ritm rapid neregulat, fără
unde P” / "Fast irregular rhythm, no P waves"), under 60 characters, no abbreviations.

### Profiles (trainer/content/tiers.json, a list in this order: student, nurse, paramedic, resident, specialist, ep)

`{"id", "name": {ro,en}, "who": {ro,en}, "goals": {"ro": [3 lines], "en": [3 lines]},
"explain": "action"|"standard"|"deep", "drills": subset of ["pr","qrs","qt","axis"], "hints": bool,
"first_view": "12lead"|"strip", "question"?: {ro,en}, "action_set"?: [4 x {ro,en}] (nurse, paramedic
only, in the order above), "focus"?: [{"id","name":{ro,en},"stretch":[module or case ids]}] (specialist only; the first focus
is the default; a core case listed, or in a listed module, becomes stretch under that focus)}`.

### Lessons: extra fields

- Lesson `teaches`: diagnosis keys this lesson teaches; a wrong answer on those links back here.
- Any step can carry `"only": ["nurse", "paramedic"]` (a profile-specific variant of a step).
- Task `measure` can also be `count` (count QRS complexes in the window; give `ref` as an integer)
  or `volt` (voltage calipers on ONE lead, in mm, e.g. ST deviation at the J point; give `ref` in
  mm, step 0.5). `count` and `volt` always need a hand `ref` that you have checked on the plot.
- A figure or task can set `"gain": 5` (or 10, 20 mm/mV) for tall complexes.
- Diagram `av_blocks` (schematic strips: first degree, Mobitz I, Mobitz II, 2:1, complete).
- Not available yet (do not use): tap-the-wave tasks, pick-the-leads tasks, drag tasks, timers,
  placement check. Turn those plan ideas into `check` or `task` steps.
- Validate lessons with
  `python3 /mnt/project-files/website/trainer/build_lessons.py --content YOUR.json --dry-run --plot YOUR_DIR`
  (writes nothing into the app; prints each task's reference value and draws every figure's marks
  into YOUR_DIR, which you must look at).

### Checking case, diagnosis and profile content

Write your output to a file in your work folder and run
`python3 /mnt/project-files/website/trainer/authoring/check_fragment.py YOUR.json`
until it reports 0 problems (read every warning too). Fragment shape:
`{"tiers"?: [...], "diagnoses"?: {KEY: {fields}}, "modules"?: [...], "cases"?: {CASE_ID: {fields to add}},
"new_cases"?: [...]}`.

## Output

Return JSON exactly in the shape your task asks for. Do not write into /mnt/project-files.
