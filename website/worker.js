// Cloudflare Worker entry (Workers with static assets). Serves website/dist and, while the
// SITE_PASSWORD variable is set in the Worker's settings, asks every visitor for that password.
import { checkPassword } from "./functions/_middleware.js";

export default {
  async fetch(request, env) {
    const password = env.SITE_PASSWORD;
    if (password && !checkPassword(request.headers.get("Authorization"), password)) {
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
    if (!password) return res;
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", "noindex");
    out.headers.set("Cache-Control", "private, no-store");
    return out;
  },
};
