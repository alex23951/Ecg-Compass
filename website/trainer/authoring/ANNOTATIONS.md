# Teaching marks on ECGs: how to write and check them

Alex (2026-11-04): "include signs, arrows and markings explaining ECG findings" and, for the
trainer cases, "no need for all the steps, just the diagnostic findings".

So every trainer case gets a few marks drawn on its own tracing: arrows, labels, brackets
and boxes that show **the findings that make the diagnosis**. They appear once the learner
has answered (and straight away in the library). Each mark belongs to one finding bullet of
the case; the bullet gets the same number, and tapping it shows its marks.

Lessons use the same marks on their figures (`annotations` on a figure set, a guided frame or a
check figure, see `BASICS-PLAN.md`).

## Files

- `trainer/content/annotations.json`: `{case_id: [mark, ...]}`. New medical text: Alex checks
  every label before a case's marks go live (`approved.json` → `"annotations"`).
- `trainer/annotate.py`: the format (docstring at the top) and the resolver. Read the docstring.
- `trainer/content/cases.json`: the approved case texts. Never edit them here; marks must agree
  with them.

## Tools (run from `website/`)

    python3 trainer/authoring/fiducials.py CASE_ID            # findings, beats, named points per lead
    python3 trainer/annotate.py --cases MY.json --out DIR      # resolve + check a fragment
    node trainer/authoring/render.mjs --resolved DIR/resolved.json --out DIR/png --lang both

Look at every PNG with the Read tool (crop and enlarge with PIL when a mark is small). The PNG
is exactly what the trainer draws: 25 mm/s, 10 mm/mV, one small square = 40 ms and 0.1 mV.
The 12-lead grid shows 2.5 s per column: I, II, III at 0–2.5 s; aVR, aVL, aVF at 2.5–5 s;
V1–V3 at 5–7.5 s; V4–V6 at 7.5–10 s; the rhythm strip(s) underneath run 0–10 s
(`"rhythm": true`).

## What to mark

- Only findings that make or support the diagnosis, and only what the finding bullets say.
  Never mark something the case text does not state. Not every bullet needs a mark (advice such
  as "record V4R" has nothing to point at).
- 2 to 6 marks per case (at most 8). At most two labelled marks inside one 2.5 s cell.
- Set `"finding": i` on every mark (i = index of the bullet, from 0; `fiducials.py` lists them).
- Put the mark where the feature is clearest, in a lead the bullet names (or one in the case's
  `look` list). Rhythm findings (irregular RR, P waves marching through, pauses, spikes, a count)
  go on the rhythm strip (`"rhythm": true`).
- A number in a label must agree with the bullet (within 0.5 mm or 20 ms) and with the
  resolver's measurement (it prints `mm` and `ms`). If they disagree, leave the number out and
  report the disagreement; do not change the case text.
- The label must not hide the feature it explains: choose `dir` and `len` and check the PNG.

## Which kind for which finding

| Finding | Mark |
| --- | --- |
| ST elevation or depression | `rise` at `"at": "J"` with `"mm": true` (label "ST ↑" / "ST ↓"); `tag` "ST ↑" on the other leads of the territory |
| A wave or a point: P wave, delta wave, Q wave, notch, R', pacing spike, J point | `arrow` (spikes: `t` + `"snap": "abs"`) or `dot` |
| A long or short interval: PR, QRS, QT, RR, pause | `bracket` with `"ms": true` (`from`/`to` named points, or `t0`/`t1`) |
| A stretch: no P waves, f or F waves, a run, a premature beat, a dropped beat | `box` |
| Inverted T, tall R, deep S | `arrow` at `"T"`, `"R"` or `"S"` (or `rise` for a height in mm) |
| Counting complexes on a strip | `count` |
| Leads that share a finding | `tag` on each lead |

## Label words (keep them the same across cases)

Short, sentence case, 1–4 words. Romanian follows `trainer/STYLE-RO.md` (DI, DII, DIII; decimal
comma; `/min`; no „bpm”). Language-neutral labels can be one plain string ("P", "R'", "QRS").

| Romanian | English |
| --- | --- |
| ST ↑ / ST ↓ | ST ↑ / ST ↓ |
| Punctul J | J point |
| Undă P | P wave |
| Fără unde P | No P waves |
| Unde f / Unde F | f waves / F waves |
| Undă delta | Delta wave |
| PR scurt / PR lung | Short PR / Long PR |
| QRS larg / QRS îngust | Wide QRS / Narrow QRS |
| Undă Q | Q wave |
| T negativ | Inverted T |
| P neurmată de QRS | P without QRS |
| RR neregulat | Irregular RR |
| Pauză | Pause |
| ESV / ESA | PVC / PAC |
| Spike | Spike |
| Captură | Capture |

## Output and review

Write a fragment `{case_id: [marks]}` in your own folder, resolve and render it until it is
right, and hand it over. A second reader then checks every mark against the PNG and the case
text. Alex approves; the case ids go into `approved.json` → `"annotations"`.
