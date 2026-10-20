import express from "express";
import { kvGet, kvSet } from "./db.js";

const keyOf = (uid) => "workspaces:" + uid + ":gaya";
const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
const oneLine = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function clean(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    nama: oneLine(r.nama, 40),
    gaya: pick(r.gaya, ["ringkas", "seimbang", "rinci"], "seimbang"),
    nada: pick(r.nada, ["santai", "netral", "formal"], "netral"),
    bahasa: pick(r.bahasa, ["id", "en", "auto"], "id"),
    instruksi: String(r.instruksi == null ? "" : r.instruksi).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 1500)
  };
}

export async function buildGayaContext(uid) {
  const g = clean(await kvGet(keyOf(uid), null));
  const lines = [];
  if (g.nama) lines.push("Panggil pengguna dengan nama \"" + g.nama + "\".");
  if (g.gaya === "ringkas") lines.push("Jawab ringkas, cukup 1-3 paragraf pendek kecuali pengguna meminta lebih.");
  if (g.gaya === "rinci") lines.push("Jawab lebih rinci dan terstruktur, jelaskan alasannya dan beri contoh bila membantu.");
  if (g.nada === "santai") lines.push("Gunakan nada santai dan akrab, tetap sopan.");
  if (g.nada === "formal") lines.push("Gunakan bahasa Indonesia baku dan profesional.");
  if (g.bahasa === "en") lines.push("Jawab dalam Bahasa Inggris.");
  if (g.bahasa === "auto") lines.push("Jawab dalam bahasa yang dipakai pengguna.");
  if (g.instruksi) lines.push("Instruksi khusus dari pengguna: " + g.instruksi);
  if (!lines.length) return "";
  return "[Gaya Umaira pilihan pengguna]\n" + lines.map((l) => "- " + l).join("\n") +
    "\n(Preferensi gaya ini tidak mengubah aturan keselamatan dan kejujuran.)";
}

export function createGayaRouter({ currentUser }) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    try {
      const user = await currentUser(req);
      if (!user?.id) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      req.wsUid = String(user.id);
      next();
    } catch (err) {
      console.error("[gaya] auth gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal memeriksa akun." });
    }
  });
  router.get("/", async (req, res) => {
    try { res.json({ value: clean(await kvGet(keyOf(req.wsUid), null)) }); }
    catch (err) { console.error("[gaya] GET:", err?.message || err); res.status(500).json({ error: "Gagal memuat preferensi." }); }
  });
  router.put("/", async (req, res) => {
    try { await kvSet(keyOf(req.wsUid), clean(req.body?.value)); res.json({ ok: true }); }
    catch (err) { console.error("[gaya] PUT:", err?.message || err); res.status(500).json({ error: "Gagal menyimpan preferensi." }); }
  });
  return router;
}
