/**
 * POST /api/subscribe — adds a reader to Brevo (Cloudflare Pages Function).
 *
 * Handles both forms on the site:
 *   kind=newsletter  the weekly email
 *   kind=founding    a founding-member reservation (also subscribes to the email)
 *
 * New addresses get Brevo's double opt-in email; they join the list only after
 * clicking the link, then land on /confirmat/ (or /en/confirmed/) with the guide.
 * Addresses already on the list are updated in place.
 *
 * Settings (Cloudflare Pages > Settings > Variables and secrets):
 *   BREVO_API_KEY            secret, from Brevo > SMTP & API > API keys
 *   BREVO_LIST_NEWSLETTER    list id of the weekly email list
 *   BREVO_LIST_FOUNDING      list id of the founding reservations list
 *   BREVO_DOI_TEMPLATE_RO    id of the Romanian double opt-in template
 *   BREVO_DOI_TEMPLATE_EN    id of the English double opt-in template
 */

const BREVO = "https://api.brevo.com/v3";
const ROLES = ["doctor", "resident", "student", "nurse", "paramedic", "other"];
const NURSE_ROLES = ["nurse", "paramedic"];
const CONFIRMED_PAGE = { ro: "/confirmat/", en: "/en/confirmed/" };
const THANKS_PAGE = { ro: "/multumim/", en: "/en/thanks/" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function onRequestPost({ request, env }) {
  // Off unless the sign-up is switched on (the free launch has no sign-up).
  if (env.SIGNUP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  return handle(request, env, fetch);
}

export async function handle(request, env, fetchImpl) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  let data;
  try {
    data = await readBody(request);
  } catch {
    return reply(wantsJson, 400, { ok: false, error: "server" });
  }
  const lang = data.lang === "en" ? "en" : "ro";
  const origin = new URL(request.url).origin;

  // Bots fill the hidden "website" field; pretend all is well.
  if (data.website) return reply(wantsJson, 200, { ok: true, status: "pending" }, origin + THANKS_PAGE[lang]);

  const email = String(data.email || "").trim().toLowerCase();
  const role = String(data.role || "");
  if (!EMAIL_RE.test(email) || email.length > 254) return reply(wantsJson, 400, { ok: false, error: "email" });
  if (!ROLES.includes(role)) return reply(wantsJson, 400, { ok: false, error: "role" });
  if (data.consent !== "yes" && data.consent !== true) return reply(wantsJson, 400, { ok: false, error: "consent" });

  const founding = data.kind === "founding";
  const missing = ["BREVO_API_KEY", "BREVO_LIST_NEWSLETTER", "BREVO_DOI_TEMPLATE_RO", "BREVO_DOI_TEMPLATE_EN"]
    .concat(founding ? ["BREVO_LIST_FOUNDING"] : [])
    .filter((k) => !env[k]);
  if (missing.length) {
    console.error("subscribe: missing settings " + missing.join(", "));
    return reply(wantsJson, 500, { ok: false, error: "server" });
  }

  const attributes = {
    LANGUAGE: lang,
    ROLE: role,
    EMAIL_VERSION: NURSE_ROLES.includes(role) ? "nurse" : "doctor",
    SIGNUP_SOURCE: founding ? "founding" : "website",
  };
  const firstName = String(data.first_name || "").trim().slice(0, 60);
  if (firstName) attributes.FIRSTNAME = firstName;
  if (founding) {
    attributes.FOUNDING = true;
    attributes.FOUNDING_PRICE = lang === "en" ? `EUR ${env.FOUNDING_PRICE_EUR || "39"}` : `RON ${env.FOUNDING_PRICE_RON || "199"}`;
    attributes.FOUNDING_DATE = new Date().toISOString().slice(0, 10);
    attributes.INTERVIEW = data.interview === "yes" || data.interview === true;
    const wish = String(data.wish || "").trim().slice(0, 500);
    if (wish) attributes.WISH = wish;
  }
  const listIds = [Number(env.BREVO_LIST_NEWSLETTER)];
  if (founding) listIds.push(Number(env.BREVO_LIST_FOUNDING));

  const headers = { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" };
  try {
    const existing = await fetchImpl(`${BREVO}/contacts/${encodeURIComponent(email)}`, { headers });
    if (existing.status === 200) {
      const contact = await existing.json();
      if (!contact.emailBlacklisted) {
        const res = await fetchImpl(`${BREVO}/contacts/${encodeURIComponent(email)}`, {
          method: "PUT", headers, body: JSON.stringify({ attributes, listIds }),
        });
        if (!res.ok) throw new Error(`update ${res.status} ${await res.text()}`);
        return reply(wantsJson, 200, { ok: true, status: "known" }, origin + THANKS_PAGE[lang]);
      }
      // Unsubscribed before: they must confirm again through double opt-in.
    } else if (existing.status !== 404) {
      throw new Error(`lookup ${existing.status} ${await existing.text()}`);
    }

    const res = await fetchImpl(`${BREVO}/contacts/doubleOptinConfirmation`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        attributes,
        includeListIds: listIds,
        templateId: Number(lang === "en" ? env.BREVO_DOI_TEMPLATE_EN : env.BREVO_DOI_TEMPLATE_RO),
        redirectionUrl: origin + CONFIRMED_PAGE[lang],
      }),
    });
    if (!res.ok) throw new Error(`double opt-in ${res.status} ${await res.text()}`);
    return reply(wantsJson, 200, { ok: true, status: "pending" }, origin + THANKS_PAGE[lang]);
  } catch (err) {
    console.error("subscribe: Brevo error: " + err.message);
    return reply(wantsJson, 502, { ok: false, error: "server" });
  }
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function reply(wantsJson, status, body, redirectTo) {
  if (!wantsJson && body.ok && redirectTo) {
    return new Response(null, { status: 303, headers: { location: redirectTo } });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
