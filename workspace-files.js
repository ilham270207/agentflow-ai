import express from "express";
import { kvGet, kvSet } from "./db.js";

const MAX_FILES = 20;
const MAX_FILE_CHARS = 200000;
const MAX_TOTAL_CHARS = 600000;
const MAX_ACTIVE = 5;
const CTX_BUDGET = 2000;
const keyFor = (uid) => "workspaces:" + uid + ":files";
const toList = (v) => (Array.isArray(v) ? v : []);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const locks = new Map();
function withLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(name, next);
  const done = () => { if (locks.get(name) === next) locks.delete(name); };
  next.then(done, done);
  return next;
}

const summary = (f) => ({
  id: f.id,
  name: f.name,
  size: f.content.length,
  inChat: Boolean(f.inChat),
  createdAt: f.createdAt
});

/* ---------- konteks untuk /api/chat: ambil potongan paling relevan ---------- */
function chunkText(content) {
  const chunks = [];
  let cur = "";
  for (const line of String(content).split("\n")) {
    if (cur && cur.length + line.length > 700) { chunks.push(cur); cur = ""; }
    cur += (cur ? "\n" : "") + line;
    if (cur.length > 1200) { chunks.push(cur.slice(0, 1200)); cur = ""; }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export async function buildFileContext(uid, messages) {
  const files = toList(await kvGet(keyFor(uid), [])).filter((f) => f.inChat);
  if (!files.length) return "";
  const last = Array.isArray(messages) && messages.length ? messages[messages.length - 1] : null;
  const words = [...new Set(String(last?.content || "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])].slice(0, 30);
  const score = (t) => { const l = t.toLowerCase(); return words.filter((w) => l.includes(w)).length; };

  const all = [];
  files.forEach((f, fi) => {
    chunkText(f.content).forEach((text, idx) => all.push({ fi, name: f.name, idx, text, score: score(text) }));
  });
  const anyScore = all.some((c) => c.score > 0);
  const ranked = [...all].sort((a, b) =>
    anyScore ? (b.score - a.score || a.fi - b.fi || a.idx - b.idx) : (a.fi - b.fi || a.idx - b.idx));

  let used = 0;
  const picked = [];
  for (const c of ranked) {
    if (used + c.text.length <= CTX_BUDGET) { picked.push(c); used += c.text.length; }
    else if (!picked.length) { picked.push({ ...c, text: c.text.slice(0, CTX_BUDGET) }); break; }
  }
  if (!picked.length) return "";
  picked.sort((a, b) => a.fi - b.fi || a.idx - b.idx);

  const out = ["[Berkas Pustaka aktif - kutipan yang relevan dengan pertanyaan]"];
  let curFile = -1;
  for (const c of picked) {
    if (c.fi !== curFile) { out.push("# " + c.name); curFile = c.fi; }
    out.push(c.text);
  }
  return out.join("\n");
}

/* ---------- API ---------- */
export function createFilesRouter({ currentUser }) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    try {
      const user = await currentUser(req);
      if (!user?.id) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      req.wsUid = String(user.id);
      next();
    } catch (err) {
      console.error("[files] auth gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal memeriksa akun." });
    }
  });

  const fail = (res, err, label) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error("[files] " + label + ":", err?.message || err);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  };

  router.get("/", async (req, res) => {
    try {
      const list = toList(await kvGet(keyFor(req.wsUid), []));
      res.json({
        files: list.map(summary),
        usage: {
          chars: list.reduce((s, f) => s + f.content.length, 0),
          maxChars: MAX_TOTAL_CHARS,
          count: list.length,
          maxFiles: MAX_FILES,
          maxFileChars: MAX_FILE_CHARS,
          maxActive: MAX_ACTIVE
        }
      });
    } catch (err) { fail(res, err, "GET"); }
  });

  router.post("/", async (req, res) => {
    try {
      const name = String(req.body?.name || "").split(/[\\/]/).pop().trim().slice(0, 120);
      const content = typeof req.body?.content === "string" ? req.body.content.replace(/\r\n/g, "\n") : "";
      if (!name) throw new HttpError(400, "Nama file tidak valid.");
      if (!content.trim()) throw new HttpError(400, "File kosong.");
      if (content.includes("\u0000")) throw new HttpError(400, "File bukan teks.");
      if (content.length > MAX_FILE_CHARS) throw new HttpError(413, "Maksimal " + MAX_FILE_CHARS.toLocaleString("id-ID") + " karakter per file.");
      const uid = req.wsUid;
      const saved = await withLock("u:" + uid, async () => {
        const list = toList(await kvGet(keyFor(uid), []));
        if (list.length >= MAX_FILES) throw new HttpError(400, "Maksimal " + MAX_FILES + " file. Hapus file lama dulu.");
        const total = list.reduce((s, f) => s + f.content.length, 0);
        if (total + content.length > MAX_TOTAL_CHARS) throw new HttpError(413, "Penyimpanan berkas penuh. Hapus file lama dulu.");
        const f = {
          id: "file-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name, content, inChat: false, createdAt: new Date().toISOString()
        };
        list.unshift(f);
        await kvSet(keyFor(uid), list);
        return f;
      });
      res.json({ file: summary(saved) });
    } catch (err) { fail(res, err, "POST"); }
  });

  router.get("/:id", async (req, res) => {
    try {
      const f = toList(await kvGet(keyFor(req.wsUid), [])).find((x) => x.id === req.params.id);
      if (!f) throw new HttpError(404, "File tidak ditemukan.");
      res.json({ name: f.name, content: f.content });
    } catch (err) { fail(res, err, "GET id"); }
  });

  router.patch("/:id/chat", async (req, res) => {
    try {
      const uid = req.wsUid;
      const want = Boolean(req.body?.inChat);
      const file = await withLock("u:" + uid, async () => {
        const list = toList(await kvGet(keyFor(uid), []));
        const f = list.find((x) => x.id === req.params.id);
        if (!f) throw new HttpError(404, "File tidak ditemukan.");
        if (want && !f.inChat && list.filter((x) => x.inChat).length >= MAX_ACTIVE) {
          throw new HttpError(400, "Maksimal " + MAX_ACTIVE + " file aktif di Obrolan.");
        }
        f.inChat = want;
        await kvSet(keyFor(uid), list);
        return f;
      });
      res.json({ file: summary(file) });
    } catch (err) { fail(res, err, "PATCH"); }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const uid = req.wsUid;
      await withLock("u:" + uid, async () => {
        const list = toList(await kvGet(keyFor(uid), []));
        await kvSet(keyFor(uid), list.filter((x) => x.id !== req.params.id));
      });
      res.json({ ok: true });
    } catch (err) { fail(res, err, "DELETE"); }
  });

  return router;
}
