# ECG Compass

Free ECG practice site (Romanian and English). The site lives in `website/`; see
`website/README.md` and `website/FREE-LAUNCH.md`.

`ecg-digest/issues/` holds the weekly issues shown on the "ECG of the week" pages. They are
written in the digest workspace and copied here with `python3 website/tools/digest.py add <week>`;
an issue goes live only when every `checked_by_alex` in its issue.json is `true`. See
`website/README.md`, "Weekly digest".

## Cloudflare settings (Workers)

The site runs as a Cloudflare Worker with static assets (`wrangler.jsonc`, `website/worker.js`).

- Build command: `cd website && pip install jinja2 && python3 build.py`
- Deploy command: `npx wrangler deploy`
- Variable `SITE_PASSWORD` (Worker → Settings → Variables and Secrets, type Secret): while set,
  every page asks for this password (test phase). Delete it to open the site.

(Cloudflare Pages also works: root `website`, build `pip install jinja2 && python3 build.py`,
output `dist`; there `functions/_middleware.js` does the same lock.)
