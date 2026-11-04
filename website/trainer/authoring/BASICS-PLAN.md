# Beginner module: read an ECG step by step

Alex (2026-11-04): "a beginner learner module that takes you step by step through the basic
interpretation. Also include signs, arrows and markings explaining ECG findings."

A short course (`"course": "basics"`) of nine lessons that walks a complete beginner through the
site's 8-step reading order (home page, "The method"), one step per lesson, on real tracings
with arrows, labels and brackets drawn on them. It comes before the longer 17-lesson course
("ECG from scratch", `"course": "full"`), which stays as it is and goes deeper.

Readers: medical students, nurses, paramedics, first-year residents. Assume no ECG knowledge
beyond "the ECG records the heart's electrical activity". Explain every term the first time.

## The nine lessons (ids are fixed)

| id | step | title (EN) | core content |
| --- | --- | --- | --- |
| basics-start | 0 | Before you start: the paper and one beat | what the ECG shows; paper (1 small square = 40 ms and 0.1 mV; large = 200 ms and 0.5 mV; 25 mm/s, 10 mm/mV); the waves P, QRS, T; PR, QRS, QT; J point and ST; the 8 steps as a map |
| basics-rhythm | 1 | Step 1: Rhythm | regular or irregular (compare RR intervals); a P before every QRS and a QRS after every P; P upright in I and II → sinus; irregularly irregular with no P waves → atrial fibrillation (example only, no management) |
| basics-rate | 2 | Step 2: Rate | 300 rule for regular rhythms (300, 150, 100, 75, 60, 50 on the thick lines); count the QRS in 10 s × 6 for irregular rhythms; normal 60–100/min, bradycardia, tachycardia |
| basics-axis | 3 | Step 3: QRS axis | the QRS mostly up or mostly down; leads I and aVF (and II for the −30° border); normal, left and right axis deviation |
| basics-pr | 4 | Step 4: P wave and PR interval | P wave (upright in II, small); PR 120–200 ms; long PR = first-degree AV block; P waves not followed by a QRS (a glimpse of second- and third-degree block); short PR with a delta wave (pre-excitation) |
| basics-qrs | 5 | Step 5: QRS complex | narrow (under 120 ms) or wide (120 ms or more); the QRS alphabet (q, R, S, R'); RBBB (rsR' in V1) and LBBB (broad notched R in V6, QS/rS in V1); a glimpse of tall voltages (LVH) and Q waves |
| basics-st | 6 | Step 6: ST segment and T wave | baseline (PR segment), J point, measure ST deviation in mm at the J point; ST elevation in two neighboring leads; reciprocal depression; inverted T; this is a red-flag step: show the ECG to a doctor at once |
| basics-qt | 7 | Step 7: QT and QTc | QT from the start of QRS to the end of T; it shortens as the rate rises; QTc (Bazett) in one sentence; normal QTc under about 450 ms (men) / 460 ms (women), over 500 ms is high risk; the "QT under half the RR" eyeball check (only at normal rates) |
| basics-read | 8 | Step 8: Conclusion, the whole read | the one-line conclusion; a guided read of a normal 12-lead through all eight steps (one frame per step); then "your turn" on an abnormal ECG: one check per step, each with the tracing, whose marks appear after the answer; the right conclusion; links to practice cases |

## Shape of each lesson

- 5 to 8 minutes, 8 to 14 steps. `"course": "basics"`, `"step": N` (0 for basics-start),
  `"teaches": []` unless the lesson really teaches a diagnosis key (e.g. basics-rhythm may list
  "AF"; basics-pr "1AVB"), tiers: student, nurse, paramedic "required"; resident, specialist,
  ep "optional".
- Open with one short text step: what this step answers and why it matters.
- At least two annotated tracings: a `figure` with `sets` (each set has `annotations`; set labels
  1–2 words) or a `guided` figure (frames with a title, 1–3 short sentences and their marks).
- 2 to 4 `check` questions; at least one carries a `figure` (its marks appear once answered;
  the explanation says what the marks show).
- Optional: one calipers `task` (rr, rate, pr, qrs, qt, or count) on a PTB-XL case.
- End with a `cases` step linking 2 to 4 live cases that show the step.
- Objectives: 2–3, starting with a verb.
- Existing diagrams you may use: paper, beat, rate300, hexaxial, conduction, av_blocks,
  limb_leads, chest_leads, lead_groups.

## Which tracings

Prefer the approved, live cases (their texts are checked; learners meet them again in practice):

| case | PTB-XL | diagnosis | measured (PTB-XL+) |
| --- | --- | --- | --- |
| rhythm-01 | 33 | Normal ECG (sinus rhythm) | HR 75, PR 152, QRS 98, QT 385, axis +60 |
| rhythm-02 | 2 | Sinus bradycardia | HR 47, PR 154, QRS 86, QT 414, axis +68 |
| rhythm-03 | 2048 | Sinus tachycardia | HR 134, PR 131, QRS 92, QT 295, axis +24 |
| rhythm-04 | 4114 | Sinus arrhythmia | HR 50, PR 201, QRS 94, QT 435, axis +71 |
| rhythm-05 | 8215 | Atrial fibrillation | HR 80, QRS 92, axis +11 |
| blocks-01 | 1484 | First-degree AV block | HR 54, PR 223, QRS 102, QT 416, axis +75 |
| blocks-02 | 1222 | Mobitz I (Wenckebach) | HR 44, QRS 97, axis +61 |
| blocks-03 | 959 | Complete AV block | HR 40, QRS 137, axis −7 |
| blocks-04 | 903 | Complete RBBB | HR 84, PR 149, QRS 135, QT 381, axis 0 |
| blocks-05 | 286 | Complete LBBB | HR 54, PR 144, QRS 150, QT 476, axis −42 |
| blocks-06 | 41 | Left anterior fascicular block | HR 72, PR 155, QRS 112, axis −73 |
| isch-01 | 12899 | Acute inferior STEMI | HR 72, PR 175, QRS 90, QT 407, axis +43 |
| isch-02 | 13913 | Acute anterolateral STEMI | HR 122, QRS 106, axis −19 |
| isch-03 | 2993 | Inferolateral STEMI with posterior extension | HR 51, QRS 95, axis +3 |
| isch-04 | 1063 | Anterior STEMI with inferior ST elevation | HR 88, QRS 117, axis +67 |
| isch-05 | 3076 | Recent anterior MI, evolving | HR 54, QRS 95, QT 482, axis +70 |
| tachy-01 | 4117 | Atrial fibrillation (rapid) | HR 128, QRS 83, axis +81 |
| tachy-02 | 16401 | Atrial flutter | HR 68, QRS 90 |
| tachy-03 | 23 | Atrial flutter | HR 128, QRS 89 |
| tachy-04 | 2051 | SVT (re-entry) | HR 156, QRS 76 |
| tachy-05 | 219 | PVC | HR 74, PR 169, QRS 97 |
| tachy-06 | 628 | Ventricular bigeminy | HR 62 |
| patt-01 | 138 | LVH | HR 92, PR 177, QRS 83, axis +63 |
| patt-02 | 2145 | WPW pattern | HR 76, PR 101, QRS 130, axis −29 |
| patt-03 | 9699 | WPW pattern | HR 49, PR 129, QRS 163, axis +106 |

Use `"case": "<id>"` in figures. Another PTB-XL record (`"ecg": <number>`) is allowed when no
live case shows the point (for example a clearly long QT): pick one whose PTB-XL report and
PTB-XL+ values agree, and say so in your notes. Do not use the pacing, MIMIC-IV-ECG or
monitor-strip cases in this module.

Every statement about a tracing (a rate, an interval, which lead, which beat, a millimetre
value) must be true on that tracing: use `fiducials.py`, the resolver's printed values and the
rendered PNGs. The values in the table above are the reference values the trainer shows; keep to
them (round sensibly: "about 75/min").

## Marks in lessons

Same format as the case marks (`trainer/annotate.py` docstring, `ANNOTATIONS.md`), but here they
teach the step, so they can mark normal things too (P waves on a normal ECG, every RR, the
thick lines of the 300 rule). In a strip figure (`leads` + `window`), marks may only use the
leads shown. Thick grid lines in a strip with window [w0, w1] fall at t = w0 + 0.12 + 0.2·k s
(in the 12-lead grid at t = 0.12 + 0.2·k): use `vline` with labels "300", "150", "100" ... for
the 300 rule.

Step types and fields: `trainer/build_lessons.py` docstring and `AUTHORING.md` ("Lessons"),
plus:

- `figure` sets: `{"label": {...}, "note": {...}?, "annotations": [...], "show"/"beat" or "marks"?}`
- `guided`: `{"type": "guided", "case": ..., "leads": [...], "window": [...] (or "layout": "standard"),
  "heading": {...}, "body": {...}?, "frames": [{"title": {...}, "text": {"ro": [...], "en": [...]},
  "annotations": [...], "highlight": ["II", "V1", "II-rhythm"]?, "show": [...]?, "beat": 0?}]}`
  (2–12 frames; `highlight` boxes whole leads in the 12-lead grid)
- `check` with a tracing: `"figure": {"case": ..., "leads": [...], "window": [...] (or "layout":
  "standard"), "annotations": [...]}`

## Language and medicine

- Romanian first, and it must read like a Romanian hospital: follow `trainer/STYLE-RO.md` in
  full, address the reader with „tu" („Caută", „Numără", „Ce vezi?"), DI/DII/DIII, decimal
  comma, `/min`, ms for intervals. English is US English (practice, artifact, center,
  neighboring). Short sentences, one idea each, no em-dashes.
- Thresholds as in the approved diagnosis criteria (`trainer/content/diagnoses.json`): sinus
  60–100/min; PR 120–200 ms; QRS under 120 ms; QTc under about 450 ms (men) and 460 ms
  (women); axis −30° to +90°; STEMI thresholds per ESC 2023 (cite it where used).
- Education only. No drug names with doses, no device settings. Where an action comes up for a
  beginner, it is "show the ECG to a doctor at once" / „arată imediat ECG-ul unui medic" (nurses
  and paramedics: per the unit's or service's protocol).
- Keep every option of a check plausible and about the same length; one clearly correct.
- New medical text: Alex reviews every lesson before it goes live.

## Validate and look

    python3 trainer/build_lessons.py --content MY.json --dry-run --emit DIR
    node trainer/authoring/render.mjs --lessons DIR/lessons.json --signals DIR/signals --out DIR/png --lang both

Read every PNG. Fix until the dry run prints no problems and every mark sits on its feature.
