import express from "express";
import crypto from "node:crypto";
import { kvGet, kvSet } from "./db.js";

const MAX_CONVS = 60;
const MAX_MSGS = 300;
const MAX_MSG_JSON = 100000;
const MAX_CONV_JSON = 600000;
const MAX_TOTAL_JSON = 4000000;
const keyFor = (uid) => "workspaces:" + uid + ":chats";
const prevKeyFor = (uid) => "workspaces:" + uid + ":chats-prev";
const ownerToken = (uid) => crypto.createHash("sha256").update(String(uid)).digest("hex").slice(0, 16);

const locks = new Map();
function withLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(name, next);
  const done = () => { if (locks.get(name) === next) locks.delete(name); };
  next.then(done, done);
  return next;
}

function cleanMsg(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  let msg = JSON.parse(JSON.stringify(m));
  if (typeof msg.content === "string") msg.content = msg.content.slice(0, 60000);
  if (JSON.stringify(msg).length > MAX_MSG_JSON) {
    msg = { role: String(m.role || "user").slice(0, 20), content: String(m.content || "").slice(0, 30000) };
  }
  return msg;
}

function cleanConv(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = String(raw.id || "");
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const now = Date.now();
  const num = (v, d) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
  const messages = (Array.isArray(raw.messages) ? raw.messages : []).slice(-MAX_MSGS).map(cleanMsg).filter(Boolean);
  const base = {
    ...raw,
    id,
    title: String(raw.title || "").slice(0, 200),
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
    messages
  };
  if (raw.archived) base.archived = true; else delete base.archived;
  let conv = base;
  if (JSON.stringify(conv).length > MAX_CONV_JSON) {
    conv = {
      id, title: base.title, createdAt: base.createdAt, updatedAt: base.updatedAt, messages,
      ...(base.archived ? { archived: true } : {})
    };
  }
  while (conv.messages.length > 1 && JSON.stringify(conv).length > MAX_CONV_JSON) {
    conv.messages = conv.messages.slice(Math.ceil(conv.messages.length / 4));
  }
  return conv;
}

export function createChatsRouter({ currentUser }) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    try {
      const user = await currentUser(req);
      if (!user?.id) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      req.wsUid = String(user.id);
      next();
    } catch (err) {
      console.error("[chats] auth gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal memeriksa akun." });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const stored = await kvGet(keyFor(req.wsUid), null);
      res.json({
        owner: ownerToken(req.wsUid),
        version: Number(stored?.version) || 0,
        items: Array.isArray(stored?.items) ? stored.items : []
      });
    } catch (err) {
      console.error("[chats] GET:", err?.message || err);
      res.status(500).json({ error: "Gagal memuat riwayat obrolan." });
    }
  });

  router.put("/", async (req, res) => {
    try {
      const incoming = req.body?.items;
      if (!Array.isArray(incoming)) return res.status(400).json({ error: "Data tidak valid." });
      const items = [];
      const seen = new Set();
      for (const raw of incoming.slice(0, MAX_CONVS)) {
        const c = cleanConv(raw);
        if (c && !seen.has(c.id)) { seen.add(c.id); items.push(c); }
      }
      if (JSON.stringify(items).length > MAX_TOTAL_JSON) {
        return res.status(413).json({ error: "Riwayat obrolan terlalu besar." });
      }
      const uid = req.wsUid;
      const result = await withLock("u:" + uid, async () => {
        const stored = await kvGet(keyFor(uid), null);
        const version = Number(stored?.version) || 0;
        if (Number(req.body?.baseVersion) !== version) return { conflict: true, version };
        const oldCount = Array.isArray(stored?.items) ? stored.items.length : 0;
        if (oldCount >= 6 && items.length < oldCount / 2) await kvSet(prevKeyFor(uid), stored);
        await kvSet(keyFor(uid), { version: version + 1, items });
        return { conflict: false, version: version + 1 };
      });
      if (result.conflict) return res.status(409).json({ error: "Versi berubah.", version: result.version });
      res.json({ ok: true, version: result.version });
    } catch (err) {
      console.error("[chats] PUT:", err?.message || err);
      res.status(500).json({ error: "Gagal menyimpan riwayat obrolan." });
    }
  });

  return router;
}
