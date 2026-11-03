# Free launch first, money later

Decided by Alex on 2026-11-03: "Can we start with a free educational site and then maybe work on
money". This file says what that changes and what the shortest path to a free launch is.
Not legal or tax advice: a lawyer should confirm the points marked (lawyer).

## What is parked (kept in the code, switched off)

- Founding-member reservation: the page `/fondatori/` (`/en/founding/`), the home-page band, the
  form, the "Founding members" Brevo list and the `kind=founding` path in `functions/api/subscribe.js`.
- Prices and "Pro": `founding` prices in `site.config.json`, the "Pro" wording on the home page,
  the founding FAQ ("Când plătesc?", "Primesc factură?") and the "Founding reservations" part of
  the terms.
- Paddle, the paywall and the free tier split, e-Factura, VAT, the monthly accountant.
- The AI tutor (every question costs API money, with no income to pay for it). Accounts too:
  progress stays in the learner's browser, which needs no log-in and stores nothing on a server.

## What stays, all free

- The whole trainer: 64 cases in 9 modules, the 17-lesson course from zero, six learner profiles,
  calipers and measurement drills, spaced repetition, the cardiac arrest module.
- The pocket guide (as a free download, once Alex checks it).
- The weekly ECG and papers digest (by email, or as a weekly page on the site; see the choice below).

## What gets simpler

- Terms: no sale, no withdrawal right, no renewal; only "education only, free, as is".
- Data licences: nothing sits behind a paywall, so the MIMIC-IV-ECG "no lock-in" point is met.
  Attribution and the ODbL notice for the extracted signals stay (README "Data licences").
- Year-1 cost falls from about €2,550–5,800 to about the domain (roughly €10–20 a year), plus a
  one-off lawyer check if Alex wants one. Cloudflare hosting and the Brevo free plan cost nothing.

## The one thing that does not go away: who runs the site

Whoever collects email addresses is the data controller and must be named in the privacy notice
(GDPR Art. 13). Alex lives in Switzerland, so running it personally would put Alex's name in the
privacy notice, and probably also needs an EU representative under GDPR Art. 27 for a regular
newsletter (lawyer). A Romanian SRL avoids both, but costs registration and an accountant before
any income. Three ways to launch:

| Option | Name on the site | Cost before income | Speed |
| --- | --- | --- | --- |
| **A. No sign-up at launch** (recommended to start) | None | Domain only | Fastest |
| B. Run it personally, with the email sign-up | Alex's name in the privacy notice; EU representative likely | Domain, maybe a representative | Fast |
| C. Register the SRL now, with the email sign-up | None (the SRL) | Registration and accountant | Slowest |

With A the site stores no personal data: no forms, no accounts, cookie-free analytics, a contact
email only (lawyer to confirm that a privacy notice without a named controller is enough). The
weekly ECG and papers go on the site as a page per issue instead of an email. The sign-up comes
back when the SRL exists (B or C later), and the code for it is already built and tested.

## Shortest path (option A)

Alex:
1. Pick the real name, then buy the domain (Claude never buys it).
2. Make a free Cloudflare account. GitHub is optional: with a GitHub account Claude's updates go
   live by themselves; without it, Alex uploads one folder in the Cloudflare dashboard.
3. Decide on content: launch only what Alex has approved (the first 28 cases and their diagnosis
   texts) and add each module after review, or review the pacing cases, profiles, course and arrest
   module first (`trainer/REVIEW-TIERS.md`). Default: launch approved content only, marked beta.
4. Check the pocket guide (`pocket_guide_approved`), or launch without it.

Claude (next thread):
1. A `free_launch` switch in `site.config.json` that hides the founding offer, prices, Pro wording,
   the sign-up forms and the founding FAQ, and links the trainer from the site.
2. Rewrite the home page around the free trainer; free-use terms; a short privacy notice.
3. An "approved content only" filter in the trainer build, driven by the review database.
4. A weekly digest page on the site, read-only from `../ecg-digest/issues/` (never written).
5. Build, test (links, browser check of every page in RO and EN), publish a preview for Alex, then
   prepare the upload for Cloudflare once Alex has the account and the domain.

## Still on the list, not blockers for a free launch

- The College of Physicians call from Phase 0 (a doctor publishing medical education).
- A UPU/SMURD reviewer for the nurse and paramedic actions (REVIEW-TIERS section A).
- The launch plan doc (https://claude.ai/code/artifact/0524da24-541e-4e38-aa8a-4c08d3d7443e) still
  shows the paid plan; it needs a "free first" revision.

## Status (2026-11-03, thread "Launch free ECG education site")

Alex chose **option A** (no sign-up at launch). Built:
- `site.config.json`: `free_launch: true`, `signup: false`, `approved_only: true`. Setting
  `free_launch: false` brings back the paid-plan site exactly as before; `signup: true` brings
  back the thanks/confirmed pages and the old privacy/terms (forms on the free home page are not
  wired yet; add them when B or C happens).
- Free home page `templates/home_free.html` (text in `content/free.ro.json` / `free.en.json`),
  digest pages `/ecg-saptamanii/` and `/en/ecg-of-the-week/` (`templates/digest_*.html`, read only
  from `../ecg-digest/issues/`; the live build lists only issues with every paper
  `checked_by_alex`, the preview lists all), free privacy and terms
  (`content/pages/privacy_free.*.html`, `terms_free.*.html`, drafts for a lawyer's look).
- Trainer goes live with approved content only: `trainer/content/approved.json` is a snapshot of
  the review database (28 cases, 44 diagnoses, taken 2026-11-03). The build drops unapproved
  cases, their tracings, profiles, follow-ups, deeper notes, action cards and the course. Refresh
  the snapshot when Alex approves more, and the next build publishes it.
- Live site: error reports become an email link (no data stored). The trainer is linked from
  the site and indexable.
- Preview: https://claude.ai/artifact/Fd3XwmWECJHzeNUXSgviiq (build with
  `python3 build.py --preview --fragment-root --out <dir>`, publish `<dir>/index.html` with every
  other file in `files`, leaving out `_headers`, `robots.txt`, `sitemap.xml`).

Going live with option A: `python3 build.py` and upload **only `dist/`** to Cloudflare Pages
(do not upload `functions/`: there is no sign-up). Turn on Cloudflare Web Analytics (cookie-free),
which the privacy notice mentions. Before that, Alex: brand name in `site.config.json` (`brand`),
domain in `site_url` and `contact_email` (a mailbox Alex reads, e.g. Cloudflare Email Routing to
Alex's inbox, free).

Design pass (2026-11-03, after looking at LITFL, ECG Weekly, The Cardiovascular, ECGpedia,
SkillStat Six Second ECG and ECG Academy; Medmastery blocked automated visits): hero stats and
topic chips that open a module in the trainer (`app/?lang=en#practice-<module>`), an 8-step
"systematic read" band, and an ECG A to Z page (`/ecg-a-z/`, `/en/ecg-a-z/`, `templates/az.html`)
built from the approved diagnosis texts, with search and a "practise on a real ECG" link per
diagnosis. The trainer now takes `?lang=en|ro` from the site's links.

## Test lock: a password for the first testers (Alex, 2026-11-03)

`functions/_middleware.js` asks every visitor for a password while the Cloudflare Pages
environment variable `SITE_PASSWORD` is set (browser login box, any user name, nothing stored;
pages are also marked noindex). Delete the variable to open the site. Tests: `tests/lock.test.mjs`.
The old sign-up endpoint now answers 404 unless `SIGNUP_ENABLED=true`.

Cloudflare runs this only when the site is deployed from GitHub (or Wrangler), not with dashboard
drag-and-drop. So going live becomes: Alex makes a free GitHub account and an empty private
repository, Claude pushes `website/` there, and Alex connects it in Cloudflare Pages (build command
`pip install jinja2 && python3 build.py`, output folder `dist`, root `website/` if needed) and sets
`SITE_PASSWORD`. The weekly-issue images come from `../ecg-digest/issues/`, so the repository needs
that folder too (or the build skips the digest).

Without GitHub, the no-code alternative is Cloudflare Access (Zero Trust, free up to 50 users):
Alex lists the testers' email addresses and each tester gets a one-time login code by email.
