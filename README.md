# ECG Compass

Free ECG practice site (Romanian and English). The site lives in `website/`; see
`website/README.md` and `website/FREE-LAUNCH.md`.

`ecg-digest/issues/` is a read-only copy of the weekly issues (the digest is written elsewhere);
the build reads it for the "ECG of the week" pages.

## Cloudflare Pages settings

- Root directory: `website`
- Build command: `pip install jinja2 && python3 build.py`
- Build output directory: `dist`
- Environment variable `SITE_PASSWORD`: while set, every page asks for this password (test phase).
  Delete it to open the site.
