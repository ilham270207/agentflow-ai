import fs from "node:fs";

const importAnchor = 'import { createScheduledRouter, startScheduler } from "./workspace-scheduler.js";';
const mountAnchor = 'app.use("/api/wsdata/scheduled", createScheduledRouter({ currentUser: (req) => currentUser(req) }));';
const blockAnchor = "const block = await buildPluginContext(user.id, req.body.messages);";
const scriptAnchor = '<script src="/workspace-scheduled.js"></script>';

const plan = {
  "server.js": [
    [importAnchor, importAnchor + '\nimport { createFilesRouter, buildFileContext } from "./workspace-files.js";'],
    [mountAnchor, mountAnchor + '\napp.use("/api/wsdata/files", createFilesRouter({ currentUser: (req) => currentUser(req) }));'],
    [blockAnchor, "const block = [await buildPluginContext(user.id, req.body.messages), await buildFileContext(user.id, req.body.messages)].filter(Boolean).join(\"\\n\\n\");"]
  ],
  "public/index.html": [
    [scriptAnchor, scriptAnchor + '\n<script src="/workspace-files.js"></script>']
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
  fs.copyFileSync(file, file + ".before-workspace4");
  fs.writeFileSync(file, src);
  console.log("OK:", file);
}
