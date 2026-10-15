import express from "express";
import { kvGet, kvSet } from "./db.js";
import { buildPluginContext } from "./workspace-data.js";

const WIB = 7 * 3600 * 1000;
const MAX_TASKS = 10;
const GRACE_MS = 6 * 3600 * 1000;
const AI_TIMEOUT_MS = 90 * 1000;
const INDEX_KEY = "workspaces:sched-index";
const keyFor = (uid) => "workspaces:" + uid + ":scheduled";

class UserError extends Error {}

const locks = new Map();
function withLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(name, next);
  const done = () => { if (locks.get(name) === next) locks.delete(name); };
  next.then(done, done);
  return next;
}

/* ---------- hitung waktu berikutnya (WIB = UTC+7, tanpa DST) ---------- */
function computeNext(task, from) {
  if (task.type === "once") {
    const t = new Date(task.at + ":00+07:00");
    return Number.isNaN(t.getTime()) ? null : t;
  }
  const [H, M] = task.time.split(":").map(Number);
  const w = new Date(from.getTime() + WIB);
  const y = w.getUTCFullYear();
  const mo = w.getUTCMonth();
  const d = w.getUTCDate();
  for (let add = 0; add <= 7; add++) {
    const cand = new Date(Date.UTC(y, mo, d + add, H, M) - WIB);
    if (cand <= from) continue;
    if (task.type === "weekly") {
      const dow = new Date(Date.UTC(y, mo, d + add)).getUTCDay();
      if (dow !== task.weekday) continue;
    }
    return cand;
  }
  return null;
}

/* ---------- validasi dari browser; hasil/status milik server ---------- */
function sanitize(incoming, existing) {
  if (incoming.length > MAX_TASKS) throw new UserError("Maksimal " + MAX_TASKS + " tugas.");
  const prev = new Map(existing.map((t) => [t.id, t]));
  const sig = (t) => [t.type, t.at, t.time, t.weekday, t.enabled].join("|");
  const now = new Date();
  const out = [];
  for (const raw of incoming) {
    const id = String(raw?.id || "");
    if (!/^[\w-]{1,64}$/.test(id)) continue;
    const title = String(raw.title || "").trim().slice(0, 80);
    const prompt = String(raw.prompt || "").trim().slice(0, 2000);
    if (!title || !prompt) throw new UserError("Judul dan instruksi tugas wajib diisi.");
    const type = ["once", "daily", "weekly"].includes(raw.type) ? raw.type : "daily";
    const task = { id, title, prompt, type, enabled: raw.enabled !== false };
    if (type === "once") {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(raw.at || ""))) {
        throw new UserError("Tanggal dan jam tugas tidak valid.");
      }
      task.at = raw.at;
    } else {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.time || ""))) {
        throw new UserError("Jam tugas tidak valid.");
      }
      task.time = raw.time;
      if (type === "weekly") {
        const wd = Number(raw.weekday);
        if (!Number.isInteger(wd) || wd < 0 || wd > 6) throw new UserError("Hari tugas tidak valid.");
        task.weekday = wd;
      }
    }
    const old = prev.get(id);
    const same = Boolean(old) && sig(old) === sig(task);
    task.lastRun = old?.lastRun || null;
    task.lastStatus = old?.lastStatus || null;
    task.lastResult = old?.lastResult || "";
    task.runCount = old?.runCount || 0;
    task.unread = Boolean(old?.unread);
    task.nextRun = same ? old.nextRun || null : null;
    if (task.enabled && !same) {
      const n = computeNext(task, now);
      if (!n || n <= now) throw new UserError("Waktu tugas \"" + title + "\" sudah lewat. Pilih waktu yang akan datang.");
      task.nextRun = n.toISOString();
    }
    if (!task.enabled) task.nextRun = null;
    out.push(task);
  }
  return out;
}

async function updateIndex(uid, hasTasks) {
  await withLock("index", async () => {
    const idx = await kvGet(INDEX_KEY, []);
    const set = new Set(Array.isArray(idx) ? idx.map(String) : []);
    if (hasTasks) set.add(String(uid)); else set.delete(String(uid));
    await kvSet(INDEX_KEY, [...set]);
  });
}

/* ---------- eksekusi tugas ---------- */
const running = new Set();
const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error("Waktu habis (" + ms / 1000 + " detik).")), ms))
]);

async function runTask(uid, id, source) {
  const rk = uid + ":" + id;
  if (running.has(rk)) return null;
  running.add(rk);
  try {
    const tasks0 = await kvGet(keyFor(uid), []);
    const t0 = (Array.isArray(tasks0) ? tasks0 : []).find((x) => x.id === id);
    if (!t0) return null;

    let status = "ok";
    let text = "";
    try {
      const ai = globalThis.__umairaTryAIChat;
      if (typeof ai !== "function") throw new Error("Mesin AI belum siap.");
      const messages = [{ role: "user", content: "Tugas terjadwal \"" + t0.title + "\":\n" + t0.prompt }];
      const ctx = await buildPluginContext(uid, messages).catch(() => "");
      const result = await withTimeout(ai(messages, ctx, []), AI_TIMEOUT_MS);
      text = typeof result === "string" ? result : (result?.text || result?.content || JSON.stringify(result || ""));
      if (!String(text).trim()) throw new Error("AI mengembalikan jawaban kosong.");
    } catch (err) {
      status = "error";
      text = err?.message || "Gagal menjalankan tugas.";
    }

    return await withLock("u:" + uid, async () => {
      const tasks = await kvGet(keyFor(uid), []);
      const list = Array.isArray(tasks) ? tasks : [];
      const t = list.find((x) => x.id === id);
      if (!t) return null;
      const now = new Date();
      t.lastRun = now.toISOString();
      t.lastStatus = status;
      t.lastResult = String(text).slice(0, 4000);
      t.runCount = (t.runCount || 0) + 1;
      t.unread = true;
      if (source !== "manual") {
        if (t.type === "once") { t.enabled = false; t.nextRun = null; }
        else { const n = computeNext(t, now); t.nextRun = n ? n.toISOString() : null; }
      }
      await kvSet(keyFor(uid), list);
      return t;
    });
  } finally {
    running.delete(rk);
  }
}

async function skipMissed(uid, id) {
  await withLock("u:" + uid, async () => {
    const tasks = await kvGet(keyFor(uid), []);
    const list = Array.isArray(tasks) ? tasks : [];
    const t = list.find((x) => x.id === id);
    if (!t) return;
    const now = new Date();
    t.lastRun = now.toISOString();
    t.lastStatus = "terlewat";
    t.lastResult = "Jadwal terlewat karena server tidak aktif pada waktunya.";
    t.unread = true;
    if (t.type === "once") { t.enabled = false; t.nextRun = null; }
    else { const n = computeNext(t, now); t.nextRun = n ? n.toISOString() : null; }
    await kvSet(keyFor(uid), list);
  });
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const idx = await kvGet(INDEX_KEY, []);
    const uids = Array.isArray(idx) ? idx.map(String) : [];
    for (const uid of uids) {
      const tasks = await kvGet(keyFor(uid), []);
      for (const t of Array.isArray(tasks) ? tasks : []) {
        if (!t.enabled || !t.nextRun) continue;
        const due = new Date(t.nextRun).getTime();
        if (Number.isNaN(due) || due > Date.now()) continue;
        if (Date.now() - due > GRACE_MS) await skipMissed(uid, t.id);
        else await runTask(uid, t.id, "auto");
      }
    }
  } catch (err) {
    console.warn("[scheduler] tick gagal:", err?.message || err);
  } finally {
    ticking = false;
  }
}

let started = false;
export function startScheduler() {
  if (started) return;
  started = true;
  const first = setTimeout(tick, 5000);
  const loop = setInterval(tick, 30000);
  first.unref?.();
  loop.unref?.();
  console.log("[scheduler] aktif (cek tiap 30 detik)");
}

/* ---------- API ---------- */
export function createScheduledRouter({ currentUser }) {
  const router = express.Router();
  const lastManual = new Map();

  router.use(async (req, res, next) => {
    try {
      const user = await currentUser(req);
      if (!user?.id) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      req.wsUid = String(user.id);
      next();
    } catch (err) {
      console.error("[scheduled] auth gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal memeriksa akun." });
    }
  });

  const fail = (res, err, label) => {
    if (err instanceof UserError) return res.status(400).json({ error: err.message });
    console.error("[scheduled] " + label + ":", err?.message || err);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  };

  router.get("/", async (req, res) => {
    try {
      const tasks = await kvGet(keyFor(req.wsUid), []);
      res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
    } catch (err) { fail(res, err, "GET"); }
  });

  router.put("/", async (req, res) => {
    try {
      const incoming = req.body?.tasks;
      if (!Array.isArray(incoming)) return res.status(400).json({ error: "Data tidak valid." });
      const uid = req.wsUid;
      const saved = await withLock("u:" + uid, async () => {
        const existing = await kvGet(keyFor(uid), []);
        const tasks = sanitize(incoming, Array.isArray(existing) ? existing : []);
        await kvSet(keyFor(uid), tasks);
        return tasks;
      });
      await updateIndex(uid, saved.length > 0);
      res.json({ tasks: saved });
    } catch (err) { fail(res, err, "PUT"); }
  });

  router.post("/seen", async (req, res) => {
    try {
      const uid = req.wsUid;
      await withLock("u:" + uid, async () => {
        const tasks = await kvGet(keyFor(uid), []);
        const list = Array.isArray(tasks) ? tasks : [];
        if (!list.some((t) => t.unread)) return;
        list.forEach((t) => { t.unread = false; });
        await kvSet(keyFor(uid), list);
      });
      res.json({ ok: true });
    } catch (err) { fail(res, err, "seen"); }
  });

  router.post("/:id/run", async (req, res) => {
    try {
      const uid = req.wsUid;
      const last = lastManual.get(uid) || 0;
      if (Date.now() - last < 15000) {
        return res.status(429).json({ error: "Tunggu beberapa detik sebelum menjalankan lagi." });
      }
      lastManual.set(uid, Date.now());
      const task = await runTask(uid, String(req.params.id), "manual");
      if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan atau sedang berjalan." });
      res.json({ task });
    } catch (err) { fail(res, err, "run"); }
  });

  return router;
}
