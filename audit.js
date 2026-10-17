// audit.js - Log Aktivitas (Audit Log) Umaira AI  [UMAIRA AUDIT V2]
import { kvGet, kvSet } from "./db.js";

const KEY = "audit-log";
const MAX_ENTRIES = 5000;
const DAY = 24 * 60 * 60 * 1000;
const WIB = 7 * 60 * 60 * 1000;
const RANGES = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY };
let chain = Promise.resolve();

const clip = (v, n) =>
  String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);

export function parseUA(ua) {
  ua = String(ua || "");
  let device = "Desktop";
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = "Tablet";
  else if (/Mobi|iPhone|Android/i.test(ua)) device = "Mobile";
  let browser = "Lainnya";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\/|FxiOS/.test(ua)) browser = "Firefox";
  else if (/Chrome\/|CriOS/.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "Lainnya";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return { device, browser, os };
}

function ipOf(req) {
  const ip = (req && (req.ip || (req.socket && req.socket.remoteAddress))) || "";
  return clip(String(ip).replace(/^::ffff:/, ""), 64);
}

export function logAudit(req, e) {
  const ua = parseUA(req && req.headers && req.headers["user-agent"]);
  const rec = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    actorId: e.actorId || null,
    name: clip(e.name, 80),
    email: clip(e.email, 120).toLowerCase(),
    role: clip(e.role || "Pengguna", 30),
    action: clip(e.action, 40),
    module: clip(e.module || "Sistem", 40),
    status: clip(e.status || "sukses", 20),
    detail: clip(e.detail, 300),
    ip: ipOf(req),
    device: clip(e.device, 30) || ua.device,
    browser: clip(e.browser, 30) || ua.browser,
    os: clip(e.os, 30) || ua.os,
    before: e.before === undefined ? null : e.before,
    after: e.after === undefined ? null : e.after
  };
  chain = chain
    .then(async () => {
      const cur = await kvGet(KEY, []);
      const arr = Array.isArray(cur) ? cur : [];
      arr.push(rec);
      await kvSet(KEY, arr.length > MAX_ENTRIES ? arr.slice(-MAX_ENTRIES) : arr);
    })
    .catch((err) => console.error("[audit] gagal mencatat:", err && err.message ? err.message : err));
  return chain;
}

// ===== Log sistem (error server, database, AI) =====
const sysSeen = new Map();
let sysHour = { t: 0, n: 0 };

export function logSystem(module, message) {
  const msg = clip(message, 300);
  if (!msg) return Promise.resolve();
  const t = Date.now();
  const last = sysSeen.get(msg);
  if (last && t - last < 5 * 60 * 1000) return Promise.resolve();
  if (t - sysHour.t > 60 * 60 * 1000) sysHour = { t, n: 0 };
  if (sysHour.n >= 30) return Promise.resolve();
  sysHour.n++;
  if (sysSeen.size > 200) sysSeen.clear();
  sysSeen.set(msg, t);
  return logAudit(null, {
    name: "Server", role: "Sistem", action: "system_error", module: clip(module || "Server", 40),
    status: "gagal", detail: msg, device: "Server", browser: "-", os: "-"
  });
}

function installSystemHooks() {
  if (globalThis.__umairaAuditHooks) return;
  globalThis.__umairaAuditHooks = true;
  const orig = console.error.bind(console);
  let busy = false;
  console.error = function (...args) {
    orig(...args);
    if (busy) return;
    busy = true;
    try {
      const text = args
        .map((a) => (a && a.message ? a.message : typeof a === "string" ? a : ""))
        .join(" ")
        .trim();
      if (!text || text.startsWith("[audit]")) return;
      if (!/error|gagal|failed|exception|timeout|econn|enotfound|openrouter|gemini|horde|\[db\]/i.test(text)) return;
      let mod = "Server";
      if (/\[db\]|postgres|database/i.test(text)) mod = "Database";
      else if (/openrouter|gemini|horde/i.test(text)) mod = "AI";
      logSystem(mod, text);
    } catch {
      // abaikan
    } finally {
      busy = false;
    }
  };
  process.on("uncaughtExceptionMonitor", (err) => {
    try {
      logSystem("Server", "Crash: " + (err && err.message ? err.message : err));
    } catch {
      // abaikan
    }
  });
}
installSystemHooks();

// ===== Pencarian, statistik, grafik, peringatan =====
function filterList(list, { range, group, q }, now) {
  const span = RANGES[range];
  const needle = clip(q, 80).toLowerCase();
  const out = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (span && now - r.ts > span) continue;
    if (group === "login" && r.action !== "login") continue;
    if (group === "gagal" && (r.status === "sukses" || r.role === "Sistem")) continue;
    if (group === "password" && !String(r.action).startsWith("password")) continue;
    if (group === "hapus" && !["account_delete", "gallery_delete", "api_delete"].includes(r.action)) continue;
    if (group === "ubah" && !r.before && !r.after) continue;
    if (group === "sistem" && r.role !== "Sistem") continue;
    if (group === "fitur" && (r.module === "Autentikasi" || r.role === "Sistem")) continue;
    if (needle && !((r.name || "") + " " + (r.email || "") + " " + (r.ip || "")).toLowerCase().includes(needle)) continue;
    out.push(r);
  }
  return out;
}

function topOf(list, field) {
  const m = new Map();
  for (const r of list) {
    const k = r[field];
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, n]) => ({ key, n }));
}

function buildCharts(list, now, range) {
  const dayKey = (ts) => Math.floor((ts + WIB) / DAY);
  const today = dayKey(now);
  const days = [];
  for (let k = today - 6; k <= today; k++) {
    days.push({ k, d: new Date(k * DAY).toISOString().slice(0, 10), total: 0, failed: 0 });
  }
  for (const r of list) {
    const x = days[dayKey(r.ts) - (today - 6)];
    if (!x) continue;
    x.total++;
    if (r.status !== "sukses" && r.role !== "Sistem") x.failed++;
  }
  const span = RANGES[range];
  const inRange = span ? list.filter((r) => now - r.ts <= span) : list;
  return {
    days: days.map(({ d, total, failed }) => ({ d, total, failed })),
    topActions: topOf(inRange, "action"),
    topModules: topOf(inRange, "module")
  };
}

function bruteAlerts(list, now) {
  const WIN = 10 * 60 * 1000;
  const groups = new Map();
  for (const r of list) {
    if (r.action !== "login" || r.status === "sukses" || now - r.ts > DAY) continue;
    for (const k of [r.email ? "email:" + r.email : "", r.ip ? "ip:" + r.ip : ""]) {
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r.ts);
    }
  }
  const out = [];
  for (const [k, ts] of groups) {
    ts.sort((a, b) => a - b);
    let best = 0, bestEnd = 0, j = 0;
    for (let i = 0; i < ts.length; i++) {
      while (ts[i] - ts[j] > WIN) j++;
      const c = i - j + 1;
      if (c >= best) { best = c; bestEnd = ts[i]; }
    }
    if (best >= 5) {
      const at = k.indexOf(":");
      out.push({ by: k.slice(0, at), key: k.slice(at + 1), count: best, last: bestEnd });
    }
  }
  out.sort((a, b) => b.last - a.last);
  return out.slice(0, 5);
}

export async function listAudit({ range = "7d", group = "all", q = "", limit = 50, offset = 0 } = {}) {
  const cur = await kvGet(KEY, []);
  const list = Array.isArray(cur) ? cur : [];
  const now = Date.now();
  const stats = { total24h: 0, logins24h: 0, failed24h: 0, system24h: 0 };
  for (const r of list) {
    if (now - r.ts <= DAY) {
      stats.total24h++;
      if (r.role === "Sistem") stats.system24h++;
      else if (r.status !== "sukses") stats.failed24h++;
      if (r.action === "login" && r.status === "sukses") stats.logins24h++;
    }
  }
  const out = filterList(list, { range, group, q }, now);
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);
  return {
    total: out.length,
    items: out.slice(off, off + lim),
    stats,
    charts: buildCharts(list, now, range),
    alerts: bruteAlerts(list, now),
    serverTime: now
  };
}

export async function exportAuditCsv({ range = "7d", group = "all", q = "" } = {}) {
  const cur = await kvGet(KEY, []);
  const list = Array.isArray(cur) ? cur : [];
  const rows = filterList(list, { range, group, q }, Date.now());
  const head = ["Waktu (WIB)", "Nama", "Email", "Role", "Aksi", "Modul", "Status", "Detail", "IP", "Perangkat", "OS", "Browser", "Nilai lama", "Nilai baru"];
  const cell = (v) => {
    let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    lines.push([
      new Date(r.ts + WIB).toISOString().replace("T", " ").slice(0, 19),
      r.name, r.email, r.role, r.action, r.module, r.status, r.detail,
      r.ip, r.device, r.os, r.browser, r.before, r.after
    ].map(cell).join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

// ===== Pencatatan otomatis rute autentikasi =====
const MAP = {
  "/login": { action: "login", detail: "Email dan password" },
  "/google": { action: "login", detail: "Google" },
  "/register": { action: "register", detail: "Pendaftaran akun" },
  "/logout": { action: "logout", detail: "", needSession: true },
  "/forgot-password": { action: "password_forgot", detail: "Kode OTP diminta" },
  "/reset-password": { action: "password_reset", detail: "Password direset dengan OTP" },
  "/change-password/request": { action: "password_change_request", detail: "Kode OTP ganti password diminta", needSession: true },
  "/change-password/confirm": { action: "password_change", detail: "Password diganti", needSession: true },
  "/delete-account": { action: "account_delete", detail: "Akun dihapus", needSession: true }
};

const adminEmail = () => String(process.env.ADMIN_EMAIL || "__tidak-ada-admin__").trim().toLowerCase();

// Nilai lama / nilai baru: kolom rahasia tidak pernah disimpan, hanya ditandai "diperbarui".
const SECRET = /salt|hash|secret|token|otp|code|password|sub$/i;
const IGNORE = /^(last|updated|seen)|(At|Ts)$/;
const BIGKEY = /photo|avatar|image|picture|foto|gambar/i;
const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DIFF_ACTIONS = new Set(["register", "password_reset", "password_change", "account_delete"]);
const QUIET = /presence|heartbeat|ping|online|active|status|typing|seen/i;

function show(k, v, side) {
  if (v === undefined || v === null || v === "") return "(kosong)";
  if (SECRET.test(k)) return side === "b" ? "(tersembunyi)" : "(diperbarui)";
  if (BIGKEY.test(k) || typeof v === "object") return side === "b" ? "(data lama)" : "(data baru)";
  const s = String(v);
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

function changes(b, a) {
  const bo = {}, ao = {};
  const keys = new Set([...Object.keys(b || {}), ...Object.keys(a || {})]);
  for (const k of keys) {
    if (k === "id" || IGNORE.test(k)) continue;
    const bv = b ? b[k] : undefined;
    const av = a ? a[k] : undefined;
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    if ((!b || !a) && SECRET.test(k)) continue;
    const label = SECRET.test(k) ? "kredensial" : k;
    bo[label] = b ? show(k, bv, "b") : "(tidak ada)";
    ao[label] = a ? show(k, av, "a") : "(dihapus)";
  }
  const fields = Object.keys(bo);
  if (!fields.length) return null;
  return { before: b ? bo : null, after: a ? ao : null, fields };
}

function findUser(users, id, email) {
  if (!Array.isArray(users)) return null;
  const e = String(email || "").trim().toLowerCase();
  return users.find((u) => (id && u.id === id) || (e && String(u.email || "").toLowerCase() === e)) || null;
}

export function auditAuthMiddleware({ currentUser, readUsers }) {
  async function attach(req, res) {
    if (req.method === "GET") {
      const av = adminViewSpec(req);
      if (av) await attachAdminView(req, res, av, currentUser);
      return;
    }
    const spec = req.method === "POST" ? MAP[req.path] || null : null;
    if (!spec && (!WRITE.has(req.method) || QUIET.test(req.path))) return;
    let sess = null;
    if (!spec || spec.needSession) {
      try { sess = await currentUser(req); } catch {}
    }
    if (!spec && !(sess && sess.email)) return;

    const wantDiff = !spec || DIFF_ACTIONS.has(spec.action);
    let beforeRec = null;
    if (wantDiff) {
      try {
        const users = await readUsers();
        const e0 = req.body && typeof req.body.email === "string" ? req.body.email : "";
        const f = findUser(users, sess && sess.id, (sess && sess.email) || e0);
        beforeRec = f ? JSON.parse(JSON.stringify(f)) : null;
      } catch {}
    }

    let captured = null;
    const origJson = res.json.bind(res);
    res.json = (body) => { captured = body; return origJson(body); };
    res.on("finish", async () => {
      try {
        const code = res.statusCode;
        const ok = code < 400;
        const status = ok ? "sukses" : code === 429 ? "dibatasi" : "gagal";
        let id = null, name = "", email = "";
        const cu = captured && (captured.user || captured.account);
        const b = req.body || {};
        if (sess && sess.email) { id = sess.id; name = sess.name; email = sess.email; }
        else if (cu && cu.email) { id = cu.id || null; name = cu.name; email = cu.email; }
        else if (typeof b.email === "string") email = b.email;
        email = String(email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+$/.test(email)) email = "";
        if (email && !name) {
          try {
            const users = await readUsers();
            const f = users.find((x) => String(x.email || "").toLowerCase() === email);
            if (f) { id = id || f.id; name = f.name; }
          } catch {}
        }
        let ch = null;
        if (wantDiff && ok) {
          try {
            const users = await readUsers();
            const afterRec = findUser(users, id || (beforeRec && beforeRec.id), email);
            ch = changes(beforeRec, afterRec);
          } catch {}
        }
        const role = email && email === adminEmail() ? "Admin" : "Pengguna";
        if (spec) {
          const err = captured && captured.error ? String(captured.error) : "HTTP " + code;
          const detail = ok ? spec.detail : (spec.detail ? spec.detail + " - " : "") + err;
          await logAudit(req, {
            actorId: id, name, email, role,
            action: spec.action, module: "Autentikasi", status, detail,
            before: ch ? ch.before : undefined, after: ch ? ch.after : undefined
          });
        } else if (ok && ch) {
          await logAudit(req, {
            actorId: id, name, email, role,
            action: "profile_update", module: "Autentikasi", status: "sukses",
            detail: req.method + " " + req.path + " - mengubah: " + ch.fields.join(", "),
            before: ch.before, after: ch.after
          });
        }
      } catch (e) {
        console.error("[audit] middleware:", e && e.message ? e.message : e);
      }
    });
  }

  return async function auditAuth(req, res, next) {
    try {
      await attach(req, res);
    } catch (e) {
      console.error("[audit] middleware:", e && e.message ? e.message : e);
    }
    next();
  };
}

// ===== UMAIRA AUDIT V3: pencatatan fitur di luar akun (gambar, Pustaka, chat, tugas, workspace) =====
const QUIET_API = /presence|heartbeat|\/ping\b|typing/i;
const API_MODULES = [
  ["/workspaces", "Workspace"],
  ["/wsdata/scheduled", "Tugas terjadwal"],
  ["/wsdata/files", "File"],
  ["/wsdata/chats", "Riwayat chat"],
  ["/wsdata", "Data workspace"],
  ["/chat-images", "Gambar chat"]
];
const API_VERBS = {
  POST: ["api_create", "Menambah data"],
  PUT: ["api_update", "Mengubah data"],
  PATCH: ["api_update", "Mengubah data"],
  DELETE: ["api_delete", "Menghapus data"]
};

function classifyApi(method, p) {
  if (method === "POST") {
    if (p === "/chat") return { action: "chat_message", module: "Chat", detail: "Pesan dikirim ke AI", throttle: true };
    if (p === "/chat-action") return { action: "chat_action", module: "Chat", detail: "Aksi chat", throttle: true };
    if (p === "/images/generate") return { action: "image_generate", module: "Gambar", detail: "Membuat gambar dari prompt", img: true };
    if (p === "/gallery/save") return { action: "gallery_save", module: "Pustaka", detail: "Menyimpan gambar ke Pustaka" };
    if (p === "/edit-task") return { action: "task_edit", module: "Tugas", detail: "Mengubah tugas" };
    if (p === "/regenerate-task") return { action: "task_regenerate", module: "Tugas", detail: "Membuat ulang tugas" };
    if (p === "/plan") return { action: "task_plan", module: "Tugas", detail: "Membuat rencana tugas" };
  }
  if (method === "DELETE" && /^\/gallery\/[^/]+$/.test(p)) {
    return { action: "gallery_delete", module: "Pustaka", detail: "Menghapus gambar dari Pustaka", delId: p.split("/")[2] };
  }
  const v = API_VERBS[method];
  if (!v) return null;
  let mod = "API";
  for (const [prefix, name] of API_MODULES) {
    if (p === prefix || p.startsWith(prefix + "/")) { mod = name; break; }
  }
  return { action: v[0], module: mod, detail: v[1] + " (" + method + " " + clip(p, 80) + ")" };
}

export function auditApiMiddleware({ currentUser }) {
  const lastSeen = new Map();

  async function attach(req, res) {
    const p = req.path || "/";
    if (!WRITE.has(req.method) || p.startsWith("/auth") || QUIET_API.test(p)) return;
    const spec = classifyApi(req.method, p);
    if (!spec) return;
    let sess = null;
    try { sess = await currentUser(req); } catch {}
    if (!sess || !sess.email) return;

    let captured = null;
    const origJson = res.json.bind(res);
    res.json = (body) => { captured = body; return origJson(body); };
    res.on("finish", async () => {
      try {
        const code = res.statusCode;
        const ok = code < 400;
        const status = ok ? "sukses" : code === 429 ? "dibatasi" : "gagal";
        if (spec.throttle && ok) {
          const k = String(sess.id) + ":" + spec.action;
          const t = Date.now();
          if (t - (lastSeen.get(k) || 0) < 5 * 60 * 1000) return;
          if (lastSeen.size > 500) lastSeen.clear();
          lastSeen.set(k, t);
        }
        let detail = spec.detail;
        if (spec.img) {
          const b = req.body || {};
          const bits = [];
          if (typeof b.prompt === "string") bits.push("prompt " + b.prompt.length + " karakter");
          if (typeof b.style === "string" && b.style) bits.push("gaya: " + clip(b.style, 40));
          if (bits.length) detail += " (" + bits.join(", ") + ")";
        }
        if (!ok) detail += " - " + (captured && captured.error ? clip(captured.error, 120) : "HTTP " + code);
        const email = String(sess.email).trim().toLowerCase();
        await logAudit(req, {
          actorId: sess.id, name: sess.name, email,
          role: email === adminEmail() ? "Admin" : "Pengguna",
          action: spec.action, module: spec.module, status, detail,
          before: spec.delId ? { id: clip(spec.delId, 80) } : undefined,
          after: spec.delId && ok ? { id: "(dihapus)" } : undefined
        });
      } catch (e) {
        console.error("[audit] api middleware:", e && e.message ? e.message : e);
      }
    });
  }

  return async function auditApi(req, res, next) {
    try {
      await attach(req, res);
    } catch (e) {
      console.error("[audit] api middleware:", e && e.message ? e.message : e);
    }
    next();
  };
}

// ===== UMAIRA AUDIT V4: aksi admin (daftar pengguna, ekspor CSV, akses ditolak) dan server dimulai =====
const adminSeen = new Map();

function adminViewSpec(req) {
  const p = req.path;
  if (p === "/admin/users") {
    return { action: "admin_view_users", detail: "Membuka daftar pengguna", throttle: 30 * 60 * 1000 };
  }
  if (p === "/admin/audit" && req.query && String(req.query.format || "") === "csv") {
    return { action: "admin_export", detail: "Mengekspor log aktivitas (CSV)", throttle: 0 };
  }
  return null;
}

async function attachAdminView(req, res, av, currentUser) {
  let sess = null;
  try { sess = await currentUser(req); } catch {}
  res.on("finish", async () => {
    try {
      const code = res.statusCode;
      const ok = code < 400;
      const email = String((sess && sess.email) || "").trim().toLowerCase();
      const t = Date.now();
      const gap = ok ? av.throttle : 5 * 60 * 1000;
      if (gap) {
        const key = (ok ? av.action : "admin_denied") + ":" + (email || ipOf(req));
        if (t - (adminSeen.get(key) || 0) < gap) return;
        if (adminSeen.size > 300) adminSeen.clear();
        adminSeen.set(key, t);
      }
      await logAudit(req, {
        actorId: sess && sess.id, name: sess && sess.name, email,
        role: email && email === adminEmail() ? "Admin" : "Pengguna",
        action: ok ? av.action : "admin_denied", module: "Admin",
        status: ok ? "sukses" : "gagal",
        detail: ok ? av.detail : "Akses ditolak: " + av.detail + " (HTTP " + code + ")"
      });
    } catch (e) {
      console.error("[audit] admin view:", e && e.message ? e.message : e);
    }
  });
}

if (!process.env.UMAIRA_AUDIT_NOSTART && !globalThis.__umairaAuditStart) {
  globalThis.__umairaAuditStart = true;
  const startTimer = setTimeout(() => {
    logAudit(null, {
      name: "Server", role: "Sistem", action: "server_start", module: "Server", status: "sukses",
      detail: "Server dimulai (Node " + process.version + ")", device: "Server", browser: "-", os: "-"
    });
  }, 3000);
  if (startTimer.unref) startTimer.unref();
}
