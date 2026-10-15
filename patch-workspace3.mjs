import fs from "node:fs";

const importAnchor = 'import { createWorkspaceDataRouter, buildPluginContext } from "./workspace-data.js";';
const mountAnchor = 'app.use("/api/wsdata", createWorkspaceDataRouter({ currentUser: (req) => currentUser(req) }));';
const healthAnchor = 'app.get("/api/health", (_req, res) => {';
const scriptAnchor = '<script src="/workspace-modules.js"></script>';

const plan = {
  "server.js": [
    [importAnchor, importAnchor + '\nimport { createScheduledRouter, startScheduler } from "./workspace-scheduler.js";'],
    [mountAnchor, [
      'app.use("/api/wsdata/scheduled", createScheduledRouter({ currentUser: (req) => currentUser(req) }));',
      mountAnchor,
      "startScheduler();"
    ].join("\n")],
    [healthAnchor, "globalThis.__umairaTryAIChat = tryAIChat;\n" + healthAnchor]
  ],
  "public/index.html": [
    [scriptAnchor, scriptAnchor + '\n<script src="/workspace-scheduled.js"></script>']
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
  fs.copyFileSync(file, file + ".before-workspace3");
  fs.writeFileSync(file, src);
  console.log("OK:", file);
}
