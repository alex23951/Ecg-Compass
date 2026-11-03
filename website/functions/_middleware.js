// Test lock: while SITE_PASSWORD is set in the Cloudflare Pages settings, every page asks for a
// password (browser login box, any user name). Remove the variable to open the site to everyone.
// Nothing is stored; the browser remembers the login until it is closed.
// Works when the site is deployed from GitHub or with Wrangler (not with dashboard drag-and-drop).

const enc = new TextEncoder();

function same(a, b) {
  // Constant-time comparison so the password can't be guessed by timing.
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export function checkPassword(header, password) {
  if (!header || !header.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch (e) {
    return false;
  }
  const given = decoded.slice(decoded.indexOf(":") + 1);
  return same(given, password);
}

export async function onRequest({ request, env, next }) {
  const password = env.SITE_PASSWORD;
  if (!password) return next();
  if (!checkPassword(request.headers.get("Authorization"), password)) {
    return new Response("Password required / Este necesară parola", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="ECG Compass (test)", charset="UTF-8"',
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  }
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex"); // keep test pages out of Google
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
