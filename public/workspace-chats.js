(() => {
  const KEY = "agentflow-chat-history";
  const BASE_KEY = "umaira-chat-sync-v1";
  const URL_BASE = "/api/wsdata/chats";
  const origSet = Storage.prototype.setItem;

  let syncing = false;
  let again = false;
  let disabled = false;
  let firstRun = true;
  let timer = null;

  const sigOf = (c) => {
    const m = Array.isArray(c.messages) ? c.messages : [];
    const last = m[m.length - 1];
    return [c.id, c.updatedAt, c.archived ? 1 : 0, c.title, m.length,
      last && typeof last.content === "string" ? last.content.length : 0].join("|");
  };
  const sigMap = (arr) => new Map(arr.map((c) => [c.id, sigOf(c)]));
  const sameSet = (a, b) => {
    const A = sigMap(a);
    const B = sigMap(b);
    if (A.size !== B.size) return false;
    for (const [k, v] of A) if (B.get(k) !== v) return false;
    return true;
  };

  function readLocal() {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [];
    try {
      const d = JSON.parse(raw);
      return Array.isArray(d) ? d.filter((c) => c && c.id) : null;
    } catch { return null; }
  }
  function readBase() {
    try {
      const b = JSON.parse(localStorage.getItem(BASE_KEY) || "{}");
      return { owner: b && b.owner || null, ids: b && typeof b.ids === "object" && b.ids ? b.ids : {} };
    } catch { return { owner: null, ids: {} }; }
  }
  function writeBase(owner, version, items) {
    const ids = {};
    items.forEach((c) => { ids[c.id] = sigOf(c); });
    origSet.call(localStorage, BASE_KEY, JSON.stringify({ owner, version, ids }));
  }

  // gabungan tiga arah: local, remote, dan keadaan sinkron terakhir (base)
  function merge(local, remote, baseIds) {
    const L = new Map(local.map((c) => [c.id, c]));
    const R = new Map(remote.filter((c) => c && c.id).map((c) => [c.id, c]));
    const out = [];
    for (const id of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(id);
      const r = R.get(id);
      const b = baseIds[id];
      if (l && r) {
        const ls = sigOf(l);
        const rs = sigOf(r);
        if (ls === rs) out.push(l);
        else if (b !== undefined && ls === b) out.push(r);
        else if (b !== undefined && rs === b) out.push(l);
        else out.push((Number(r.updatedAt) || 0) > (Number(l.updatedAt) || 0) ? r : l);
      } else if (l) {
        if (b === undefined) out.push(l);      // baru di perangkat ini
      } else if (r) {
        if (b === undefined) out.push(r);      // baru dari perangkat lain
      }                                        // ada di base tapi hilang di satu sisi = dihapus
    }
    out.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    return out.slice(0, 60);
  }

  function banner() {
    if (document.getElementById("umairaChatSyncBanner")) return;
    const b = document.createElement("div");
    b.id = "umairaChatSyncBanner";
    b.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9999;" +
      "padding:10px 14px;border-radius:12px;background:#222;color:#fff;font:14px sans-serif;" +
      "display:flex;gap:12px;align-items:center;box-shadow:0 4px 18px rgba(0,0,0,.35)";
    const t = document.createElement("span");
    t.textContent = "Obrolan diperbarui dari perangkat lain.";
    const go = document.createElement("button");
    go.type = "button";
    go.textContent = "Muat ulang";
    go.style.cssText = "padding:6px 10px;border-radius:8px;border:0;background:#7c5cff;color:#fff;cursor:pointer";
    go.addEventListener("click", () => location.reload());
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.style.cssText = "border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer";
    x.addEventListener("click", () => b.remove());
    b.append(t, go, x);
    document.body.appendChild(b);
  }

  function notifyUpdated() {
    const last = Number(sessionStorage.getItem("umaira-chat-reloaded") || 0);
    if (firstRun && Date.now() - last > 20000) {
      sessionStorage.setItem("umaira-chat-reloaded", String(Date.now()));
      location.reload();
      return;
    }
    banner();
  }

  async function sync() {
    if (disabled) return;
    if (syncing) { again = true; return; }
    syncing = true;
    let applied = false;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(URL_BASE, { headers: { Accept: "application/json" } });
        if (res.status === 401) { disabled = true; return; }
        if (!res.ok) throw new Error("HTTP " + res.status);
        const remote = await res.json();
        const rItems = Array.isArray(remote.items) ? remote.items : [];

        let local = readLocal();
        if (local === null) return; // data lokal rusak: jangan menimpa apa pun
        let base = readBase();
        if (base.owner && remote.owner && base.owner !== remote.owner) {
          // browser ini dipakai akun lain: jangan campurkan obrolan antar akun
          origSet.call(localStorage, KEY, "[]");
          origSet.call(localStorage, BASE_KEY, JSON.stringify({ owner: remote.owner, version: 0, ids: {} }));
          local = [];
          base = { owner: remote.owner, ids: {} };
          applied = true;
        }

        const merged = merge(local, rItems, base.ids);
        if (!sameSet(merged, local)) {
          origSet.call(localStorage, KEY, JSON.stringify(merged));
          applied = true;
        }
        if (!sameSet(merged, rItems)) {
          const put = await fetch(URL_BASE, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ baseVersion: remote.version, items: merged })
          });
          if (put.status === 409) continue;
          if (!put.ok) throw new Error("HTTP " + put.status);
          const d = await put.json();
          writeBase(remote.owner, d.version, merged);
        } else {
          writeBase(remote.owner, remote.version, merged);
        }
        break;
      }
    } catch (err) {
      console.warn("[chats] sinkron gagal:", err.message);
    } finally {
      syncing = false;
      if (again) { again = false; schedule(); }
    }
    const wasFirst = firstRun;
    firstRun = false;
    if (applied) { firstRun = wasFirst; notifyUpdated(); firstRun = false; }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(sync, 2000);
  }

  // cegat penulisan ke riwayat obrolan, tanpa mengubah app.js
  Storage.prototype.setItem = function (k, v) {
    const r = origSet.apply(this, arguments);
    if (this === localStorage && k === KEY) schedule();
    return r;
  };

  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
  setInterval(() => { if (!document.hidden) sync(); }, 90000);
  setTimeout(sync, 400);
})();
