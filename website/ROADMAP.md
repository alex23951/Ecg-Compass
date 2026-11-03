# Build roadmap: website and platform

Follows the launch plan's phases (plan doc: https://claude.ai/code/artifact/0524da24-541e-4e38-aa8a-4c08d3d7443e).
Updated 2026-10-12.

## Stack (defaults chosen; cheap, EU-hosted, no app stores)

| Part | Choice | Cost |
| --- | --- | --- |
| Public site | Static pages built by `build.py`, Romanian and English | free |
| Hosting, sign-up endpoint, analytics | Cloudflare Pages + Pages Functions + Web Analytics (no cookies) | free |
| Email list and sending | Brevo (EU), double opt-in | free plan, then paid tier |
| App front end | A phone-friendly web app at `/app/`, installable on the home screen, plain JavaScript with no build step | free |
| Log-in, progress, entitlements | Supabase, EU (Frankfurt) region | free tier, then paid |
| Payments | Paddle (merchant of record) | 5% + $0.50 per sale |
| AI tutor | Claude API, called from a Pages Function so the key stays secret | pay per use |
| Code | One private GitHub repository; Cloudflare deploys every change | free |

**2026-11-03: free first, money later** (Alex's decision). Launch the site and trainer free; the
founding offer, prices, Paddle, paywall and AI tutor are parked. See `FREE-LAUNCH.md`.

## Phase 1: the public site (built; preview live)

- [x] Home page RO/EN: live ECG strip, sign-up with role, ECG-of-the-week quiz, calipers taster, founding offer, FAQ
- [x] Founding-member reservations (no payment), with "what would you practise" and an interview opt-in
- [x] Sign-up endpoint to Brevo with double opt-in, tested
- [x] Confirmation page with the pocket guide download
- [x] Pocket guide PDFs, RO/EN, A6 cards and A4 cut sheets (draft until Alex checks)
- [x] Privacy policy and terms, RO/EN (drafts for review)
- [ ] Social share image for links on WhatsApp, Facebook and LinkedIn
- [ ] Web archive of past issues (one page per issue, for sharing the Instagram quiz)
- [ ] Spam check (Cloudflare Turnstile) if bots show up
- [ ] Go live: needs the name, domain, SRL details and the accounts below

## Phase 2: the trainer (weeks 4–16)

Prototype built 2026-10-12 (preview: https://claude.ai/artifact/AwDUiVLN2Lj9YToemaKGz1).

1. [x] ECG library pipeline: 28 PTB-XL cases over 6 modules, compact signal files, true-scale ECG paper drawn in the browser. Still to do: more cases per module, Chapman/Ningbo for rhythms, Alex's own paced cases.
2. [x] Practice loop: question, answer, systematic read, findings, criteria and pitfalls, "report an error" on every ECG.
3. [x] Spaced repetition and progress stats (in this browser until accounts exist).
4. [x] Digital calipers (time and voltage) and measurement drills: PR, QRS, QT/QTc, axis, scored against PTB-XL+ reference measurements where two algorithms agree.
5. [x] Review tool for Alex: approve or edit each case and diagnosis text in both languages. Waiting on Alex's first review pass.
6. Accounts (email link log-in), progress saved across devices, RO/EN switch.
7. [~] Pacing and device module (built 2026-10-14): 33 paced ECGs in three modules: pacing modes (13), pacing site and CRT (14: RV apex, RV septum/outflow, biventricular, LV-only) and pitfalls and malfunctions (6: fusion, pseudofusion, undersensing, loss of capture, LV-only after a change mid-strip, the machine double-counting spikes). PTB-XL plus MIMIC-IV-ECG (ODbL, see README). Each text was checked against its tracing by a second reader. Still to do: conduction system pacing (His/LBBAP), more LV-only, oversensing and clean loss of capture, which public data barely has; Alex's own anonymised cases with written permission are the best source.
8. [~] Profiles and the ECG course (built 2026-10-25, Alex's request of 2026-10-24): six profiles
    (student, nurse, paramedic, resident, specialist with a cardiology or acute-care focus,
    electrophysiologist), each with its own case list, question per case, follow-ups, depth of
    explanation and drills; nurses and paramedics answer "what do you do first?" from four fixed
    actions. A 17-lesson course from zero (6–15 min each), fitted per profile. A cardiac arrest module
    (6 monitor strips from vfdb, ERC 2025). Second-reader checked; waiting on Alex's review and the
    questions in `trainer/REVIEW-TIERS.md`. Still to do:
    - an external reviewer from UPU/SMURD for nurse and paramedic scope of practice;
    - a placement check that suggests a profile and skips lessons a learner already knows;
    - timed triage drills (10 seconds per strip) and rate, ST and timing drills;
    - per-profile mastery and certificates;
    - new task types: tap the wave, pick the leads, drag the calipers onto a mark;
    - pacing marker channel and device printouts for the EP profile;
    - monitor alarm strips (PhysioNet/CinC 2015 false alarms) and 50 Hz artefact strips (nstdb), with an
      "artefact" answer;
    - a ventricular flutter answer (arrest-04), a real Mobitz II tracing, more cases per profile;
    - split the final lesson into "Systematic read" and "Triage" if Alex agrees.
9. AI tutor: answers only about the teaching ECGs, grounded in Alex's approved explanations, labelled as AI, no image uploads, declines questions about a user's own ECG.
10. Free tier (first module and the weekly ECG) and the paywall.
11. Weekly practice reminders by email.
12. Beta with the founding members.

## Phase 3: paid launch (months 4–6)

- Paddle checkout and webhooks: annual pass, one-off course pass, monthly.
- "First night on call" pack for new residents.
- Monthly ECG challenge with a leaderboard and a shareable certificate.
- A simple numbers page for Alex: sign-ups, free-to-paid, refunds, cancellations, module completion.

## Phase 4: credits, nurses, teams (months 6–9)

- Rhythm-strip and Holter trainer with the scrolling monitor mode.
- Team licences: group invite, progress dashboard, certificates.
- Test engine for a credited programme (fixed answer keys, 75% pass mark, two attempts; never graded by AI).
- Booking and access for the monthly live case session.

## Phase 5: German pilot and premium (months 9–12)

- German interface; "ECG in German" for foreign doctors; German device module.
- EHRA-style device and rhythm exam track (premium).
- Sponsor slot in the email (after the hospital conflict-of-interest check).

## Accounts Alex needs, in order

| When | Account | Cost (approximate) | Used for |
| --- | --- | --- | --- |
| Phase 0 | Domain, after the name check | about €10–20 a year | the site and email address |
| Phase 1 | Brevo | free plan to start | list, double opt-in, sending the weekly email |
| Phase 1 | GitHub | free | where the code lives, so every Claude session builds on the same files |
| Phase 1 | Cloudflare | free | hosting, the sign-up endpoint, visitor counts |
| Phase 2 | Supabase, EU region | free tier, then a monthly plan | log-in and progress |
| Phase 2 | Anthropic API key | pay per use | AI tutor and digest drafts |
| Phase 3 | Paddle (needs the SRL) | 5% + $0.50 per sale | payments and invoices |
