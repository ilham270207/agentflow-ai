import express from "express";
import { kvGet, kvSet } from "./db.js";

export const PLUGIN_CATALOG = [
  { id: "guru", name: "Mode Guru", description: "Umaira membimbing dengan pertanyaan balik dan petunjuk bertahap, bukan langsung memberi jawaban." },
  { id: "santai", name: "Gaya Santai", description: "Umaira menjawab akrab dan ringan, seperti ngobrol dengan teman." },
  { id: "langkah", name: "Langkah demi Langkah", description: "Jawaban disusun berurutan dan bernomor supaya mudah diikuti." },
  { id: "jujur", name: "Jujur dan Teliti", description: "Umaira mengakui jika tidak yakin dan tidak mengarang fakta, angka, atau sumber." },
  { id: "terjemah", name: "Penerjemah Otomatis", description: "Jika kamu menulis dalam bahasa lain, jawaban ditambah terjemahan Indonesia." },
  { id: "kreatif", name: "Mode Kreatif", description: "Umaira memberi beberapa ide berbeda dan sudut pandang yang tidak biasa." },
  { id: "waktu", name: "Waktu & Tanggal", description: "Umaira tahu tanggal dan jam saat ini (WIB), jadi jawaban soal waktu akurat." },
  { id: "kalkulator", name: "Kalkulator", description: "Hitungan di pesanmu dihitung server dengan tepat, lalu hasilnya diberikan ke AI." },
  { id: "ringkas", name: "Jawaban Ringkas", description: "AI menjawab singkat dan langsung ke inti." },
  { id: "formal", name: "Bahasa Formal", description: "AI memakai bahasa Indonesia baku dan profesional." },
  { id: "pengembang", name: "Mode Pengembang", description: "Jawaban teknis dengan langkah jelas dan contoh kode." }
];
const PLUGIN_IDS = new Set(PLUGIN_CATALOG.map((p) => p.id));
const keyOf = (uid, mod) => "workspaces:" + uid + ":" + mod;
const MAX_BYTES = 400000;

function iso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/* ---------- kalkulator aman ---------- */
function parseNumber(raw) {
  let s = String(raw).replace(/[.,]+$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function evaluate(expr) {
  const tokens = expr.match(/\d[\d.,]*|[-+*\/^()]/g);
  if (!tokens) throw new Error("kosong");
  let i = 0;
  const peek = () => tokens[i];
  function primary() {
    const t = tokens[i++];
    if (t === undefined) throw new Error("ujung");
    if (t === "(") {
      const v = add();
      if (tokens[i++] !== ")") throw new Error("kurung");
      return v;
    }
    if (t === "-") return -primary();
    if (t === "+") return primary();
    const n = parseNumber(t);
    if (Number.isNaN(n)) throw new Error("angka");
    return n;
  }
  function power() {
    const b = primary();
    if (peek() === "^") { i++; return Math.pow(b, power()); }
    return b;
  }
  function mul() {
    let v = power();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[i++];
      const r = power();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function add() {
    let v = mul();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[i++];
      const r = mul();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const result = add();
  if (i !== tokens.length) throw new Error("sisa");
  return result;
}

const CALC_RE = /\(?\d[\d.,]*\)?(?:(?:\s*[+*\/x×÷^]\s*|\s+-\s+)\(?\d[\d.,]*\)?)+/g;

function calcLines(text) {
  const out = [];
  for (const m of String(text || "").matchAll(CALC_RE)) {
    const raw = m[0].trim();
    if (/^\d+(\s*\/\s*\d+){2}$/.test(raw)) continue; // kemungkinan tanggal
    try {
      const value = evaluate(raw.replace(/[x×]/g, "*").replace(/÷/g, "/"));
      if (!Number.isFinite(value)) continue;
      out.push(raw + " = " + value.toLocaleString("id-ID", { maximumFractionDigits: 8 }));
    } catch { /* abaikan ekspresi yang tidak valid */ }
    if (out.length >= 3) break;
  }
  return out;
}

/* ---------- konteks plugin untuk /api/chat ---------- */
export async function buildPluginContext(uid, messages) {
  const stored = await kvGet(keyOf(uid, "plugins"), null);
  const enabled = new Set(
    Array.isArray(stored?.enabled) ? stored.enabled.filter((id) => PLUGIN_IDS.has(id)) : []
  );
  if (!enabled.size) return "";
  const lines = [];
  if (enabled.has("waktu")) {
    const now = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta"
    }).format(new Date());
    lines.push("Waktu sekarang: " + now + " WIB.");
  }
  if (enabled.has("kalkulator") && Array.isArray(messages) && messages.length) {
    const last = messages[messages.length - 1];
    const results = calcLines(last?.content);
    if (results.length) {
      lines.push("Hasil hitung akurat (dihitung server, pakai angka ini): " + results.join("; ") + ".");
    }
  }
  if (enabled.has("ringkas")) lines.push("Jawab dengan ringkas dan langsung ke inti.");
  if (enabled.has("formal")) lines.push("Gunakan bahasa Indonesia baku, sopan, dan profesional.");
  if (enabled.has("pengembang")) lines.push("Jawab secara teknis, beri langkah yang jelas dan contoh kode bila relevan.");
  if (enabled.has("guru")) lines.push("Bertindaklah sebagai guru: ajukan satu pertanyaan pemantik dan beri petunjuk bertahap sebelum memberi jawaban penuh.");
  if (enabled.has("santai")) lines.push("Gunakan gaya santai dan akrab, kalimat pendek, tetap sopan.");
  if (enabled.has("langkah")) lines.push("Susun jawaban sebagai langkah bernomor yang berurutan dan jelas.");
  if (enabled.has("jujur")) lines.push("Jika tidak yakin, katakan terus terang. Jangan mengarang fakta, angka, kutipan, atau sumber.");
  if (enabled.has("terjemah")) lines.push("Jika pesan terakhir pengguna tidak berbahasa Indonesia, jawab dalam bahasa itu lalu tambahkan terjemahan Indonesia singkat di akhir.");
  if (enabled.has("kreatif")) lines.push("Berikan beberapa alternatif ide yang berbeda satu sama lain dan sertakan satu sudut pandang tak terduga.");
  return lines.length ? "[Plugin Umaira aktif]\n" + lines.map((l) => "- " + l).join("\n") : "";
}

/* ---------- validasi data per modul ---------- */
function clean(mod, value) {
  if (mod === "plugins") {
    const ids = Array.isArray(value?.enabled) ? value.enabled : [];
    return { enabled: [...new Set(ids.map(String).filter((id) => PLUGIN_IDS.has(id)))] };
  }
  if (mod === "codex") {
    if (!Array.isArray(value)) return null;
    return value.slice(0, 30).map((s) => {
      const id = String(s?.id || "");
      if (!/^[\w-]{1,64}$/.test(id)) return null;
      const messages = (Array.isArray(s.messages) ? s.messages : []).slice(-40).map((m) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.content || "").slice(0, 20000),
        label: m?.label ? String(m.label).slice(0, 500) : undefined
      })).filter((m) => m.content);
      return {
        id,
        title: String(s.title || "Sesi baru").slice(0, 120),
        language: String(s.language || "auto").slice(0, 30),
        createdAt: iso(s.createdAt),
        updatedAt: iso(s.updatedAt),
        messages
      };
    }).filter(Boolean);
  }
  return null;
}

export function createWorkspaceDataRouter({ currentUser }) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    try {
      const user = await currentUser(req);
      if (!user?.id) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      req.wsUid = user.id;
      next();
    } catch (err) {
      console.error("[wsdata] auth gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal memeriksa akun." });
    }
  });

  router.get("/plugins", async (req, res) => {
    try {
      const stored = await kvGet(keyOf(req.wsUid, "plugins"), null);
      const enabled = Array.isArray(stored?.enabled) ? stored.enabled.filter((id) => PLUGIN_IDS.has(id)) : [];
      res.json({ catalog: PLUGIN_CATALOG, enabled });
    } catch (err) {
      console.error("[wsdata] GET plugins:", err?.message || err);
      res.status(500).json({ error: "Gagal memuat plugin." });
    }
  });

  router.get("/:mod", async (req, res) => {
    try {
      if (!["codex"].includes(req.params.mod)) return res.status(404).json({ error: "Modul tidak dikenal." });
      const value = await kvGet(keyOf(req.wsUid, req.params.mod), []);
      res.json({ value });
    } catch (err) {
      console.error("[wsdata] GET:", err?.message || err);
      res.status(500).json({ error: "Gagal memuat data." });
    }
  });

  router.put("/:mod", async (req, res) => {
    try {
      const mod = req.params.mod;
      const value = clean(mod, req.body?.value);
      if (value === null) return res.status(400).json({ error: "Data tidak valid." });
      if (JSON.stringify(value).length > MAX_BYTES) {
        return res.status(413).json({ error: "Data terlalu besar. Hapus sesi lama." });
      }
      await kvSet(keyOf(req.wsUid, mod), value);
      res.json({ ok: true });
    } catch (err) {
      console.error("[wsdata] PUT:", err?.message || err);
      res.status(500).json({ error: "Gagal menyimpan data." });
    }
  });

  return router;
}
