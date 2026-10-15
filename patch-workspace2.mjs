import fs from "node:fs";

const mountAnchor = 'app.use("/api/workspaces", createWorkspaceRouter({ currentUser: (req) => currentUser(req) }));';
const mountNew = mountAnchor + `
app.use("/api/wsdata", createWorkspaceDataRouter({ currentUser: (req) => currentUser(req) }));
app.use("/api/chat", async (req, res, next) => {
  if (req.method !== "POST" || !req.body || typeof req.body !== "object") return next();
  try {
    const user = await currentUser(req);
    if (user?.id) {
      const block = await buildPluginContext(user.id, req.body.messages);
      if (block) req.body.projectContext = block + "\\n\\n" + String(req.body.projectContext || "");
    }
  } catch (err) {
    console.warn("[plugin] konteks gagal:", err?.message || err);
  }
  next();
});`;

const plan = {
  "server.js": [[mountAnchor, mountNew]],
  "public/index.html": [[
    '<script src="/workspace-sync.js"></script>',
    '<link rel="stylesheet" href="/workspace-modules.css">\n<script src="/workspace-sync.js"></script>\n<script src="/workspace-modules.js"></script>'
  ]]
};
const importLine = 'import { createWorkspaceDataRouter, buildPluginContext } from "./workspace-data.js";\n';

const results = {};
for (const [file, edits] of Object.entries(plan)) {
  let src = fs.readFileSync(file, "utf8");
  for (const [oldStr, newStr] of edits) {
    const n = src.split(oldStr).length - 1;
    if (n !== 1) throw new Error(file + ": potongan ditemukan " + n + "x (harus 1x): " + oldStr.slice(0, 70));
    src = src.replace(oldStr, () => newStr);
  }
  if (file === "server.js") src = importLine + src;
  results[file] = src;
}
for (const [file, src] of Object.entries(results)) {
  fs.copyFileSync(file, file + ".before-workspace2");
  fs.writeFileSync(file, src);
  console.log("OK:", file);
}
