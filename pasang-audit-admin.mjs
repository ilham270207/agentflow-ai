// pasang-audit-admin.mjs - Umaira AI: catat aksi admin + server dimulai + batas log 5.000
// Jalankan setelah pasang-audit-fitur.mjs. Dari folder proyek:  node pasang-audit-admin.mjs
// Cadangan otomatis di backups/audit-admin-<waktu>/ dan dipulihkan sendiri bila ada yang gagal.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const AUDIT = "audit.js";
const UI = "public/admin-audit.js";
const HTML = "public/index.html";

const APPEND = Buffer.from("Ci8vID09PT09IFVNQUlSQSBBVURJVCBWNDogYWtzaSBhZG1pbiAoZGFmdGFyIHBlbmdndW5hLCBla3Nwb3IgQ1NWLCBha3NlcyBkaXRvbGFrKSBkYW4gc2VydmVyIGRpbXVsYWkgPT09PT0KY29uc3QgYWRtaW5TZWVuID0gbmV3IE1hcCgpOwoKZnVuY3Rpb24gYWRtaW5WaWV3U3BlYyhyZXEpIHsKICBjb25zdCBwID0gcmVxLnBhdGg7CiAgaWYgKHAgPT09ICIvYWRtaW4vdXNlcnMiKSB7CiAgICByZXR1cm4geyBhY3Rpb246ICJhZG1pbl92aWV3X3VzZXJzIiwgZGV0YWlsOiAiTWVtYnVrYSBkYWZ0YXIgcGVuZ2d1bmEiLCB0aHJvdHRsZTogMzAgKiA2MCAqIDEwMDAgfTsKICB9CiAgaWYgKHAgPT09ICIvYWRtaW4vYXVkaXQiICYmIHJlcS5xdWVyeSAmJiBTdHJpbmcocmVxLnF1ZXJ5LmZvcm1hdCB8fCAiIikgPT09ICJjc3YiKSB7CiAgICByZXR1cm4geyBhY3Rpb246ICJhZG1pbl9leHBvcnQiLCBkZXRhaWw6ICJNZW5nZWtzcG9yIGxvZyBha3Rpdml0YXMgKENTVikiLCB0aHJvdHRsZTogMCB9OwogIH0KICByZXR1cm4gbnVsbDsKfQoKYXN5bmMgZnVuY3Rpb24gYXR0YWNoQWRtaW5WaWV3KHJlcSwgcmVzLCBhdiwgY3VycmVudFVzZXIpIHsKICBsZXQgc2VzcyA9IG51bGw7CiAgdHJ5IHsgc2VzcyA9IGF3YWl0IGN1cnJlbnRVc2VyKHJlcSk7IH0gY2F0Y2gge30KICByZXMub24oImZpbmlzaCIsIGFzeW5jICgpID0+IHsKICAgIHRyeSB7CiAgICAgIGNvbnN0IGNvZGUgPSByZXMuc3RhdHVzQ29kZTsKICAgICAgY29uc3Qgb2sgPSBjb2RlIDwgNDAwOwogICAgICBjb25zdCBlbWFpbCA9IFN0cmluZygoc2VzcyAmJiBzZXNzLmVtYWlsKSB8fCAiIikudHJpbSgpLnRvTG93ZXJDYXNlKCk7CiAgICAgIGNvbnN0IHQgPSBEYXRlLm5vdygpOwogICAgICBjb25zdCBnYXAgPSBvayA/IGF2LnRocm90dGxlIDogNSAqIDYwICogMTAwMDsKICAgICAgaWYgKGdhcCkgewogICAgICAgIGNvbnN0IGtleSA9IChvayA/IGF2LmFjdGlvbiA6ICJhZG1pbl9kZW5pZWQiKSArICI6IiArIChlbWFpbCB8fCBpcE9mKHJlcSkpOwogICAgICAgIGlmICh0IC0gKGFkbWluU2Vlbi5nZXQoa2V5KSB8fCAwKSA8IGdhcCkgcmV0dXJuOwogICAgICAgIGlmIChhZG1pblNlZW4uc2l6ZSA+IDMwMCkgYWRtaW5TZWVuLmNsZWFyKCk7CiAgICAgICAgYWRtaW5TZWVuLnNldChrZXksIHQpOwogICAgICB9CiAgICAgIGF3YWl0IGxvZ0F1ZGl0KHJlcSwgewogICAgICAgIGFjdG9ySWQ6IHNlc3MgJiYgc2Vzcy5pZCwgbmFtZTogc2VzcyAmJiBzZXNzLm5hbWUsIGVtYWlsLAogICAgICAgIHJvbGU6IGVtYWlsICYmIGVtYWlsID09PSBhZG1pbkVtYWlsKCkgPyAiQWRtaW4iIDogIlBlbmdndW5hIiwKICAgICAgICBhY3Rpb246IG9rID8gYXYuYWN0aW9uIDogImFkbWluX2RlbmllZCIsIG1vZHVsZTogIkFkbWluIiwKICAgICAgICBzdGF0dXM6IG9rID8gInN1a3NlcyIgOiAiZ2FnYWwiLAogICAgICAgIGRldGFpbDogb2sgPyBhdi5kZXRhaWwgOiAiQWtzZXMgZGl0b2xhazogIiArIGF2LmRldGFpbCArICIgKEhUVFAgIiArIGNvZGUgKyAiKSIKICAgICAgfSk7CiAgICB9IGNhdGNoIChlKSB7CiAgICAgIGNvbnNvbGUuZXJyb3IoIlthdWRpdF0gYWRtaW4gdmlldzoiLCBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IGUpOwogICAgfQogIH0pOwp9CgppZiAoIXByb2Nlc3MuZW52LlVNQUlSQV9BVURJVF9OT1NUQVJUICYmICFnbG9iYWxUaGlzLl9fdW1haXJhQXVkaXRTdGFydCkgewogIGdsb2JhbFRoaXMuX191bWFpcmFBdWRpdFN0YXJ0ID0gdHJ1ZTsKICBjb25zdCBzdGFydFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7CiAgICBsb2dBdWRpdChudWxsLCB7CiAgICAgIG5hbWU6ICJTZXJ2ZXIiLCByb2xlOiAiU2lzdGVtIiwgYWN0aW9uOiAic2VydmVyX3N0YXJ0IiwgbW9kdWxlOiAiU2VydmVyIiwgc3RhdHVzOiAic3Vrc2VzIiwKICAgICAgZGV0YWlsOiAiU2VydmVyIGRpbXVsYWkgKE5vZGUgIiArIHByb2Nlc3MudmVyc2lvbiArICIpIiwgZGV2aWNlOiAiU2VydmVyIiwgYnJvd3NlcjogIi0iLCBvczogIi0iCiAgICB9KTsKICB9LCAzMDAwKTsKICBpZiAoc3RhcnRUaW1lci51bnJlZikgc3RhcnRUaW1lci51bnJlZigpOwp9Cg==", "base64").toString("utf8");

const abs = (f) => path.join(ROOT, f);
const read = (f) => fs.readFileSync(abs(f), "utf8");
const write = (f, s) => fs.writeFileSync(abs(f), s);
const count = (s, sub) => s.split(sub).length - 1;

function stop(msg) {
  console.error("\n[BATAL] " + msg + "\nTidak ada file yang diubah.");
  process.exit(1);
}

// 1. Pemeriksaan awal (belum mengubah apa pun)
for (const f of [AUDIT, UI, HTML]) {
  if (!fs.existsSync(abs(f))) stop("File tidak ditemukan: " + f + "\nJalankan dari folder ~/agentflow-ai");
}
let audit = read(AUDIT);
if (audit.includes("UMAIRA AUDIT V4")) {
  console.log("Pencatatan aksi admin sudah terpasang. Tidak ada yang diubah.");
  process.exit(0);
}
if (!audit.includes("UMAIRA AUDIT V3")) stop("Jalankan dulu pasang-audit-fitur.mjs.");

const MAX_OLD = "const MAX_ENTRIES = 1500;";
const MAX_NEW = "const MAX_ENTRIES = 5000;";
const ATT_OLD = 'const spec = req.method === "POST" ? MAP[req.path] || null : null;';
const ATT_NEW =
  'if (req.method === "GET") {\n' +
  "      const av = adminViewSpec(req);\n" +
  "      if (av) await attachAdminView(req, res, av, currentUser);\n" +
  "      return;\n" +
  "    }\n" +
  "    " + ATT_OLD;
if (count(audit, MAX_OLD) !== 1) stop("Batas MAX_ENTRIES di audit.js tidak ditemukan.");
if (count(audit, ATT_OLD) !== 1) stop("Middleware autentikasi di audit.js tidak seperti yang diharapkan.");

let ui = read(UI);
const U_OLD = "api_delete: 'Hapus data' };";
const U_NEW =
  "api_delete: 'Hapus data', server_start: 'Server dimulai', admin_view_users: 'Buka daftar pengguna', " +
  "admin_export: 'Ekspor log CSV', admin_denied: 'Akses admin ditolak' };";
if (count(ui, U_OLD) !== 1) stop("admin-audit.js tidak seperti yang diharapkan (jalankan dulu pasang-audit-fitur.mjs).");

let html = read(HTML);
if (!/admin-audit\.js\?v=\d+/.test(html)) stop("Tag admin-audit.js tidak ditemukan di public/index.html.");

// 2. Cadangan
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const BK = path.join(ROOT, "backups", "audit-admin-" + stamp);
fs.mkdirSync(BK, { recursive: true });
const FILES = [AUDIT, UI, HTML];
for (const f of FILES) fs.copyFileSync(abs(f), path.join(BK, f.replace(/[\\/]/g, "__")));
console.log("Cadangan: " + path.relative(ROOT, BK));

function restore() {
  for (const f of FILES) {
    try { fs.copyFileSync(path.join(BK, f.replace(/[\\/]/g, "__")), abs(f)); } catch {}
  }
  console.error("File asli sudah dipulihkan dari cadangan.");
}

try {
  // 3. Pasang
  audit = audit.replace(MAX_OLD, MAX_NEW).replace(ATT_OLD, ATT_NEW);
  write(AUDIT, audit.replace(/\s*$/, "\n") + APPEND);
  write(UI, ui.replace(U_OLD, U_NEW));
  write(HTML, html.replace(/admin-audit\.js\?v=\d+/, "admin-audit.js?v=6"));

  // 4. Verifikasi (UMAIRA_AUDIT_NOSTART agar uji impor tidak menulis log "server dimulai")
  for (const f of [AUDIT, UI]) {
    execFileSync(process.execPath, ["--check", abs(f)], { stdio: "pipe" });
  }
  const probe =
    "import('./audit.js').then(m=>{const need=['logAudit','logSystem','listAudit','exportAuditCsv','auditAuthMiddleware','auditApiMiddleware'];" +
    "const miss=need.filter(k=>typeof m[k]!=='function');if(miss.length){console.error('hilang: '+miss);process.exit(2)}process.exit(0)})" +
    ".catch(e=>{console.error(e&&e.message||e);process.exit(3)})";
  execFileSync(process.execPath, ["-e", probe], {
    cwd: ROOT, stdio: "pipe", timeout: 30000,
    env: { ...process.env, UMAIRA_AUDIT_NOSTART: "1" }
  });
} catch (err) {
  const detail = err && err.stderr ? String(err.stderr).trim() : err && err.message ? err.message : String(err);
  console.error("\n[GAGAL] " + detail);
  restore();
  process.exit(1);
}

console.log("\nSelesai. Tercatat: buka daftar pengguna, ekspor CSV, akses admin ditolak, server dimulai. Batas log 5.000.");
console.log("Langkah akhir: hentikan server (Ctrl+C), jalankan lagi seperti biasa, lalu muat ulang halaman.");
