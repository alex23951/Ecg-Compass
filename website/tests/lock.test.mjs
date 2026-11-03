import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest, checkPassword } from "../functions/_middleware.js";

const ok = () => new Response("page", { status: 200 });
const req = (auth) => new Request("https://x.test/", { headers: auth ? { Authorization: auth } : {} });
const basic = (u, p) => "Basic " + btoa(`${u}:${p}`);

test("no password set: site is open", async () => {
  const r = await onRequest({ request: req(), env: {}, next: ok });
  assert.equal(r.status, 200);
});
test("password set: asks for it", async () => {
  const r = await onRequest({ request: req(), env: { SITE_PASSWORD: "s3cret" }, next: ok });
  assert.equal(r.status, 401);
  assert.match(r.headers.get("WWW-Authenticate"), /Basic/);
});
test("wrong password refused, right one let in with noindex", async () => {
  const env = { SITE_PASSWORD: "s3cret" };
  assert.equal((await onRequest({ request: req(basic("a", "nope")), env, next: ok })).status, 401);
  const r = await onRequest({ request: req(basic("anyone", "s3cret")), env, next: ok });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("X-Robots-Tag"), "noindex");
});
test("password with a colon works", () => {
  assert.ok(checkPassword(basic("u", "a:b"), "a:b"));
});
