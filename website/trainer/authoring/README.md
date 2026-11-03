# Authoring kit for new trainer content

Used on 2026-10-25 to write and second-read the profiles, the course and the arrest module.
Reuse it when adding cases, follow-ups or lessons.

- `AUTHORING.md`: the writer guide (fields, house rules, how to plot a case, what a second reader checks).
- `spec.json`: the plan behind the profiles: case-to-profile fit, follow-up kinds, lesson outlines.
- `caseplot.py CASE_ID out.png`: plots a case's tracing on ECG paper for checking a text against it.
- `check_fragment.py FRAGMENT.json`: validates a content fragment before it is merged into `trainer/content/`.
- `second-reader-*.txt`: what the second readers changed and asked on 2026-10-25. Alex's questions
  from them are grouped, with defaults, in `../REVIEW-TIERS.md`.

Write drafts in a scratch folder, not here, and merge into `trainer/content/` only after a second reader.
