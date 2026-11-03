# Pacing research (2026-10-14)

Working files from building the three pacing modules, kept so more cases can be added
without re-screening. Nothing here is loaded by the app.

| File | What it is |
| --- | --- |
| `ptbxl_paced.json` | The 294 PTB-XL records with a pacing code |
| `mimic_candidates.json` | 365 paced MIMIC-IV-ECG records picked by the machine statements, with QRS polarity per lead (a first guess at BiV / LV-only / RV) |
| `all_reads.json` | 198 careful reads of rendered tracings (mode, site, beats with times, malfunction, suggested answer, teaching value, confidence 1-5). Unused good candidates: about 35 more biventricular, 12 RV apex, 5 RV septal, DDD and fusion strips |
| `malf_candidates.json`, `malf_strict.json` | Signal screen of 900 more MIMIC records for spikes without capture; all 13 strict hits were false alarms on reading |
| `case_id_map.json` | Draft case ids to the final ids in `trainer/content/cases.json` |
| `mimic_screen.py`, `malf_screen.py`, `malf_rescreen.py`, `render.py`, `render_many.sh` | The screening and rendering scripts (render: 3 x 4 grid + II and V1 strips, plus a 50 mm/s zoom) |

Dropped after the second reader, and why (draft ids):
- site-03 (MIMIC 43020983) and site-16 (41488471): spike, short isoelectric gap and narrow QRS, so His capture can't be excluded.
- site-14 (45316902): looks like selective His pacing or pseudofusion; a possible CSP case if the native QRS were known.
- site-05 (43194038): BiV key too fragile against LV-only.
- site-18 (49520601), pace-13 (PTB-XL 9129), trbl-02 (20505): duplicates, dropped for balance.
- pace-11 (PTB-XL 16050): atrial rate about equal to the paced rate, so complete block isn't proven.

Public data gaps: no usable His/LBBAP case, one clean LV-only, no oversensing, one loss of capture.
Alex's own anonymised cases (with the hospital's written OK) are the best way to fill them.
