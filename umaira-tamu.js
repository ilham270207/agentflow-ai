const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const win = new Map();
const glob = { day: "", n: 0 };

function bump(key, windowMs, max, now) {
  let b = win.get(key);
  if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; win.set(key, b); }
  b.n += 1;
  return b.n <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of win) if (b.reset < now) win.delete(k);
}, 10 * 60 * 1000).unref();

const LIMIT_MSG = "Batas pesan untuk tamu sudah tercapai. Masuk atau daftar gratis untuk melanjutkan obrolan dan membuka fitur lengkap Umaira.";
const FULL_MSG = "Layanan tamu sedang penuh hari ini. Masuk atau daftar gratis untuk tetap bisa mengobrol dengan Umaira.";

export function createGuestChatGate({ currentUser, requireAuth }) {
  return async (req, res, next) => {
    let user = null;
    try { user = await currentUser(req); } catch {}
    if (user) return requireAuth(req, res, next);
    if (String(process.env.GUEST_MODE || "").toLowerCase() === "off") {
      return res.status(401).json({ error: "Silakan login terlebih dahulu.", login: true });
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Permintaan tidak valid." });
    }
    const now = Date.now();
    const ip = String(req.ip || "unknown");
    const okIp =
      bump("10m:" + ip, 10 * 60 * 1000, num(process.env.GUEST_MSGS_PER_10MIN, 8), now) &&
      bump("1d:" + ip, 24 * 3600 * 1000, num(process.env.GUEST_MSGS_PER_DAY, 25), now);
    const today = new Date(now).toISOString().slice(0, 10);
    if (glob.day !== today) { glob.day = today; glob.n = 0; }
    if (!okIp || glob.n >= num(process.env.GUEST_GLOBAL_PER_DAY, 300)) {
      return res.json({ mode: "guest-limit", provider: "umaira", login: true, message: okIp ? FULL_MSG : LIMIT_MSG });
    }
    glob.n += 1;

    const msgs = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== "user" || !last.content.trim()) {
      return res.status(400).json({ error: "Pesan tidak valid." });
    }
    req.body = { messages: msgs, projectContext: "", attachments: [] };
    req.isGuest = true;
    next();
  };
}
