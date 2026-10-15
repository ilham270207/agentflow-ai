import fs from "node:fs";

const plan = {
  "db.js": [[
    "function fileFor(key) {\n",
    [
      "function fileFor(key) {",
      "  if (key.startsWith(\"workspaces:\")) {",
      "    const id = key.slice(\"workspaces:\".length).replace(/[^a-zA-Z0-9_-]/g, \"_\");",
      "    return path.join(DATA_DIR, \"umaira-workspaces-\" + id + \".json\");",
      "  }",
      ""
    ].join("\n")
  ]],
  "server.js": [
    [
      "app.use(\"/gallery\", requireAuth);",
      "app.use(\"/gallery\", requireAuth);\napp.use(\"/api/workspaces\", createWorkspaceRouter({ currentUser: (req) => currentUser(req) }));"
    ]
  ],
  "public/app.js": [
    [
      "const UMAIRA_CHAT_PROJECT_KEY = \"umaira-chat-project-v1\";",
      "const UMAIRA_CHAT_PROJECT_KEY = \"umaira-chat-project-v1\";\nwindow.__umairaChatProjectRerender = () => renderUmairaChatProjectIndicator();"
    ],
    [
      "const save = items => localStorage.setItem(KEY, JSON.stringify(items));",
      [
        "const save = items => {",
        "      localStorage.setItem(KEY, JSON.stringify(items));",
        "      window.umairaWorkspacePush?.();",
        "    };",
        "    window.__umairaProjectsRerender = () => {",
        "      if (root.querySelector(\".projects-panel, .project-detail\")) render();",
        "    };"
      ].join("\n")
    ],
    [
      "\"Kelola proyek dan simpan catatannya di browser ini.\"",
      "\"Kelola proyek dan catatannya. Tersimpan di akunmu dan tersinkron di semua perangkat.\""
    ]
  ],
  "public/index.html": [[
    "</body>",
    "<script src=\"/workspace-sync.js\"></script>\n</body>"
  ]]
};

// import baris pertama di server.js
const importLine = "import { createWorkspaceRouter } from \"./workspace.js\";\n";

const results = {};
for (const [file, edits] of Object.entries(plan)) {
  let src = fs.readFileSync(file, "utf8");
  for (const [oldStr, newStr] of edits) {
    const n = src.split(oldStr).length - 1;
    if (n !== 1) throw new Error(file + ": potongan ditemukan " + n + "x (harus 1x): " + oldStr.slice(0, 60));
    src = src.replace(oldStr, () => newStr);
  }
  if (file === "server.js") src = importLine + src;
  results[file] = src;
}

for (const [file, src] of Object.entries(results)) {
  fs.copyFileSync(file, file + ".before-workspace");
  fs.writeFileSync(file, src);
  console.log("OK:", file);
}
