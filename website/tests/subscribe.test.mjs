// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../functions/api/subscribe.js";

const ENV = {
  BREVO_API_KEY: "key", BREVO_LIST_NEWSLETTER: "3", BREVO_LIST_FOUNDING: "4",
  BREVO_DOI_TEMPLATE_RO: "11", BREVO_DOI_TEMPLATE_EN: "12",
};

function req(body, { json = true } = {}) {
  return new Request("https://site.test/api/subscribe", {
    method: "POST",
    headers: json
      ? { "content-type": "application/json", accept: "application/json" }
      : { "content-type": "application/x-www-form-urlencoded" },
    body: json ? JSON.stringify(body) : new URLSearchParams(body).toString(),
  });
}

function fakeBrevo(existing) {
  const calls = [];
  const impl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    if (!opts.method) {
      return existing
        ? new Response(JSON.stringify(existing), { status: 200 })
        : new Response("{}", { status: 404 });
    }
    return new Response(null, { status: opts.method === "PUT" ? 204 : 201 });
  };
  return { impl, calls };
}

const base = { email: "Ana@Example.ro", role: "nurse", consent: "yes", lang: "ro", kind: "newsletter" };

test("new reader gets the double opt-in email in their language", async () => {
  const b = fakeBrevo(null);
  const res = await handle(req(base), ENV, b.impl);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, status: "pending" });
  const doi = b.calls[1];
  assert.match(doi.url, /doubleOptinConfirmation$/);
  assert.equal(doi.body.email, "ana@example.ro");
  assert.equal(doi.body.templateId, 11);
  assert.deepEqual(doi.body.includeListIds, [3]);
  assert.equal(doi.body.redirectionUrl, "https://site.test/confirmat/");
  assert.equal(doi.body.attributes.EMAIL_VERSION, "nurse");
});

test("founding reservation joins both lists with its details", async () => {
  const b = fakeBrevo(null);
  const body = { ...base, kind: "founding", lang: "en", role: "resident", interview: "yes", wish: "pacing" };
  const res = await handle(req(body), ENV, b.impl);
  assert.equal(res.status, 200);
  const doi = b.calls[1];
  assert.deepEqual(doi.body.includeListIds, [3, 4]);
  assert.equal(doi.body.templateId, 12);
  assert.equal(doi.body.redirectionUrl, "https://site.test/en/confirmed/");
  assert.equal(doi.body.attributes.FOUNDING, true);
  assert.equal(doi.body.attributes.INTERVIEW, true);
  assert.equal(doi.body.attributes.WISH, "pacing");
  assert.equal(doi.body.attributes.FOUNDING_PRICE, "EUR 39");
  assert.equal(doi.body.attributes.EMAIL_VERSION, "doctor");
});

test("someone already subscribed is updated, not re-confirmed", async () => {
  const b = fakeBrevo({ email: "ana@example.ro", emailBlacklisted: false });
  const res = await handle(req({ ...base, kind: "founding" }), ENV, b.impl);
  assert.deepEqual(await res.json(), { ok: true, status: "known" });
  assert.equal(b.calls[1].method, "PUT");
  assert.deepEqual(b.calls[1].body.listIds, [3, 4]);
});

test("someone who unsubscribed must confirm again", async () => {
  const b = fakeBrevo({ email: "ana@example.ro", emailBlacklisted: true });
  const res = await handle(req(base), ENV, b.impl);
  assert.deepEqual(await res.json(), { ok: true, status: "pending" });
  assert.match(b.calls[1].url, /doubleOptinConfirmation$/);
});

test("bad input is refused before calling Brevo", async () => {
  for (const [patch, error] of [[{ email: "nope" }, "email"], [{ role: "" }, "role"], [{ consent: "" }, "consent"]]) {
    const b = fakeBrevo(null);
    const res = await handle(req({ ...base, ...patch }), ENV, b.impl);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { ok: false, error });
    assert.equal(b.calls.length, 0);
  }
});

test("bots filling the hidden field are ignored quietly", async () => {
  const b = fakeBrevo(null);
  const res = await handle(req({ ...base, website: "spam.example" }), ENV, b.impl);
  assert.equal(res.status, 200);
  assert.equal(b.calls.length, 0);
});

test("a plain form post without JavaScript is redirected to the thank-you page", async () => {
  const b = fakeBrevo(null);
  const res = await handle(req(base, { json: false }), ENV, b.impl);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "https://site.test/multumim/");
});

test("missing settings give a clear server error", async () => {
  const b = fakeBrevo(null);
  const res = await handle(req(base), { ...ENV, BREVO_API_KEY: "" }, b.impl);
  assert.equal(res.status, 500);
  assert.equal(b.calls.length, 0);
});

test("a Brevo failure is reported as a server error", async () => {
  const impl = async () => new Response("boom", { status: 500 });
  const res = await handle(req(base), ENV, impl);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false, error: "server" });
});
