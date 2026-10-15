const fs = require("fs");
const count = (s, t) => s.split(t).length - 1;
let a = fs.readFileSync("auth.js", "utf8");
if (a.includes("UMAIRA DELETE ACCOUNT")) { console.log("auth.js: sudah terpasang."); process.exit(0); }

const imp = 'import { kvGet, kvSet, usingDb } from "./db.js";';
const exp = "export { router as authRouter };";
const need = ["function rlGuard(", "async function verifyPassword(", "function setCookie(",
  "async function currentUser(", "async function readUsers(", "async function saveUsers(", "deleteByUser"];
const missing = need.filter(n => !a.includes(n));
if (missing.length) { console.error("GAGAL: tidak ditemukan di auth.js: " + missing.join(", ")); process.exit(1); }
if (count(a, imp) !== 1 || count(a, exp) !== 1) {
  console.error("GAGAL: titik pasang tidak cocok (" + count(a, imp) + "/" + count(a, exp) + "). Tidak ada yang diubah.");
  process.exit(1);
}
const route = fs.readFileSync(".umi-tmp/route.txt", "utf8");
a = a.replace(imp, () => 'import { kvGet, kvSet, usingDb, fileDelete } from "./db.js";');
a = a.replace(exp, () => route + "\n" + exp);
fs.writeFileSync("auth.js", a);
console.log("auth.js: dipasang.");
