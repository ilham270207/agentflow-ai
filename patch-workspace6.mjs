import fs from "node:fs";

const importAnchor = 'import { createFilesRouter, buildFileContext } from "./workspace-files.js";';
const mountAnchor = 'app.use("/api/wsdata/files", createFilesRouter({ currentUser: (req) => currentUser(req) }));';
const scriptAnchor = '<script src="/workspace-badge.js"></script>';

const plan = {
  "server.js": [
    [importAnchor, importAnchor + '\nimport { createChatsRouter } from "./workspace-chats.js";'],
    [mountAnchor, mountAnchor + '\napp.use("/api/wsdata/chats", createChatsRouter({ currentUser: (req) => currentUser(req) }));']
  ],
  "public/index.html": [
    [scriptAnchor, scriptAnchor + '\n<script src="/workspace-chats.js"></script>']
  ]
};

const results = {};
for (const [file, edits] of Object.entries(plan)) {
  let src = fs.readFileSync(file, "utf8");
  for (const [oldStr, newStr] of edits) {
    const n = src.split(oldStr).length - 1;
    if (n !== 1) throw new Error(file + ": potongan ditemukan " + n + "x (harus 1x): " + oldStr.slice(0, 70));
    src = src.replace(oldStr, () => newStr);
  }
  results[file] = src;
}
for (const [file, src] of Object.entries(results)) {
  fs.copyFileSync(file, file + ".before-workspace6");
  fs.writeFileSync(file, src);
  console.log("OK:", file);
}
