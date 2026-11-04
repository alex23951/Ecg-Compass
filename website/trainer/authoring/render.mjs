#!/usr/bin/env node
/* Draw ECGs with their teaching marks exactly as the trainer draws them, into PNG files,
   so a writer or a second reader can check every arrow against the tracing.

   node trainer/authoring/render.mjs --out DIR [--cases rhythm-01,isch-01] [--resolved FILE]
        [--lessons FILE] [--only basics-st] [--lang ro|en|both] [--width 1400] [--dark]
        [--signals DIR]

   --resolved   annotations from `python3 trainer/annotate.py --cases F --out D` (D/resolved.json);
                without it, the annotations already built into app/data/cases.json are drawn
   --cases      only these cases (default: every case in --resolved, or every case with annotations)
   --lessons    a built lessons file (app/data/lessons.json, or the --emit file of
                build_lessons.py --dry-run): every figure set, guided frame and check figure
   --signals    an extra folder of signal files (the --emit folder of a dry run)
   Output: DIR/<case>-<lang>.png and DIR/<lesson>-<step>-<n>-<lang>.png */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, "..", "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
if (!args.out) {
  console.error("usage: render.mjs --out DIR [--cases ids] [--resolved FILE] [--lessons FILE] [--lang ro|en|both]");
  process.exit(2);
}
const OUT = path.resolve(args.out);
fs.mkdirSync(OUT, { recursive: true });
const LANGS = args.lang === "en" ? ["en"] : args.lang === "both" ? ["ro", "en"] : ["ro"];
const WIDTH = Number(args.width || 1400);
const EXTRA = args.signals ? path.resolve(args.signals) : null;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let file = p.startsWith("/__extra/") && EXTRA ? path.join(EXTRA, p.slice(9)) : path.join(SITE, p);
  if (!file.startsWith(SITE) && !(EXTRA && file.startsWith(EXTRA))) { res.writeHead(403); return res.end(); }
  // the app's CSS asks for /static/fonts via ../../static; serve them from the site
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const signalUrl = (key) => (EXTRA && fs.existsSync(path.join(EXTRA, `${key}.json`))
  ? `${base}/__extra/${key}.json` : `${base}/app/data/signals/${key}.json`);

const built = JSON.parse(fs.readFileSync(path.join(SITE, "app", "data", "cases.json"), "utf8"));
const cases = new Map(built.cases.map((c) => [c.id, c]));
const resolved = args.resolved ? JSON.parse(fs.readFileSync(args.resolved, "utf8")) : null;

const jobs = [];
const pick = args.cases && args.cases !== true ? args.cases.split(",") : null;
if (resolved || !args.lessons) {
  const ids = pick || (resolved ? Object.keys(resolved) : built.cases.filter((c) => c.annotations?.length).map((c) => c.id));
  for (const id of ids) {
    const c = cases.get(id);
    if (!c) { console.error(`unknown case ${id}`); continue; }
    const monitor = c.layout === "monitor";
    for (const lang of LANGS) {
      jobs.push({ name: `${id}-${lang}`, spec: {
        title: `${id} · ${c.answer} · ${c.ecg_id}`, signal: signalUrl(c.ecg_id), lang, numbers: true,
        layout: monitor ? "strip" : "standard", leads: monitor ? ["MON"] : null, window: null, rowH: monitor ? 44 : undefined,
        strips: c.strips || ["II"], gain: c.gain || 10, annotations: (resolved ? resolved[id] : c.annotations) || [],
        dark: !!args.dark,
      } });
    }
  }
}
if (args.lessons) {
  const data = JSON.parse(fs.readFileSync(args.lessons, "utf8"));
  const list = (data.lessons || data).filter((l) => !args.only || args.only === true || args.only.split(",").includes(l.id));
  for (const l of list) {
    for (const st of l.steps) {
      const figs = [];
      const fig = (f, sets) => sets.forEach((s, k) => figs.push({ f, s, k }));
      if (st.type === "figure") fig(st, st.sets?.length ? st.sets : [{ marks: st.marks || [], annotations: st.annotations || [] }]);
      if (st.type === "guided") fig(st, st.frames || []);
      if (st.type === "check" && st.figure) fig(st.figure, [{ marks: [], annotations: st.figure.annotations || [] }]);
      for (const { f, s, k } of figs) {
        for (const lang of LANGS) {
          const label = s.label || s.title;
          jobs.push({ name: `${l.id}-${st.id}-${k + 1}-${lang}`, spec: {
            title: `${l.id} · ${st.id} (${st.type}) · ${k + 1}${label ? ` · ${typeof label === "string" ? label : label[lang]}` : ""}`,
            signal: signalUrl(f.ecg), lang, layout: f.layout === "standard" ? "standard" : "strip",
            leads: f.layout === "standard" ? null : (f.leads || ["II"]), window: f.layout === "standard" ? null : f.window,
            rowH: f.monitor ? 44 : undefined, strips: f.strips || ["II"], gain: f.gain || 10,
            marks: s.marks || [], annotations: s.annotations || [], highlight: s.highlight || [], dark: !!args.dark,
          } });
        }
      }
    }
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH + 40, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`${base}/trainer/authoring/render.html`);
await page.addStyleTag({ content: `#fig { --w: ${WIDTH}px; }` });
await page.waitForFunction(() => window.ready === true);
let n = 0;
for (const job of jobs) {
  try {
    await page.evaluate((spec) => window.drawFigure(spec), job.spec);
    await page.locator("#fig").screenshot({ path: path.join(OUT, `${job.name}.png`) });
    n++;
  } catch (e) {
    console.error(`${job.name}: ${e.message}`);
  }
}
await browser.close();
server.close();
console.log(`${n} images in ${OUT}`);
