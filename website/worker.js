// Cloudflare Worker entry (Workers with static assets). Serves website/dist and, while a test
// password is configured, asks every visitor for it (browser login box, any user name).
// Password: SITE_PASSWORD (a Secret set in the dashboard) or SITE_PASSWORD_SHA256 in wrangler.jsonc,
// the hex SHA-256 of "ecg-compass:" + password. Remove both to open the site to everyone.
import { checkPassword } from "./functions/_middleware.js";

const enc = new TextEncoder();

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function given(header) {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    return decoded.slice(decoded.indexOf(":") + 1);
  } catch (e) {
    return null;
  }
}

function sameHex(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function allowed(request, env) {
  const header = request.headers.get("Authorization");
  if (env.SITE_PASSWORD) return checkPassword(header, env.SITE_PASSWORD);
  if (env.SITE_PASSWORD_SHA256) {
    const pw = given(header);
    return pw !== null && sameHex(await sha256hex("ecg-compass:" + pw), env.SITE_PASSWORD_SHA256.toLowerCase());
  }
  return true;
}

export default {
  async fetch(request, env) {
    const locked = Boolean(env.SITE_PASSWORD || env.SITE_PASSWORD_SHA256);
    if (!(await allowed(request, env))) {
      return new Response("Password required / Este necesară parola", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="ECG Compass (test)", charset="UTF-8"',
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      });
    }
    const res = await env.ASSETS.fetch(request);
    if (!locked) return res;
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", "noindex");
    out.headers.set("Cache-Control", "private, no-store");
    return out;
  },
};
