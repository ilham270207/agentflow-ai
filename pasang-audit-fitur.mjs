// pasang-audit-fitur.mjs - Umaira AI: Log Aktivitas untuk fitur di luar akun
// (buat gambar, Pustaka, chat, tugas, workspace). Jalankan setelah pasang-audit-lengkap.mjs.
// Jalankan dari folder proyek:  node pasang-audit-fitur.mjs
// Cadangan otomatis di backups/audit-fitur-<waktu>/ dan dipulihkan sendiri bila ada yang gagal.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const AUDIT = "audit.js";
const UI = "public/admin-audit.js";
const HTML = "public/index.html";
const SERVER = "server.js";

const APPEND = Buffer.from("Ci8vID09PT09IFVNQUlSQSBBVURJVCBWMzogcGVuY2F0YXRhbiBmaXR1ciBkaSBsdWFyIGFrdW4gKGdhbWJhciwgUHVzdGFrYSwgY2hhdCwgdHVnYXMsIHdvcmtzcGFjZSkgPT09PT0KY29uc3QgUVVJRVRfQVBJID0gL3ByZXNlbmNlfGhlYXJ0YmVhdHxcL3BpbmdcYnx0eXBpbmcvaTsKY29uc3QgQVBJX01PRFVMRVMgPSBbCiAgWyIvd29ya3NwYWNlcyIsICJXb3Jrc3BhY2UiXSwKICBbIi93c2RhdGEvc2NoZWR1bGVkIiwgIlR1Z2FzIHRlcmphZHdhbCJdLAogIFsiL3dzZGF0YS9maWxlcyIsICJGaWxlIl0sCiAgWyIvd3NkYXRhL2NoYXRzIiwgIlJpd2F5YXQgY2hhdCJdLAogIFsiL3dzZGF0YSIsICJEYXRhIHdvcmtzcGFjZSJdLAogIFsiL2NoYXQtaW1hZ2VzIiwgIkdhbWJhciBjaGF0Il0KXTsKY29uc3QgQVBJX1ZFUkJTID0gewogIFBPU1Q6IFsiYXBpX2NyZWF0ZSIsICJNZW5hbWJhaCBkYXRhIl0sCiAgUFVUOiBbImFwaV91cGRhdGUiLCAiTWVuZ3ViYWggZGF0YSJdLAogIFBBVENIOiBbImFwaV91cGRhdGUiLCAiTWVuZ3ViYWggZGF0YSJdLAogIERFTEVURTogWyJhcGlfZGVsZXRlIiwgIk1lbmdoYXB1cyBkYXRhIl0KfTsKCmZ1bmN0aW9uIGNsYXNzaWZ5QXBpKG1ldGhvZCwgcCkgewogIGlmIChtZXRob2QgPT09ICJQT1NUIikgewogICAgaWYgKHAgPT09ICIvY2hhdCIpIHJldHVybiB7IGFjdGlvbjogImNoYXRfbWVzc2FnZSIsIG1vZHVsZTogIkNoYXQiLCBkZXRhaWw6ICJQZXNhbiBkaWtpcmltIGtlIEFJIiwgdGhyb3R0bGU6IHRydWUgfTsKICAgIGlmIChwID09PSAiL2NoYXQtYWN0aW9uIikgcmV0dXJuIHsgYWN0aW9uOiAiY2hhdF9hY3Rpb24iLCBtb2R1bGU6ICJDaGF0IiwgZGV0YWlsOiAiQWtzaSBjaGF0IiwgdGhyb3R0bGU6IHRydWUgfTsKICAgIGlmIChwID09PSAiL2ltYWdlcy9nZW5lcmF0ZSIpIHJldHVybiB7IGFjdGlvbjogImltYWdlX2dlbmVyYXRlIiwgbW9kdWxlOiAiR2FtYmFyIiwgZGV0YWlsOiAiTWVtYnVhdCBnYW1iYXIgZGFyaSBwcm9tcHQiLCBpbWc6IHRydWUgfTsKICAgIGlmIChwID09PSAiL2dhbGxlcnkvc2F2ZSIpIHJldHVybiB7IGFjdGlvbjogImdhbGxlcnlfc2F2ZSIsIG1vZHVsZTogIlB1c3Rha2EiLCBkZXRhaWw6ICJNZW55aW1wYW4gZ2FtYmFyIGtlIFB1c3Rha2EiIH07CiAgICBpZiAocCA9PT0gIi9lZGl0LXRhc2siKSByZXR1cm4geyBhY3Rpb246ICJ0YXNrX2VkaXQiLCBtb2R1bGU6ICJUdWdhcyIsIGRldGFpbDogIk1lbmd1YmFoIHR1Z2FzIiB9OwogICAgaWYgKHAgPT09ICIvcmVnZW5lcmF0ZS10YXNrIikgcmV0dXJuIHsgYWN0aW9uOiAidGFza19yZWdlbmVyYXRlIiwgbW9kdWxlOiAiVHVnYXMiLCBkZXRhaWw6ICJNZW1idWF0IHVsYW5nIHR1Z2FzIiB9OwogICAgaWYgKHAgPT09ICIvcGxhbiIpIHJldHVybiB7IGFjdGlvbjogInRhc2tfcGxhbiIsIG1vZHVsZTogIlR1Z2FzIiwgZGV0YWlsOiAiTWVtYnVhdCByZW5jYW5hIHR1Z2FzIiB9OwogIH0KICBpZiAobWV0aG9kID09PSAiREVMRVRFIiAmJiAvXlwvZ2FsbGVyeVwvW14vXSskLy50ZXN0KHApKSB7CiAgICByZXR1cm4geyBhY3Rpb246ICJnYWxsZXJ5X2RlbGV0ZSIsIG1vZHVsZTogIlB1c3Rha2EiLCBkZXRhaWw6ICJNZW5naGFwdXMgZ2FtYmFyIGRhcmkgUHVzdGFrYSIsIGRlbElkOiBwLnNwbGl0KCIvIilbMl0gfTsKICB9CiAgY29uc3QgdiA9IEFQSV9WRVJCU1ttZXRob2RdOwogIGlmICghdikgcmV0dXJuIG51bGw7CiAgbGV0IG1vZCA9ICJBUEkiOwogIGZvciAoY29uc3QgW3ByZWZpeCwgbmFtZV0gb2YgQVBJX01PRFVMRVMpIHsKICAgIGlmIChwID09PSBwcmVmaXggfHwgcC5zdGFydHNXaXRoKHByZWZpeCArICIvIikpIHsgbW9kID0gbmFtZTsgYnJlYWs7IH0KICB9CiAgcmV0dXJuIHsgYWN0aW9uOiB2WzBdLCBtb2R1bGU6IG1vZCwgZGV0YWlsOiB2WzFdICsgIiAoIiArIG1ldGhvZCArICIgIiArIGNsaXAocCwgODApICsgIikiIH07Cn0KCmV4cG9ydCBmdW5jdGlvbiBhdWRpdEFwaU1pZGRsZXdhcmUoeyBjdXJyZW50VXNlciB9KSB7CiAgY29uc3QgbGFzdFNlZW4gPSBuZXcgTWFwKCk7CgogIGFzeW5jIGZ1bmN0aW9uIGF0dGFjaChyZXEsIHJlcykgewogICAgY29uc3QgcCA9IHJlcS5wYXRoIHx8ICIvIjsKICAgIGlmICghV1JJVEUuaGFzKHJlcS5tZXRob2QpIHx8IHAuc3RhcnRzV2l0aCgiL2F1dGgiKSB8fCBRVUlFVF9BUEkudGVzdChwKSkgcmV0dXJuOwogICAgY29uc3Qgc3BlYyA9IGNsYXNzaWZ5QXBpKHJlcS5tZXRob2QsIHApOwogICAgaWYgKCFzcGVjKSByZXR1cm47CiAgICBsZXQgc2VzcyA9IG51bGw7CiAgICB0cnkgeyBzZXNzID0gYXdhaXQgY3VycmVudFVzZXIocmVxKTsgfSBjYXRjaCB7fQogICAgaWYgKCFzZXNzIHx8ICFzZXNzLmVtYWlsKSByZXR1cm47CgogICAgbGV0IGNhcHR1cmVkID0gbnVsbDsKICAgIGNvbnN0IG9yaWdKc29uID0gcmVzLmpzb24uYmluZChyZXMpOwogICAgcmVzLmpzb24gPSAoYm9keSkgPT4geyBjYXB0dXJlZCA9IGJvZHk7IHJldHVybiBvcmlnSnNvbihib2R5KTsgfTsKICAgIHJlcy5vbigiZmluaXNoIiwgYXN5bmMgKCkgPT4gewogICAgICB0cnkgewogICAgICAgIGNvbnN0IGNvZGUgPSByZXMuc3RhdHVzQ29kZTsKICAgICAgICBjb25zdCBvayA9IGNvZGUgPCA0MDA7CiAgICAgICAgY29uc3Qgc3RhdHVzID0gb2sgPyAic3Vrc2VzIiA6IGNvZGUgPT09IDQyOSA/ICJkaWJhdGFzaSIgOiAiZ2FnYWwiOwogICAgICAgIGlmIChzcGVjLnRocm90dGxlICYmIG9rKSB7CiAgICAgICAgICBjb25zdCBrID0gU3RyaW5nKHNlc3MuaWQpICsgIjoiICsgc3BlYy5hY3Rpb247CiAgICAgICAgICBjb25zdCB0ID0gRGF0ZS5ub3coKTsKICAgICAgICAgIGlmICh0IC0gKGxhc3RTZWVuLmdldChrKSB8fCAwKSA8IDUgKiA2MCAqIDEwMDApIHJldHVybjsKICAgICAgICAgIGlmIChsYXN0U2Vlbi5zaXplID4gNTAwKSBsYXN0U2Vlbi5jbGVhcigpOwogICAgICAgICAgbGFzdFNlZW4uc2V0KGssIHQpOwogICAgICAgIH0KICAgICAgICBsZXQgZGV0YWlsID0gc3BlYy5kZXRhaWw7CiAgICAgICAgaWYgKHNwZWMuaW1nKSB7CiAgICAgICAgICBjb25zdCBiID0gcmVxLmJvZHkgfHwge307CiAgICAgICAgICBjb25zdCBiaXRzID0gW107CiAgICAgICAgICBpZiAodHlwZW9mIGIucHJvbXB0ID09PSAic3RyaW5nIikgYml0cy5wdXNoKCJwcm9tcHQgIiArIGIucHJvbXB0Lmxlbmd0aCArICIga2FyYWt0ZXIiKTsKICAgICAgICAgIGlmICh0eXBlb2YgYi5zdHlsZSA9PT0gInN0cmluZyIgJiYgYi5zdHlsZSkgYml0cy5wdXNoKCJnYXlhOiAiICsgY2xpcChiLnN0eWxlLCA0MCkpOwogICAgICAgICAgaWYgKGJpdHMubGVuZ3RoKSBkZXRhaWwgKz0gIiAoIiArIGJpdHMuam9pbigiLCAiKSArICIpIjsKICAgICAgICB9CiAgICAgICAgaWYgKCFvaykgZGV0YWlsICs9ICIgLSAiICsgKGNhcHR1cmVkICYmIGNhcHR1cmVkLmVycm9yID8gY2xpcChjYXB0dXJlZC5lcnJvciwgMTIwKSA6ICJIVFRQICIgKyBjb2RlKTsKICAgICAgICBjb25zdCBlbWFpbCA9IFN0cmluZyhzZXNzLmVtYWlsKS50cmltKCkudG9Mb3dlckNhc2UoKTsKICAgICAgICBhd2FpdCBsb2dBdWRpdChyZXEsIHsKICAgICAgICAgIGFjdG9ySWQ6IHNlc3MuaWQsIG5hbWU6IHNlc3MubmFtZSwgZW1haWwsCiAgICAgICAgICByb2xlOiBlbWFpbCA9PT0gYWRtaW5FbWFpbCgpID8gIkFkbWluIiA6ICJQZW5nZ3VuYSIsCiAgICAgICAgICBhY3Rpb246IHNwZWMuYWN0aW9uLCBtb2R1bGU6IHNwZWMubW9kdWxlLCBzdGF0dXMsIGRldGFpbCwKICAgICAgICAgIGJlZm9yZTogc3BlYy5kZWxJZCA/IHsgaWQ6IGNsaXAoc3BlYy5kZWxJZCwgODApIH0gOiB1bmRlZmluZWQsCiAgICAgICAgICBhZnRlcjogc3BlYy5kZWxJZCAmJiBvayA/IHsgaWQ6ICIoZGloYXB1cykiIH0gOiB1bmRlZmluZWQKICAgICAgICB9KTsKICAgICAgfSBjYXRjaCAoZSkgewogICAgICAgIGNvbnNvbGUuZXJyb3IoIlthdWRpdF0gYXBpIG1pZGRsZXdhcmU6IiwgZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBlKTsKICAgICAgfQogICAgfSk7CiAgfQoKICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gYXVkaXRBcGkocmVxLCByZXMsIG5leHQpIHsKICAgIHRyeSB7CiAgICAgIGF3YWl0IGF0dGFjaChyZXEsIHJlcyk7CiAgICB9IGNhdGNoIChlKSB7CiAgICAgIGNvbnNvbGUuZXJyb3IoIlthdWRpdF0gYXBpIG1pZGRsZXdhcmU6IiwgZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBlKTsKICAgIH0KICAgIG5leHQoKTsKICB9Owp9Cg==", "base64").toString("utf8");

const abs = (f) => path.join(ROOT, f);
const read = (f) => fs.readFileSync(abs(f), "utf8");
const write = (f, s) => fs.writeFileSync(abs(f), s);
const count = (s, sub) => s.split(sub).length - 1;

function stop(msg) {
  console.error("\n[BATAL] " + msg + "\nTidak ada file yang diubah.");
  process.exit(1);
}

// 1. Pemeriksaan awal (belum mengubah apa pun)
for (const f of [AUDIT, UI, HTML, SERVER]) {
  if (!fs.existsSync(abs(f))) stop("File tidak ditemukan: " + f + "\nJalankan dari folder ~/agentflow-ai");
}
let audit = read(AUDIT);
if (audit.includes("UMAIRA AUDIT V3")) {
  console.log("Pencatatan fitur sudah terpasang. Tidak ada yang diubah.");
  process.exit(0);
}
if (!audit.includes("UMAIRA AUDIT V2")) stop("Jalankan dulu pasang-audit-lengkap.mjs (audit.js belum versi lengkap).");

const A_HAPUS_OLD = 'if (group === "hapus" && r.action !== "account_delete") continue;';
const A_HAPUS_NEW = 'if (group === "hapus" && !["account_delete", "gallery_delete", "api_delete"].includes(r.action)) continue;';
const A_SISTEM = 'if (group === "sistem" && r.role !== "Sistem") continue;';
const A_FITUR = A_SISTEM + '\n    if (group === "fitur" && (r.module === "Autentikasi" || r.role === "Sistem")) continue;';
if (count(audit, A_HAPUS_OLD) !== 1 || count(audit, A_SISTEM) !== 1) stop("Filter di audit.js tidak seperti yang diharapkan.");

let ui = read(UI);
const U_LABEL_OLD = "profile_update: 'Ubah profil', system_error: 'Error sistem' };";
const U_LABEL_NEW =
  "profile_update: 'Ubah profil', system_error: 'Error sistem', chat_message: 'Kirim chat', chat_action: 'Aksi chat', " +
  "image_generate: 'Buat gambar', gallery_save: 'Simpan ke Pustaka', gallery_delete: 'Hapus dari Pustaka', " +
  "task_edit: 'Ubah tugas', task_regenerate: 'Buat ulang tugas', task_plan: 'Rencana tugas', " +
  "api_create: 'Tambah data', api_update: 'Ubah data', api_delete: 'Hapus data' };";
const U_GROUP_OLD = "['sistem', 'Sistem']];";
const U_GROUP_NEW = "['fitur', 'Fitur'], ['sistem', 'Sistem']];";
if (count(ui, U_LABEL_OLD) !== 1 || count(ui, U_GROUP_OLD) !== 1) stop("admin-audit.js tidak seperti yang diharapkan (jalankan dulu pasang-audit-lengkap.mjs).");

let html = read(HTML);
if (!/admin-audit\.js\?v=\d+/.test(html)) stop("Tag admin-audit.js tidak ditemukan di public/index.html.");

let srv = read(SERVER);
const S_ANCHOR = 'app.use("/api", originGuard);';
if (srv.includes("auditApiMiddleware")) stop("server.js sudah memuat auditApiMiddleware.");
if (count(srv, S_ANCHOR) !== 1) stop('Baris app.use("/api", originGuard); di server.js tidak ditemukan atau ganda.');
if (!/\bcurrentUser\b/.test(srv)) stop("currentUser tidak ditemukan di server.js.");
const lines = srv.split("\n");
let lastImport = -1;
for (let i = 0; i < Math.min(lines.length, 150); i++) {
  if (/\bfrom\s+["'][^"']+["'];?\s*(\/\/.*)?$/.test(lines[i]) || /^import\s+["'][^"']+["'];?\s*$/.test(lines[i])) lastImport = i;
}
if (lastImport < 0) stop("Daftar import di server.js tidak ditemukan.");

// 2. Cadangan
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const BK = path.join(ROOT, "backups", "audit-fitur-" + stamp);
fs.mkdirSync(BK, { recursive: true });
const FILES = [AUDIT, UI, HTML, SERVER];
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
  audit = audit.replace(A_HAPUS_OLD, A_HAPUS_NEW).replace(A_SISTEM, A_FITUR);
  write(AUDIT, audit.replace(/\s*$/, "\n") + APPEND);
  write(UI, ui.replace(U_LABEL_OLD, U_LABEL_NEW).replace(U_GROUP_OLD, U_GROUP_NEW));
  write(HTML, html.replace(/admin-audit\.js\?v=\d+/, "admin-audit.js?v=5"));
  lines.splice(lastImport + 1, 0, 'import { auditApiMiddleware } from "./audit.js"; // UMAIRA AUDIT API');
  srv = lines.join("\n").replace(
    S_ANCHOR,
    S_ANCHOR + '\napp.use("/api", auditApiMiddleware({ currentUser: (req) => currentUser(req) })); // UMAIRA AUDIT API'
  );
  write(SERVER, srv);

  // 4. Verifikasi
  for (const f of [AUDIT, UI, SERVER]) {
    execFileSync(process.execPath, ["--check", abs(f)], { stdio: "pipe" });
  }
  const probe =
    "import('./audit.js').then(m=>{const need=['logAudit','logSystem','listAudit','exportAuditCsv','auditAuthMiddleware','auditApiMiddleware'];" +
    "const miss=need.filter(k=>typeof m[k]!=='function');if(miss.length){console.error('hilang: '+miss);process.exit(2)}process.exit(0)})" +
    ".catch(e=>{console.error(e&&e.message||e);process.exit(3)})";
  execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, stdio: "pipe", timeout: 30000 });
} catch (err) {
  const detail = err && err.stderr ? String(err.stderr).trim() : err && err.message ? err.message : String(err);
  console.error("\n[GAGAL] " + detail);
  restore();
  process.exit(1);
}

console.log("\nSelesai. Sekarang tercatat: buat gambar, simpan/hapus Pustaka, chat, tugas, workspace, file, riwayat chat.");
console.log("Langkah akhir: hentikan server (Ctrl+C), jalankan lagi seperti biasa, lalu muat ulang halaman.");
