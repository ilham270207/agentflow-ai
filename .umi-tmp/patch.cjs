const fs = require("fs");
let src = fs.readFileSync("server.js", "utf8");
const helper = fs.readFileSync(".umi-tmp/helper.js", "utf8");

const a1 = 'app.post("/api/images/generate"';
const a2 = "  const fullPrompt =\n    [prompt, IMAGE_STYLES[styleKey]]";
const count = (s, t) => s.split(t).length - 1;

if (count(src, a1) !== 1 || count(src, a2) !== 1) {
  console.error("GAGAL: titik pasang tidak cocok (" + count(src, a1) + "/" + count(src, a2) + "). Tidak ada yang diubah.");
  process.exit(1);
}

src = src.replace(a1, () => helper + a1);
src = src.replace(
  a2,
  () => "  const englishPrompt = await umairaEnhancePrompt(prompt);\n" +
        "  const fullPrompt =\n    [englishPrompt, IMAGE_STYLES[styleKey]]"
);
fs.writeFileSync("server.js", src);
console.log("Patch diterapkan.");
