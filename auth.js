import express from "express";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { otpEmail } from "./mailer.js";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import * as fsSync from "node:fs";
import { OAuth2Client } from "google-auth-library";
import { kvGet, kvSet, usingDb, fileDelete } from "./db.js";

const router = express.Router();

// ===== UMAIRA RATE LIMIT =====
const rlStore = new Map();
function rlGuard(name, max, windowMs, countAll) {
  return (req, res, next) => {
    if (req.method !== "POST") return next();
    const key = name + "|" + (req.ip || (req.socket && req.socket.remoteAddress) || "?");
    const now = Date.now();
    let e = rlStore.get(key);
    if (!e || e.reset < now) { e = { n: 0, reset: now + windowMs }; rlStore.set(key, e); }
    if (e.n >= max) {
      res.setHeader("Retry-After", String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." });
    }
    e.n++;
    res.on("finish", () => { if (!countAll && res.statusCode < 400) e.n = Math.max(0, e.n - 1); });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rlStore) if (v.reset < now) rlStore.delete(k);
}, 10 * 60 * 1000).unref();


// ===== UMAIRA AUTH HARDENING =====
const rateBuckets = new Map();
function rateHit(key, max, windowMs) {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.reset < now) {
    rateBuckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) if (b.reset < now) rateBuckets.delete(k);
}, 10 * 60 * 1000).unref();

const AUTH_LIMITS = {
  "/login": [10, 10 * 60 * 1000],
  "/register": [5, 60 * 60 * 1000],
  "/google": [20, 10 * 60 * 1000],
  "/forgot-password": [5, 15 * 60 * 1000],
  "/reset-password": [10, 15 * 60 * 1000]
};
function authLimiter(req, res, next) {
  if (req.method !== "POST") return next();
  const rule = AUTH_LIMITS[req.path];
  if (!rule) return next();
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || "x";
  const tooMany = () => res.status(429).json({
    error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."
  });
  if (!rateHit(ip + req.path, rule[0], rule[1])) return tooMany();
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (req.path === "/login" && email && !rateHit("email:" + email, 15, 15 * 60 * 1000)) return tooMany();
  next();
}
router.use(authLimiter);

const scrypt = promisify(crypto.scrypt);
const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "umaira-users.json");
const SESSIONS_FILE = path.join(dataDir, "umaira-sessions.json");
const sessionKey = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const SESSIONS_BOOT = await kvGet("sessions", {}).catch((err) => {
  if (usingDb) throw err;
  return {};
});
const sessions = (() => {
  const map = new Map();
  try {
    const raw = SESSIONS_BOOT && typeof SESSIONS_BOOT === "object" ? SESSIONS_BOOT : {};
    const now = Date.now();
    for (const [k, v] of Object.entries(raw)) {
      if (v && v.expires > now) map.set(k, v);
    }
  } catch {}
  let timer = null;
  function persist() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      kvSet("sessions", Object.fromEntries(map)).catch((err) => {
        console.error("Gagal menyimpan sesi:", err.message);
      });
    }, 500);
  }
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [k, v] of map) {
      if (v.expires < now) { map.delete(k); changed = true; }
    }
    if (changed) persist();
  }, 60 * 60 * 1000).unref();
  return {
    get: (token) => map.get(sessionKey(token)),
    set: (token, value) => { map.set(sessionKey(token), value); persist(); },
    delete: (token) => { if (map.delete(sessionKey(token))) persist(); },
    deleteByUser: (userId) => {
      let changed = false;
      for (const [k, v] of map) {
        if (v.userId === userId) { map.delete(k); changed = true; }
      }
      if (changed) persist();
    }
  };
})();
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
  "139250142631-4coe0opo9ie1616h45j27125uqdsduek.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

async function readUsers() {
  const users = await kvGet("users", []);
  return Array.isArray(users) ? users : [];
}

async function saveUsers(users) {
  await kvSet("users", users);
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString("hex") };
}

async function verifyPassword(password, user) {
  const actual = await scrypt(password, user.salt, 64);
  const expected = Buffer.from(user.hash, "hex");
  return actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected);
}

function cookieToken(req) {
  const entry = (req.headers.cookie || "").split(";")
    .map(v => v.trim()).find(v => v.startsWith("umaira_session="));
  return entry ? decodeURIComponent(entry.slice("umaira_session=".length)) : "";
}

function setCookie(res, token, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie",
    `umaira_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

// ===== UMAIRA PRESENCE =====
let presenceReady = true;
const presence = await kvGet("presence", {})
  .then((v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}))
  .catch((err) => {
    presenceReady = false;
    console.error("[presence] gagal membaca, pelacakan dimatikan:", err.message);
    return {};
  });
let presenceTimer = null;
function persistPresence() {
  if (!presenceReady || presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    kvSet("presence", presence).catch((err) => console.error("[presence] gagal menyimpan:", err.message));
  }, 30000);
}
if (presenceReady && !presence.__meta) {
  presence.__meta = { seededAt: Date.now() };
  for (const u of await readUsers().catch(() => [])) {
    if (u && u.id && !presence[u.id]) presence[u.id] = { firstSeen: null, lastSeen: 0 };
  }
  persistPresence();
}
function touchPresence(userId) {
  if (!presenceReady || !userId) return;
  const now = Date.now();
  const p = presence[userId];
  if (!p) {
    presence[userId] = { firstSeen: now, lastSeen: now };
    persistPresence();
    return;
  }
  if (now - (p.lastSeen || 0) < 20000) return;
  p.lastSeen = now;
  persistPresence();
}
// ===== END UMAIRA PRESENCE =====

async function currentUser(req) {
  const token = cookieToken(req);
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const user = (await readUsers()).find(u => u.id === session.userId);
  if (user) touchPresence(user.id);
  return user ? { id: user.id, name: user.name, email: user.email, picture: user.picture || "", hasPassword: Boolean(user.salt && user.hash) } : null;
}


// ===== UMAIRA ADMIN USER DIRECTORY =====
const ADMIN_EMAIL = String(
  process.env.ADMIN_EMAIL || "danham322@gmail.com"
).trim().toLowerCase();

router.get("/admin/users", async (req, res) => {
  try {
    const sessionUser = await currentUser(req);

    if (!sessionUser) {
      return res.status(401).json({
        error: "Silakan login terlebih dahulu."
      });
    }

    if (String(sessionUser.email || "").trim().toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({
        error: "Akses khusus administrator."
      });
    }

    const users = await readUsers();
    const adminAccount = users.find((u) => u.id === sessionUser.id);

    if (
      !adminAccount ||
      !adminAccount.googleSub ||
      String(adminAccount.email || "").trim().toLowerCase() !== ADMIN_EMAIL
    ) {
      return res.status(403).json({
        error: "Admin wajib login dengan Google terverifikasi untuk email administrator."
      });
    }

    res.setHeader("Cache-Control", "no-store");
    const nowTs = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const rows = users.map((u) => {
      const p = presence[u.id] || {};
      const lastSeen = p.lastSeen || null;
      const firstSeen = p.firstSeen || null;
      return {
        name: String(u.name || "Pengguna"),
        email: String(u.email || ""),
        loginMethod: u.googleSub
          ? "Google"
          : (u.hash && u.salt ? "Email dan password" : "Akun"),
        lastSeen,
        firstSeen,
        online: Boolean(lastSeen && nowTs - lastSeen < 150 * 1000)
      };
    });
    rows.sort((a, b) => (Number(b.online) - Number(a.online)) || ((b.lastSeen || 0) - (a.lastSeen || 0)));
    return res.json({
      total: users.length,
      online: rows.filter((r) => r.online).length,
      activeToday: rows.filter((r) => r.lastSeen && nowTs - r.lastSeen < DAY).length,
      active7d: rows.filter((r) => r.lastSeen && nowTs - r.lastSeen < 7 * DAY).length,
      newThisWeek: rows.filter((r) => r.firstSeen && nowTs - r.firstSeen < 7 * DAY).length,
      serverTime: nowTs,
      users: rows
    });
  } catch (err) {
    console.error("Admin users error:", err?.message || err);
    return res.status(500).json({
      error: "Gagal memuat daftar pengguna."
    });
  }
});
// ===== END UMAIRA ADMIN USER DIRECTORY =====

router.get("/me", async (req, res) => {
  try {
    res.json({ user: await currentUser(req) });
  } catch {
    res.status(500).json({ error: "Gagal membaca status akun." });
  }
});

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 60);
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Nama atau email tidak valid." });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Kata sandi harus 8–128 karakter." });
    }
    const users = await readUsers();
    if (users.some(u => u.email === email)) {
      return res.status(409).json({ error: "Email sudah terdaftar." });
    }
    const { salt, hash } = await hashPassword(password);
    const user = { id: crypto.randomUUID(), name, email, salt, hash };
    users.push(user);
    await saveUsers(users);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_MS });
    setCookie(res, token, SESSION_MS / 1000);
    res.status(201).json({ user: { id: user.id, name, email } });
  } catch {
    res.status(500).json({ error: "Pendaftaran gagal. Periksa penyimpanan server." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = (await readUsers()).find(u => u.email === email);
    if (!user || !user.salt || !user.hash || !(await verifyPassword(password, user))) {
      return res.status(401).json({ error: "Email atau kata sandi salah." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_MS });
    setCookie(res, token, SESSION_MS / 1000);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch {
    res.status(500).json({ error: "Login gagal. Coba lagi." });
  }
});


router.get("/google/config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

router.post("/google", async (req, res) => {
  try {
    const credential = String(req.body?.credential || "");
    if (!credential || credential.length > 12000) {
      return res.status(400).json({ error: "Kredensial Google tidak valid." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({
        error: "Email Google belum terverifikasi."
      });
    }

    const email = payload.email.trim().toLowerCase();
    const googleSub = payload.sub;
    const users = await readUsers();
    let user = users.find(u => u.googleSub === googleSub);

    if (!user) {
      user = users.find(u => u.email === email);

      if (user) {
        if (user.googleSub && user.googleSub !== googleSub) {
          return res.status(409).json({
            error: "Email ini sudah terhubung ke akun Google lain."
          });
        }
        user.googleSub = googleSub;
        if (user.hash) {
          delete user.hash;
          delete user.salt;
          sessions.deleteByUser(user.id);
        }
        if (!user.name && payload.name) {
          user.name = String(payload.name).trim().slice(0, 60);
        }
      } else {
        user = {
          id: crypto.randomUUID(),
          name: String(payload.name || email.split("@")[0]).trim().slice(0, 60),
          email,
          googleSub
        };
        users.push(user);
      }

      await saveUsers(users);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const pic = typeof payload.picture === "string" && /^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(payload.picture)
      ? payload.picture.slice(0, 500) : "";
    if (pic && user.picture !== pic) {
      user.picture = pic;
      await saveUsers(users);
    }

    
sessions.set(token, {
      userId: user.id,
      expires: Date.now() + SESSION_MS
    });
    setCookie(res, token, SESSION_MS / 1000);

    res.json({
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("Google sign-in verification failed:", err.message);
    res.status(401).json({
      error: "Login Google gagal diverifikasi. Silakan coba lagi."
    });
  }
});


/* ===== UMAIRA EMAIL OTP / PASSWORD RESET ===== */
const otpTransport = (() => {
  const user = String(process.env.MAIL_USER || process.env.SMTP_USER || "").trim();
  const pass = String(process.env.MAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s/g, "");
  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass }
  });
})();

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

async function readPasswordOtps() {
  const data = await kvGet("passwordResetOtps", {});
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Masukkan alamat email yang valid." });
    }

    if (!otpTransport) {
      return res.status(503).json({ error: "Layanan email belum dikonfigurasi." });
    }

    const users = await readUsers();
    const user = users.find(u => u.email === email && u.salt && u.hash);

    // Respons sama agar endpoint tidak membocorkan keberadaan akun.
    if (!user) {
      return res.json({ success: true, message: "Jika akun memenuhi syarat, kode akan dikirim ke email tersebut." });
    }

    const otps = await readPasswordOtps();
    const prevOtp = otps[email];
    const nowMs = Date.now();
    const genericOk = { success: true, message: "Jika akun memenuhi syarat, kode akan dikirim ke email tersebut." };
    if (prevOtp && prevOtp.sentAt && nowMs - prevOtp.sentAt < 60 * 1000) return res.json(genericOk);
    let windowStart = nowMs;
    let sendCount = 0;
    if (prevOtp && prevOtp.windowStart && nowMs - prevOtp.windowStart < 3600 * 1000) { windowStart = prevOtp.windowStart; sendCount = prevOtp.sendCount || 0; }
    if (sendCount >= 5) return res.json(genericOk);
    for (const k of Object.keys(otps)) { if (k !== email && otps[k] && otps[k].expires <= nowMs) delete otps[k]; }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const codeHash = crypto.createHash("sha256").update(email + ":" + code).digest("hex");

    otps[email] = {
      userId: user.id,
      codeHash,
      expires: Date.now() + OTP_TTL_MS,
      attempts: 0,
      sentAt: nowMs,
      windowStart,
      sendCount: sendCount + 1
    };
    await kvSet("passwordResetOtps", otps);

    try {
      await otpTransport.sendMail({
        from: otpFromAddress(),
        to: email,
        ...otpEmail({ code, purpose: "reset", minutes: OTP_TTL_MS / 60000 })
      });
    } catch (err) {
      delete otps[email];
      await kvSet("passwordResetOtps", otps);
      console.error("Gagal mengirim email OTP:", err.message);
      return res.status(502).json({ error: "Email OTP gagal dikirim. Periksa konfigurasi email." });
    }

    return res.json({ success: true, message: "Jika akun memenuhi syarat, kode akan dikirim ke email tersebut." });
  } catch (err) {
    console.error("Permintaan OTP gagal:", err.message);
    return res.status(500).json({ error: "Permintaan OTP gagal. Coba lagi." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.otp || "").trim();
    const password = String(req.body?.newPassword || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !/^\d{6}$/.test(code) ||
        password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: "Email, OTP 6 digit, atau kata sandi baru tidak valid. Kata sandi harus 8–128 karakter."
      });
    }

    const otps = await readPasswordOtps();
    const record = otps[email];

    if (!record || record.expires <= Date.now() ||
        record.attempts >= OTP_MAX_ATTEMPTS) {
      if (record) {
        delete otps[email];
        await kvSet("passwordResetOtps", otps);
      }
      return res.status(400).json({ error: "OTP tidak valid atau sudah kedaluwarsa. Minta kode baru." });
    }

    const submittedHash = crypto.createHash("sha256").update(email + ":" + code).digest();
    const expectedHash = Buffer.from(record.codeHash, "hex");
    const valid = expectedHash.length === submittedHash.length &&
      crypto.timingSafeEqual(expectedHash, submittedHash);

    if (!valid) {
      record.attempts += 1;
      if (record.attempts >= OTP_MAX_ATTEMPTS) delete otps[email];
      await kvSet("passwordResetOtps", otps);
      return res.status(400).json({ error: "OTP tidak valid atau sudah kedaluwarsa. Minta kode baru." });
    }

    const users = await readUsers();
    const user = users.find(u => u.id === record.userId && u.email === email);
    if (!user) {
      delete otps[email];
      await kvSet("passwordResetOtps", otps);
      return res.status(400).json({ error: "Akun tidak ditemukan. Minta kode baru." });
    }

    const { salt, hash } = await hashPassword(password);
    user.salt = salt;
    user.hash = hash;
    await saveUsers(users);

    // Konsumsi OTP dan batalkan sesi lama setelah reset berhasil.
    delete otps[email];
    await kvSet("passwordResetOtps", otps);
    sessions.deleteByUser(user.id);

    return res.json({ success: true, message: "Kata sandi berhasil diubah. Silakan login kembali." });
  } catch (err) {
    console.error("Reset kata sandi gagal:", err.message);
    return res.status(500).json({ error: "Reset kata sandi gagal. Coba lagi." });
  }
});

/* ===== UMAIRA CHANGE PASSWORD (login + OTP email) ===== */
async function readChangeOtps() {
  const data = await kvGet("passwordChangeOtps", {});
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

const otpFromAddress = () => process.env.SMTP_FROM ||
  ('"' + String(process.env.MAIL_FROM_NAME || "Umaira AI").replace(/["<>\r\n]/g, "") + '" <' +
    (process.env.MAIL_USER || process.env.SMTP_USER) + ">");

router.post("/change-password/request", rlGuard("change-pw-request", 5, 15 * 60 * 1000, true), async (req, res) => {
  try {
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
    if (!otpTransport) return res.status(503).json({ error: "Layanan email belum dikonfigurasi." });

    const users = await readUsers();
    const user = users.find(u => u.id === me.id);
    if (!user || !user.salt || !user.hash) {
      return res.status(400).json({ error: "Akun ini masuk lewat Google dan tidak memakai kata sandi." });
    }
    const current = String(req.body?.currentPassword || "");
    if (!current || !(await verifyPassword(current, user))) {
      return res.status(400).json({ error: "Kata sandi saat ini salah." });
    }

    const otps = await readChangeOtps();
    const nowMs = Date.now();
    const prev = otps[user.id];
    if (prev && prev.sentAt && nowMs - prev.sentAt < 60 * 1000) {
      return res.status(429).json({ error: "Tunggu 1 menit sebelum meminta kode lagi." });
    }
    let windowStart = nowMs;
    let sendCount = 0;
    if (prev && prev.windowStart && nowMs - prev.windowStart < 3600 * 1000) {
      windowStart = prev.windowStart;
      sendCount = prev.sendCount || 0;
    }
    if (sendCount >= 5) {
      return res.status(429).json({ error: "Terlalu banyak permintaan kode. Coba lagi dalam 1 jam." });
    }
    for (const k of Object.keys(otps)) {
      if (k !== user.id && otps[k] && otps[k].expires <= nowMs) delete otps[k];
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    otps[user.id] = {
      codeHash: crypto.createHash("sha256").update(user.id + ":" + code).digest("hex"),
      expires: nowMs + OTP_TTL_MS,
      attempts: 0,
      sentAt: nowMs,
      windowStart,
      sendCount: sendCount + 1
    };
    await kvSet("passwordChangeOtps", otps);

    try {
      const msg = otpEmail({ code, purpose: "ganti", minutes: OTP_TTL_MS / 60000 });
      await otpTransport.sendMail({ from: otpFromAddress(), to: user.email, subject: msg.subject, text: msg.text, html: msg.html, attachments: msg.attachments });
    } catch (err) {
      delete otps[user.id];
      await kvSet("passwordChangeOtps", otps);
      console.error("Gagal mengirim email OTP ganti kata sandi:", err.message);
      return res.status(502).json({ error: "Email OTP gagal dikirim. Coba lagi nanti." });
    }

    const parts = user.email.split("@");
    return res.json({ success: true, message: "Kode dikirim ke " + parts[0].slice(0, 2) + "***@" + parts[1] + "." });
  } catch (err) {
    console.error("Permintaan OTP ganti kata sandi gagal:", err.message);
    return res.status(500).json({ error: "Permintaan kode gagal. Coba lagi." });
  }
});

router.post("/change-password/confirm", rlGuard("change-pw-confirm", 10, 15 * 60 * 1000, true), async (req, res) => {
  try {
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ error: "Silakan login terlebih dahulu." });

    const code = String(req.body?.otp || "").trim();
    const password = String(req.body?.newPassword || "");
    if (!/^\d{6}$/.test(code) || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Kode 6 digit atau kata sandi baru tidak valid. Kata sandi harus 8–128 karakter." });
    }

    const otps = await readChangeOtps();
    const record = otps[me.id];
    const invalidMsg = "Kode tidak valid atau sudah kedaluwarsa. Minta kode baru.";
    if (!record || record.expires <= Date.now() || record.attempts >= OTP_MAX_ATTEMPTS) {
      if (record) { delete otps[me.id]; await kvSet("passwordChangeOtps", otps); }
      return res.status(400).json({ error: invalidMsg });
    }

    const submitted = crypto.createHash("sha256").update(me.id + ":" + code).digest();
    const expected = Buffer.from(record.codeHash, "hex");
    const valid = expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);
    if (!valid) {
      record.attempts += 1;
      if (record.attempts >= OTP_MAX_ATTEMPTS) delete otps[me.id];
      await kvSet("passwordChangeOtps", otps);
      return res.status(400).json({ error: invalidMsg });
    }

    const users = await readUsers();
    const user = users.find(u => u.id === me.id);
    if (!user || !user.salt || !user.hash) {
      return res.status(400).json({ error: "Akun ini tidak memakai kata sandi." });
    }
    if (await verifyPassword(password, user)) {
      return res.status(400).json({ error: "Kata sandi baru harus berbeda dari yang lama." });
    }

    const { salt, hash } = await hashPassword(password);
    user.salt = salt;
    user.hash = hash;
    await saveUsers(users);

    delete otps[me.id];
    await kvSet("passwordChangeOtps", otps);
    sessions.deleteByUser(user.id);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_MS });
    setCookie(res, token, SESSION_MS / 1000);

    return res.json({ success: true, message: "Kata sandi berhasil diubah. Perangkat lain sudah dikeluarkan." });
  } catch (err) {
    console.error("Ganti kata sandi gagal:", err.message);
    return res.status(500).json({ error: "Ganti kata sandi gagal. Coba lagi." });
  }
});

router.post("/logout", (req, res) => {
  sessions.delete(cookieToken(req));
  setCookie(res, "", 0);
  res.json({ success: true });
});

// ===== UMAIRA DELETE ACCOUNT =====
router.post("/delete-account", rlGuard("delete-account", 5, 15 * 60 * 1000, true), async (req, res) => {
  try {
    const me = await currentUser(req);
    if (!me) {
      return res.status(401).json({ error: "Silakan login terlebih dahulu." });
    }
    if (req.body?.confirm !== "HAPUS") {
      return res.status(400).json({ error: "Ketik HAPUS untuk mengonfirmasi." });
    }
    const proof = typeof req.body?.proof === "string" ? req.body.proof.slice(0, 200) : "";
    if (!proof.trim()) {
      return res.status(400).json({ error: "Kata sandi atau email konfirmasi wajib diisi." });
    }

    const users = await readUsers();
    const user = users.find(u => u.id === me.id);
    if (!user) {
      return res.status(404).json({ error: "Akun tidak ditemukan." });
    }

    let verified = false;
    if (user.salt && user.hash) {
      verified = await verifyPassword(proof, user);
    } else {
      verified = proof.trim().toLowerCase() === String(user.email || "").toLowerCase();
    }
    if (!verified) {
      return res.status(403).json({ error: "Kata sandi atau email konfirmasi tidak cocok." });
    }

    const legacyOwner = users[0] && users[0].id;
    const stored = await kvGet("gallery-index", []);
    const gallery = Array.isArray(stored) ? stored : [];
    const owns = entry => (entry.userId || legacyOwner) === user.id;

    let failed = 0;
    for (const entry of gallery.filter(owns)) {
      const base = path.basename(String(entry.file || ""));
      if (!base) continue;
      try {
        await fileDelete("gallery/" + base);
      } catch (err) {
        if (!err || err.code !== "ENOENT") {
          failed += 1;
          console.error("Hapus akun: gagal hapus file galeri:", err && err.message);
        }
      }
    }
    if (failed > 0) {
      return res.status(500).json({ error: "Sebagian gambar gagal dihapus. Akun belum dihapus, silakan coba lagi." });
    }

    await kvSet("gallery-index", gallery.filter(entry => !owns(entry)));
    await saveUsers(users.filter(u => u.id !== user.id));
    sessions.deleteByUser(user.id);
    setCookie(res, "", 0);
    return res.json({ success: true });
  } catch (err) {
    console.error("Hapus akun error:", err && err.message);
    return res.status(500).json({ error: "Gagal menghapus akun. Silakan coba lagi." });
  }
});
// ===== /UMAIRA DELETE ACCOUNT =====

export { router as authRouter };

export { currentUser };

export async function requireAuth(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) {
      return res.status(401).json({ error: "Silakan login terlebih dahulu.", login: true });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("requireAuth error:", err.message);
    res.status(500).json({ error: "Gagal memeriksa sesi." });
  }
}

export function originGuard(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (new URL(origin).host === req.headers.host || allowed.includes(origin)) return next();
  } catch {}
  return res.status(403).json({ error: "Asal permintaan tidak diizinkan." });
}
