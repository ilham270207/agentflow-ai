const fs = require("fs");
const count = (s, t) => s.split(t).length - 1;

let srv = fs.readFileSync("server.js", "utf8");
const s1 = "              img: item.img,\n              seed: item.seed,\n              id: item.id\n";
if (srv.includes("model: typeof item.model")) {
  console.log("server.js: sudah terpasang.");
} else {
  if (count(srv, s1) !== 1) { console.error("GAGAL server.js: titik pasang tidak cocok (" + count(srv, s1) + "). Tidak ada yang diubah."); process.exit(1); }
  srv = srv.replace(s1, () =>
    "              img: item.img,\n              seed: item.seed,\n              id: item.id,\n" +
    "              model: typeof item.model === \"string\" ? item.model.slice(0, 80) : \"\"\n");
  fs.writeFileSync("server.js", srv);
  console.log("server.js: dipasang.");
}

let js = fs.readFileSync("public/chat-image.js", "utf8");
const c1 = '      var cap = el("p", "umi-imgchat-cap", job.prompt);\n';
const c2 = "      wrap.append(img, cap, actions);\n";
if (js.includes("umi-imgchat-model")) {
  console.log("chat-image.js: sudah terpasang.");
} else {
  if (count(js, c1) !== 1 || count(js, c2) !== 1) { console.error("GAGAL chat-image.js: titik pasang tidak cocok. Tidak ada yang diubah."); process.exit(1); }
  js = js.replace(c1, () => c1 +
    '      var modelNote = el("p", "umi-imgchat-cap umi-imgchat-model", item.model ? "Model: " + item.model : "");\n' +
    "      if (!item.model) modelNote.hidden = true;\n");
  js = js.replace(c2, () => "      wrap.append(img, cap, modelNote, actions);\n");
  fs.writeFileSync("public/chat-image.js", js);
  console.log("chat-image.js: dipasang.");
}
