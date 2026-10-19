import express from "express";
import crypto from "node:crypto";
import { kvGet, kvSet, fileSave, fileGet, fileDelete } from "./db.js";

const MAX_IMAGES = 200;
const MAX_BYTES = 7 * 1024 * 1024;
const EDITS_PER_HOUR = 12;
const idxKey = (uid) => "workspaces:" + uid + ":chatimgs";
const ownerToken = (uid) => crypto.createHash("sha256").update(String(uid)).digest("hex").slice(0, 16);
const toList = (v) => (Array.isArray(v) ? v : []);
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

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

function sniffMime(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function saveChatImage(uid, buf, name) {
  const mime = sniffMime(buf);
  if (!mime) throw new HttpError(400, "Format gambar tidak didukung.");
  if (buf.length > MAX_BYTES) throw new HttpError(413, "Gambar terlalu besar.");
  const id = "ci" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  const file = "chatimg-" + ownerToken(uid) + "-" + id + "." + EXT[mime];
  await fileSave(file, buf, mime);
  await withLock("u:" + uid, async () => {
    const list = toList(await kvGet(idxKey(uid), []));
    list.push({ id, file, mime, name: String(name || "").slice(0, 120), size: buf.length, createdAt: Date.now() });
    while (list.length > MAX_IMAGES) {
      const old = list.shift();
      await fileDelete(old.file).catch(() => {});
    }
    await kvSet(idxKey(uid), list);
  });
  return { id, url: "/api/chat-images/" + id };
}

/* ---------- API unggah dan tampil gambar obrolan ---------- */
export function createChatImagesRouter({ currentUser }) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    try {
      const user = await currentUser(req);
      if (!user?.id) return res.status(401).json({ error: "Silakan login terlebih dahulu." });
      req.wsUid = String(user.id);
      next();
    } catch (err) {
      console.error("[chatimg] auth gagal:", err?.message || err);
      res.status(500).json({ error: "Gagal memeriksa akun." });
    }
  });

  const fail = (res, err, label) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error("[chatimg] " + label + ":", err?.message || err);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  };

  router.post("/", async (req, res) => {
    try {
      const raw = typeof req.body?.data === "string" ? req.body.data.replace(/^data:[^;]+;base64,/, "") : "";
      if (!raw) throw new HttpError(400, "Data gambar kosong.");
      const saved = await saveChatImage(req.wsUid, Buffer.from(raw, "base64"), req.body?.name);
      res.json(saved);
    } catch (err) { fail(res, err, "POST"); }
  });

  router.get("/:id", async (req, res) => {
    try {
      const entry = toList(await kvGet(idxKey(req.wsUid), [])).find((x) => x.id === req.params.id);
      if (!entry) throw new HttpError(404, "Gambar tidak ditemukan.");
      const f = await fileGet(entry.file);
      if (!f) throw new HttpError(404, "Gambar tidak ditemukan.");
      res.setHeader("Content-Type", entry.mime);
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(f.data);
    } catch (err) { fail(res, err, "GET"); }
  });

  return router;
}

/* ---------- edit gambar lewat Gemini, dipicu dari /api/chat ---------- */
const EDIT_VERB = /\b(edit|ubah|ganti|hapus|hilangkan|buang|perbaiki|percantik|retouch|jadikan|tambahkan|remove|replace|erase|enhance|colorize|warnai)\b/i;
const EDIT_NOUN = /\b(gambar|foto|image|photo|picture|latar|background|backdrop)\b/i;
const NOT_EDIT = /\b(caption|deskripsi|jelaskan|describe|ceritakan|artikel|tulis|teks|apa (yang|itu)|siapa|dimana|where|what)\b/i;

function isEditIntent(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 600) return false;
  if (NOT_EDIT.test(t)) return false;
  return EDIT_VERB.test(t) && EDIT_NOUN.test(t);
}

function buildInstruction(text) {
  const cleaned = String(text)
    .replace(/\b(tolong|please|dong|ya|kak|umaira)\b/gi, " ")
    .replace(/\b(edit|ubah)\s+(gambar|foto)\s+ini\b/gi, " ")
    .replace(/[.,!?:;\-\s]+/g, " ")
    .trim();
  const generic = cleaned.length < 4;
  const prompt = generic
    ? "Edit this photo to improve its overall quality: balance exposure and colors, increase sharpness and clarity, and reduce noise. " +
      "Keep the people, objects, composition and background identical. Return only the edited image."
    : "Edit the provided image according to this instruction (it may be written in Indonesian): \"" + String(text).slice(0, 600) +
      "\". Keep everything that is not mentioned in the instruction unchanged (same people, faces, composition and style). Return the edited image.";
  return { prompt, generic };
}

async function callGeminiEdit(mime, b64, prompt) {
  const model = (process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image").trim();
  let r;
  try {
    r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: b64 } }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        }),
        signal: AbortSignal.timeout(90000)
      }
    );
  } catch (err) {
    throw new HttpError(504, "Tidak dapat menghubungi layanan edit gambar. Coba lagi nanti.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("[image-edit] model=" + model + " status=" + r.status + " pesan=" + (data?.error?.message || "-"));
    if (r.status === 429) throw new HttpError(429, "Kuota model gambar sedang habis atau terlalu sering dipakai. Coba lagi beberapa saat.");
    if (r.status === 404) throw new HttpError(502, "Model gambar \"" + model + "\" tidak tersedia untuk API key ini. Ubah GEMINI_IMAGE_MODEL di pengaturan server.");
    if (r.status === 403 || r.status === 401) throw new HttpError(502, "API key tidak diizinkan memakai model gambar ini.");
    throw new HttpError(502, "Edit gambar gagal diproses oleh layanan AI.");
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const hit = parts.find((p) => (p.inlineData || p.inline_data)?.data);
  if (!hit) {
    const reason = parts.map((p) => p.text || "").join(" ").trim();
    console.error("[image-edit] tanpa gambar. teks=" + reason.slice(0, 200));
    throw new HttpError(422, "AI tidak menghasilkan gambar untuk permintaan ini. Coba ubah instruksinya." + (reason ? " (" + reason.slice(0, 160) + ")" : ""));
  }
  return Buffer.from((hit.inlineData || hit.inline_data).data, "base64");
}

/* ---------- edit gambar lewat Cloudflare Workers AI (FLUX.2 klein) ---------- */
function cfModel() { return (process.env.CF_EDIT_MODEL || "@cf/black-forest-labs/flux-2-klein-4b").trim(); }
function cfDailyMax() { return Number(process.env.CF_EDITS_PER_DAY) || 50; }
const cfDay = { key: "", n: 0 };

async function callCloudflareEdit(mime, b64, prompt) {
  const today = new Date().toISOString().slice(0, 10);
  if (cfDay.key !== today) { cfDay.key = today; cfDay.n = 0; }
  if (cfDay.n >= cfDailyMax()) {
    throw new HttpError(429, "Batas edit gambar harian sudah tercapai. Coba lagi besok.");
  }
  const accountId = (String(process.env.CF_ACCOUNT_ID || "").match(/[0-9a-f]{32}/i) || [""])[0];
  const rawTok = String(process.env.CF_API_TOKEN || "");
  const token = (rawTok.match(/cfut_[A-Za-z0-9_-]+/) || [rawTok.replace(/['"\s]/g, "")])[0];
  if (!accountId || !token) {
    console.error("[image-edit] CF_ACCOUNT_ID atau CF_API_TOKEN tidak valid (id_len=" + accountId.length + " token_len=" + token.length + ")");
    throw new HttpError(502, "Layanan edit gambar belum dikonfigurasi dengan benar. Hubungi admin.");
  }
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("input_image_0", new Blob([Buffer.from(b64, "base64")], { type: mime }), "foto." + (EXT[mime] || "jpg"));
  let r;
  try {
    r = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) + "/ai/run/" + cfModel(),
      { method: "POST", headers: { Authorization: "Bearer " + token }, body: form, signal: AbortSignal.timeout(90000) }
    );
  } catch (err) {
    console.error("[image-edit] cloudflare tidak terjangkau:", err?.message || err);
    throw new HttpError(504, "Tidak dapat menghubungi layanan edit gambar. Coba lagi nanti.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.success === false) {
    const msg = JSON.stringify(data?.errors || data).slice(0, 300);
    console.error("[image-edit] cloudflare model=" + cfModel() + " status=" + r.status + " pesan=" + msg);
    if (r.status === 429) throw new HttpError(429, "Layanan edit gambar sedang penuh. Coba lagi beberapa saat.");
    if (r.status === 401 || r.status === 403) throw new HttpError(502, "Layanan edit gambar belum bisa diakses. Hubungi admin.");
    throw new HttpError(502, "Edit gambar gagal diproses oleh layanan AI.");
  }
  const img = data?.result?.image;
  if (!img) throw new HttpError(422, "AI tidak menghasilkan gambar untuk permintaan ini. Coba ubah instruksinya.");
  cfDay.n += 1;
  return Buffer.from(img, "base64");
}

export function createImageEditMiddleware({ currentUser }) {
  const hits = new Map();
  return async (req, res, next) => {
    try {
      if (req.method !== "POST" || !req.body || typeof req.body !== "object") return next();
      const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
      const last = messages[messages.length - 1];
      const text = typeof last?.content === "string" ? last.content : "";
      const atts = Array.isArray(req.body.attachments) ? req.body.attachments : [];
      const img = atts.find((a) => typeof a?.data === "string" && /^image\//.test(String(a.mimeType || "")));
      if (!img || !isEditIntent(text)) return next();
      const user = await currentUser(req);
      if (!user?.id) return next();

      const now = Date.now();
      let b = hits.get(user.id);
      if (!b || b.reset < now) { b = { n: 0, reset: now + 3600 * 1000 }; hits.set(user.id, b); }
      b.n += 1;
      if (b.n > EDITS_PER_HOUR) {
        return res.status(429).json({ error: "Batas edit gambar tercapai (" + EDITS_PER_HOUR + " per jam). Coba lagi nanti." });
      }
      if (!process.env.GEMINI_API_KEY && !(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN)) {
        return res.status(503).json({ error: "Fitur edit gambar belum dikonfigurasi (GEMINI_API_KEY)." });
      }

      const b64 = img.data.replace(/^data:[^;]+;base64,/, "");
      if (b64.length > MAX_BYTES * 1.4) return res.status(413).json({ error: "Gambar terlalu besar untuk diedit (maksimal sekitar 7 MB)." });
      const mime = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(img.mimeType) ? img.mimeType : "image/jpeg";

      const { prompt, generic } = buildInstruction(text);
      const useCf = Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN);
      console.log("[image-edit] provider=" + (useCf ? "cloudflare" : "gemini") + " cf_id_len=" + String(process.env.CF_ACCOUNT_ID || "").trim().length + " cf_token_len=" + String(process.env.CF_API_TOKEN || "").trim().length + " node=" + process.version);
      const out = useCf ? await callCloudflareEdit(mime, b64, prompt) : await callGeminiEdit(mime, b64, prompt);
      const saved = await saveChatImage(user.id, out, "hasil-edit");
      const intro = generic
        ? "Karena belum ada instruksi yang spesifik, saya memperbaiki kualitas gambar secara umum. Kirim ulang dengan instruksi yang lebih jelas untuk hasil lain, misalnya: hapus latar belakang atau ubah jadi hitam putih."
        : "Berikut hasil editnya.";
      return res.json({ mode: "image-edit", provider: useCf ? "cloudflare" : "gemini", version: "1.5.0", message: intro + (useCf ? "\n\nCatatan: AI menggambar ulang gambar, jadi teks, wajah, dan detail halus bisa berubah. Jangan mengunggah foto berisi data pribadi seperti KTP, kartu bank, atau QR." : "") + "\n\n\u27e6umairaimg:" + saved.id + "\u27e7" });
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      console.error("[image-edit] gagal:", err?.message || err);
      return res.status(500).json({ error: "Edit gambar gagal. Coba lagi." });
    }
  };
}
