const fs = require("fs");
let src = fs.readFileSync("server.js", "utf8");
const a = "  const englishPrompt = await umairaEnhancePrompt(prompt);\n";
if (src.split(a).length !== 2) { console.error("GAGAL: titik pasang tidak cocok. Tidak ada yang diubah."); process.exit(1); }
if (src.includes("[image] model=")) { console.log("Sudah terpasang."); process.exit(0); }
src = src.replace(a, () => a +
  '  console.log("[image] model=" + (process.env.AI_HORDE_MODEL?.trim() || "(KOSONG - Horde memilih sendiri)") +\n' +
  '    " | terjemah=" + (englishPrompt !== prompt ? "ya" : "tidak") + " | panjang=" + prompt.length);\n');
fs.writeFileSync("server.js", src);
console.log("Baris log dipasang.");
