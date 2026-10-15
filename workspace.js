import express from "express";
import { kvGet, kvSet } from "./db.js";

const MAX_ITEMS = 50;
const locks = new Map();

function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  const cleanup = () => { if (locks.get(key) === next) locks.delete(key); };
  next.then(cleanup, cleanup);
  return next;
}

function iso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function cleanItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const name = String(raw.name || "").trim().slice(0, 120);
  if (!name) return null;
  return {
    id,
    name,
    description: String(raw.description || "").slice(0, 2000),
    notes: String(raw.notes ?? raw.content ?? "").slice(0, 20000),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt)
  };
}

export function createWorkspaceRouter({ currentUser }) {
  const router = express.Router();

  async function keyFor(req, res) {
    const user = await currentUser(req);
    if (!user?.id) {
      res.status(401).json({ error: "Silakan login terlebih dahulu." });
      return null;
    }
    return "workspaces:" + user.id;
  }

  router.get("/", async (req, res) => {
    try {
      const key = await keyFor(req, res);
      if (!key) return;
      const stored = await kvGet(key, null);
      res.json({
        initialized: Array.isArray(stored),
        items: Array.isArray(stored) ? stored : []
      });
    } catch (err) {
      console.error("[workspace] GET gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal memuat workspace." });
    }
  });

  router.put("/", async (req, res) => {
    try {
      const key = await keyFor(req, res);
      if (!key) return;
      const raw = req.body?.items;
      if (!Array.isArray(raw)) return res.status(400).json({ error: "Format data tidak valid." });
      if (raw.length > MAX_ITEMS) {
        return res.status(400).json({ error: "Maksimal " + MAX_ITEMS + " proyek." });
      }
      const seen = new Set();
      const items = [];
      for (const r of raw) {
        const item = cleanItem(r);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
      await withLock(key, () => kvSet(key, items));
      res.json({ ok: true, count: items.length });
    } catch (err) {
      console.error("[workspace] PUT gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal menyimpan workspace." });
    }
  });

  return router;
}
