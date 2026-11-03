// End-to-end check of both sign-up forms against the real endpoint code, with Brevo faked.
// Run after `python3 build.py`:  node tests/e2e_forms.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../functions/api/subscribe.js";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const ENV = { BREVO_API_KEY: "k", BREVO_LIST_NEWSLETTER: "3", BREVO_LIST_FOUNDING: "4", BREVO_DOI_TEMPLATE_RO: "11", BREVO_DOI_TEMPLATE_EN: "12" };
const brevoCalls = [];
const known = new Set(["known@example.com"]);
const fakeFetch = async (url, opts = {}) => {
  brevoCalls.push({ url, method: opts.method || "GET", body: opts.body && JSON.parse(opts.body) });
  if (!opts.method) {
    const email = decodeURIComponent(url.split("/").pop());
    return known.has(email) ? new Response(JSON.stringify({ email, emailBlacklisted: false }), { status: 200 }) : new Response("{}", { status: 404 });
  }
  return new Response(null, { status: 204 });
};
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/subscribe" && req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request("http://localhost" + req.url, { method: "POST", headers: req.headers, body: Buffer.concat(chunks) });
    const out = await handle(request, ENV, fakeFetch);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  let path = decodeURIComponent(req.url.split("?")[0]);
  if (path.endsWith("/")) path += "index.html";
  try {
    const body = await readFile(join(DIST, path));
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) failed++; };

// 1. Romanian newsletter form: validation, then success.
await page.goto(base + "/");
await page.click("#hero-email");
await page.fill("#hero-email", "ana@example.ro");
await page.click('form[data-kind="newsletter"] button[type="submit"]');
check(await page.isVisible('form[data-kind="newsletter"] .form-error'), "RO form asks for the role first");
await page.selectOption("#hero-role", "nurse");
await page.check("#hero-consent");
await page.click('form[data-kind="newsletter"] button[type="submit"]');
await page.waitForSelector(".form-done:not([hidden])");
check((await page.textContent(".form-done-title")).includes("Verificați-vă emailul"), "RO sign-up shows 'check your inbox'");
const doi = brevoCalls.find((c) => c.url.endsWith("doubleOptinConfirmation"));
check(doi && doi.body.email === "ana@example.ro" && doi.body.attributes.EMAIL_VERSION === "nurse", "Brevo got the double opt-in with the nurse version");

// 2. English founding form for someone already subscribed.
brevoCalls.length = 0;
await page.goto(base + "/en/founding/");
await page.fill("#founding-email", "known@example.com");
await page.selectOption("#founding-role", "resident");
await page.fill("#founding-wish", "pacemakers");
await page.check("#founding-interview");
await page.check("#founding-consent");
await page.click('form[data-kind="founding"] button[type="submit"]');
await page.waitForSelector(".form-done:not([hidden])");
check((await page.textContent(".form-done-title")).includes("already on the list"), "EN founding form recognises an existing reader");
const put = brevoCalls.find((c) => c.method === "PUT");
check(put && put.body.attributes.FOUNDING === true && put.body.attributes.WISH === "pacemakers" && put.body.listIds.includes(4), "Brevo contact updated with the reservation");

// 3. Quiz reveals the answer.
await page.goto(base + "/");
if (await page.$(".quiz")) {
  await page.click('.quiz-option[data-index="0"]');
  check(await page.isVisible(".quiz-answer"), "quiz shows the explanation after an answer");
}
check(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
