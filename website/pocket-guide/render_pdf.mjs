// Prints HTML files to PDF with Playwright's Chromium. Called by build_guide.py.
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); }

const jobs = JSON.parse(process.argv[2]);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [html, pdf] of jobs) {
  await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  console.log("pdf", pdf);
}
await browser.close();
