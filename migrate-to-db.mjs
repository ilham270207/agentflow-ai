import { usingDb, initDb, kvGet, kvSet, fileSave } from "./db.js";
import fs from "node:fs/promises";
import path from "node:path";

if (!usingDb) {
  console.error("DATABASE_URL belum ada di .env. Dibatalkan.");
  process.exit(1);
}
await initDb();

const force = process.argv.includes("--force");
const dir = path.join(process.cwd(), "data");
const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

async function readJson(name, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

const existing = await kvGet("users", []);
if (Array.isArray(existing) && existing.length && !force) {
  console.error("Database sudah berisi " + existing.length + " akun. Dibatalkan agar tidak menimpa. Pakai --force kalau memang disengaja.");
  process.exit(1);
}

const users = await readJson("umaira-users.json", []);
const index = await readJson("gallery.json", []);
await kvSet("users", users);

const kept = [];
let missing = 0;
for (const item of Array.isArray(index) ? index : []) {
  const name = path.basename(String((item && item.file) || ""));
  try {
    const buf = await fs.readFile(path.join(dir, "gallery", name));
    const ext = path.extname(name).slice(1).toLowerCase();
    await fileSave("gallery/" + name, buf, MIME[ext] || "application/octet-stream");
    kept.push(item);
  } catch {
    missing++;
  }
}
await kvSet("gallery-index", kept);

console.log("Akun dipindah:", users.length);
console.log("Gambar dipindah:", kept.length, "| file hilang (dilewati):", missing);
process.exit(0);
