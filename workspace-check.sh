cd "$(dirname "$0")" || exit 1
fail=0
ok()  { echo "OK     $1"; }
bad() { echo "GAGAL  $1"; fail=1; }

for f in server.js db.js auth.js workspace.js workspace-data.js workspace-scheduler.js workspace-files.js \
         public/workspace-sync.js public/workspace-modules.js public/workspace-scheduled.js \
         public/workspace-files.js public/workspace-badge.js; do
  if [ ! -f "$f" ]; then bad "file hilang: $f"; continue; fi
  if node --check "$f" 2>/dev/null; then ok "sintaks $f"; else bad "sintaks $f"; node --check "$f"; fi
done

for p in createWorkspaceRouter createWorkspaceDataRouter createScheduledRouter createFilesRouter \
         startScheduler __umairaTryAIChat buildPluginContext buildFileContext; do
  if grep -q "$p" server.js; then ok "server.js memuat $p"; else bad "server.js tidak memuat $p"; fi
done

for s in workspace-modules.css workspace-sync.js workspace-modules.js workspace-scheduled.js workspace-files.js workspace-badge.js; do
  if grep -q "$s" public/index.html; then ok "index.html memuat $s"; else bad "index.html tidak memuat $s"; fi
done

if grep -q "^DATABASE_URL=" .env 2>/dev/null; then ok "penyimpanan: database"; else ok "penyimpanan: file (folder data)"; fi
if grep -qx ".env" .gitignore 2>/dev/null; then ok ".env masuk .gitignore"; else echo "CATATAN .env belum ada di .gitignore"; fi

[ $fail -eq 0 ] && echo "== SEMUA LOLOS ==" || echo "== ADA YANG GAGAL =="
