# Website (Phase 1)

**Free launch (2026-11-03):** the site now builds as a free site with no sign-up (`free_launch`,
`signup`, `approved_only` in `site.config.json`). What changed and how to go live: `FREE-LAUNCH.md`,
section "Status". Free preview: https://claude.ai/artifact/Fd3XwmWECJHzeNUXSgviiq

The public site for the ECG trainer: Romanian first (`/`), English at `/en/`.
Working name **ECG Gym** until Alex picks the real name in Phase 0; it is one line in
`site.config.json`.

Preview (forms send nothing): https://claude.ai/artifact/BjBbHg1scnhw5Z77H6ZeNX

## What's here

| Path | What it is |
| --- | --- |
| `site.config.json` | Brand, domain, contact email, company details, founding prices, draft switches |
| `content/ro.json`, `content/en.json` | Every sentence on the site, per language |
| `content/pages/` | Privacy policy and terms (RO/EN), drafts until a lawyer or accountant checks them |
| `templates/` | Page layouts (Jinja2) |
| `static/` | CSS, JS (live ECG strip, calipers demo, quiz, forms), self-hosted fonts, icon |
| `functions/api/subscribe.js` | The sign-up endpoint: sends readers to Brevo with double opt-in |
| `pocket-guide/` | The ECG pocket guide: card text (`cards.ro.html`, `cards.en.html`) and PDF builder |
| `build.py` | Builds the site into `dist/` |
| `tools/` | Font download, PTB-XL, MIMIC-IV-ECG and monitor-strip (vfdb/cudb) readers, the hero trace extractor |
| `tests/` | Endpoint tests, form end-to-end test, link checker |
| `ROADMAP.md` | The build plan for the rest of the platform, in launch-plan order |

## The trainer (Phase 2, prototype)

Lives in `app/` and is copied to `/app/` by `build.py` (not linked from the site until the beta).
Preview with the review screen: https://claude.ai/artifact/AwDUiVLN2Lj9YToemaKGz1

| Path | What it is |
| --- | --- |
| `trainer/content/cases.json` | Each case: PTB-XL or MIMIC-IV-ECG record (or a vfdb/cudb monitor strip), answer, four options, leads to look at, rhythm strips, optional question, findings and take-away (RO/EN); per profile: core/stretch/skip, a question for that profile, follow-up questions, an action card and a deeper note |
| `trainer/content/diagnoses.json` | Every diagnosis used as an answer or option: name, one-line tell, criteria, pitfalls, a plain label and an action card for nurses and paramedics (RO/EN) |
| `trainer/content/modules.json` | The nine modules, in order (three of them pacing: modes, site and CRT, pitfalls and malfunctions; one cardiac arrest) |
| `trainer/content/tiers.json` | The six profiles (student, nurse, paramedic, resident, specialist, electrophysiologist): who they are, goals, depth of explanation, drills, hints, first view (12-lead or strip), the nurse and paramedic four-action sets, the specialist focus (cardiology or acute care) |
| `trainer/content/lessons.json` | The ECG course from zero: 17 lessons (heart → systematic read and triage), each with its steps, tasks on real tracings and its fit per profile (required, optional, skip) |
| `trainer/build_cases.py` | Validates the content, adds PTB-XL+ reference measurements and writes `app/data/cases.json` (with profiles, modules, diagnoses) |
| `trainer/build_lessons.py` | Validates the lessons and writes `app/data/lessons.json`; `--plot DIR` draws every figure and mark for a second reader, `--content F --dry-run` checks a draft |
| `trainer/REVIEW-TIERS.md` | Alex's open questions on the profiles, the course and the arrest module, with the defaults in use |
| `trainer/authoring/` | Writer guide, profile plan, case plotter and fragment validator for adding content |
| `trainer/signals.py` | Baseline filter and compact signal files for each ECG |
| `trainer/preview.py` | Makes the claude.ai preview bundle |
| `trainer/STYLE-RO.md` | Romanian ECG style guide and glossary: every Romanian text (trainer, pocket guide, site) follows it |
| `app/js/ecg.js` | Draws the ECG on true-scale paper and runs the calipers |
| `app/js/main.js` | Practice, lessons, drills, library, profile, progress and the review screen |
| `app/js/diagrams.js` | The lesson diagrams (conduction, waves, leads, pads, AV blocks and others), RO/EN |
| `app/js/srs.js`, `app/js/store.js` | Spaced repetition and progress (this browser only until accounts exist) |
| `app/js/i18n.js` | Every interface sentence, RO/EN |

Alex's approvals and edits from the review screen are stored with the preview (collection
`reviews`, with only the changed fields under `edits`); error reports go to `reports`. One
document per approved text (`<caseId>`, `dx-<KEY>`) and one per newer layer, so an approval of the
older texts is never reset: `tierfu-<caseId>` (a case's profile questions, action card and deeper
note), `dxa-<KEY>` (plain label and action card), `tier-<id>` (a profile) and `lesson-<id>`.
Claude reads them and applies the changes to `trainer/content/`, then runs
`python3 trainer/build_cases.py` and `python3 trainer/build_lessons.py`.

## Pages

| Romanian | English | Purpose |
| --- | --- | --- |
| `/` | `/en/` | Home: live ECG strip, sign-up, ECG-of-the-week quiz, calipers demo, founding offer, FAQ |
| `/fondatori/` | `/en/founding/` | Founding-member reservation (no payment) with "what would you practise" and interview opt-in |
| `/multumim/` | `/en/thanks/` | Shown when JavaScript is off after a sign-up |
| `/confirmat/` | `/en/confirmed/` | Brevo sends people here after they click the confirmation link; pocket guide download |
| `/confidentialitate/` | `/en/privacy/` | Privacy policy (draft) |
| `/termeni/` | `/en/terms/` | Terms and company details (draft) |

The home-page quiz uses the newest weekly issue in `../ecg-digest/issues/` where every paper
has `"checked_by_alex": true`. Until one exists, the live site leaves the quiz out; the preview
uses the sample issue.

## Build and test (Claude does this)

```
pip install jinja2
python3 pocket-guide/build_guide.py      # PDFs, needs Node + Playwright Chromium
python3 build.py                         # live site into dist/
python3 build.py --preview               # preview: forms send nothing, drafts shown
npm test                                 # endpoint tests
node tests/e2e_forms.mjs                 # both forms in a real browser, Brevo faked
python3 tests/check_links.py             # no broken internal links
python3 trainer/build_cases.py           # trainer data; --force rewrites every signal file
python3 trainer/build_lessons.py         # the course; --plot DIR draws every figure for review
python3 trainer/preview.py OUT_DIR       # trainer preview bundle for claude.ai
```

## Going live: what Alex sets up

Free first (2026-11-03): for the free launch, follow `FREE-LAUNCH.md`; the steps below are the full
setup with sign-ups, kept for when the email sign-up and the paid tier come back.

1. **Name and domain** (Phase 0). Put the name in `site.config.json` (`brand`), and the domain
   in `site_url` and `contact_email`.
2. **Company details** once the SRL is registered: `company` in `site.config.json`. Romanian law
   (Law 365/2002) requires them on the site.
3. **Brevo** (free plan):
   - Contacts > Settings > Attributes: add `ROLE` (text), `LANGUAGE` (text), `EMAIL_VERSION` (text),
     `SIGNUP_SOURCE` (text), `FOUNDING` (boolean), `FOUNDING_PRICE` (text), `FOUNDING_DATE` (date),
     `INTERVIEW` (boolean), `WISH` (text). `FIRSTNAME` already exists.
   - Two lists: "Weekly ECG" and "Founding members". Note their ids.
   - Two double opt-in templates (Romanian and English) with the `{{ doubleoptin }}` confirmation
     link. Note their ids.
   - An automation "contact added to Weekly ECG" that sends the welcome email with the pocket guide
     link (`/descarcari/ghid-ecg-de-buzunar.pdf` or `/downloads/ecg-pocket-guide.pdf`).
   - An API key (SMTP & API > API keys).
   - Segments for sending: `EMAIL_VERSION` = doctor and = nurse, each split by `LANGUAGE`.
4. **GitHub**: a private repository holding this folder.
5. **Cloudflare Pages** (free): connect the repository, build output `dist`, no build command
   (Claude commits the built `dist/`). Under Settings > Variables and secrets add
   `BREVO_API_KEY` (secret), `BREVO_LIST_NEWSLETTER`, `BREVO_LIST_FOUNDING`,
   `BREVO_DOI_TEMPLATE_RO`, `BREVO_DOI_TEMPLATE_EN`. Point the domain at the project. Turn on
   Web Analytics (no cookies, so no consent banner).
6. **Checks before launch**: Alex reads the pocket guide and sets `pocket_guide_approved` to `true`
   (removes the DRAFT marks); a lawyer or the accountant reads the privacy policy and terms, then
   `legal_pages_reviewed` goes to `true`. The site names no person: the "who stands behind the
   content" section says only "a cardiologist trained in electrophysiology" (Alex's choice,
   2026-10-24), and the company is the data controller.

## Data licences

- **PTB-XL** (PhysioNet, CC BY 4.0): credit on every ECG. PTB-XL+ measurements are CC BY 4.0 too.
- **MIMIC-IV-ECG** (PhysioNet, ODbL v1.0; Gow B, Pollard T, Nathanson LA, et al., 2023,
  doi:10.13026/4nqg-sb35): used for the pacing cases PTB-XL is too old to have (CRT, septal leads).
  Read with `tools/mimic.py`; records and the machine statements are cached in `cache/mimic-iv-ecg/`.
  ODbL asks three things of a public site, and a lawyer should confirm how they apply before go-live
  (this is not legal advice):
  1. Attribution: the credit line under every MIMIC ECG, plus a line on the about or legal page.
  2. Share-alike: the extracted, filtered signals in `app/data/signals/mimic-*.json` and their machine
     measurements are a derivative database, so they must be offered under ODbL too (for example a
     free download of those files with the licence text).
  3. No lock-in: if the paid tier puts those signals behind a log-in or paywall, an unrestricted copy
     of the same database must also be offered (the download in point 2 covers this).
  Images of a tracing and the teaching texts are "produced works": they need the notice, not ODbL.
- **MIT-BIH Malignant Ventricular Ectopy Database** (vfdb; Greenwald SD, MIT 1986; PhysioNet,
  doi:10.13026/C22P44) and the **CU Ventricular Tachyarrhythmia Database** (cudb; Nolle FM et al.,
  1986; doi:10.13026/C2X59M): Open Data Commons Attribution v1.0, credit only. Used for the cardiac
  arrest monitor strips; read with `tools/monitor_db.py`, cached in `cache/vfdb/` and `cache/cudb/`.

## Rules kept in the site

- Education only; the site never asks for or reads anyone's ECG.
- Double opt-in for every new address; one-click unsubscribe in every email (Brevo).
- Only email, optional first name, role and language are collected (plus the optional
  founding-form answers). Fonts are self-hosted; no tracking cookies.
- Every ECG shown credits its source: PTB-XL (CC BY 4.0), MIMIC-IV-ECG (ODbL v1.0) or vfdb/cudb (ODC-By 1.0). See "Data licences" above.
- No drug doses or energies anywhere; nurse and paramedic actions stay within Romanian scope of practice (to be confirmed by a UPU/SMURD reviewer, see `trainer/REVIEW-TIERS.md`).
