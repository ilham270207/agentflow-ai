(function () {
  "use strict";
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var IK = "umaira-project-instructions-v1", CHAT_KEY = "umaira-chat-project-v1";
  var tip = function (a, b, c) { if (window.umairaToast) window.umairaToast(a, b, c); else alert(a); };
  function mkBtn(t, main) { var b = document.createElement("button"); b.type = "button"; b.className = "uup-btn" + (main ? " uup-main" : ""); b.textContent = t; return b; }
  function pill(t) { var b = document.createElement("button"); b.type = "button"; b.className = "uup-pill"; b.textContent = t; return b; }
  function readJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || "") || d; } catch (e) { return d; } }
  function listProjects() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/project/i.test(k) || k === IK) continue;
        var v = readJSON(k, null);
        if (Array.isArray(v) && v.length && v.every(function (p) { return p && p.id && p.name; })) return v;
      }
    } catch (e) {}
    return [];
  }

  /* ---- suntik instruksi proyek ke /api/chat ---- */
  var of = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (/\/api\/chat(\?|$)/.test(url) && method === "POST" && init && typeof init.body === "string") {
        var pid = localStorage.getItem(CHAT_KEY), ins = pid && (readJSON(IK, {})[pid] || {}).text;
        if (ins) {
          var b = JSON.parse(init.body);
          if (b.projectContext == null || typeof b.projectContext === "string") {
            b.projectContext = String(b.projectContext || "") + "\n\n[Instruksi khusus proyek dari pengguna]\n" + ins;
            init = Object.assign({}, init, { body: JSON.stringify(b) });
          }
        }
      }
    } catch (e) {}
    return of.call(this, input, init);
  };

  var TPL = [
    ["Persona", "Kamu adalah asisten untuk proyek ini. Jawab sebagai rekan kerja yang paham konteksnya."],
    ["Gaya tulisan", "Gunakan bahasa Indonesia yang jelas, paragraf pendek, dan hindari istilah yang tidak perlu."],
    ["Aturan kode", "Untuk kode: beri penjelasan singkat, gunakan nama variabel deskriptif, dan sertakan contoh pemakaian."]
  ];
  function projectCard() {
    var pb = q(".projects-button");
    if (!pb || !pb.offsetParent || q(".uup-inst")) return;
    var ps = listProjects(), card = document.createElement("div");
    card.className = "uup-out uup-inst";
    card.innerHTML = '<header><span>Instruksi proyek untuk AI</span></header><div style="padding:12px;display:grid;gap:10px"><select class="uup-search" aria-label="Pilih proyek"></select><div class="uup-chips"></div><textarea class="uup-search" rows="4" maxlength="2000" placeholder="Contoh: Proyek ini website toko kue. Jawab ramah, fokus pada SEO lokal."></textarea><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="uup-count" style="margin-left:0"></span></div><small style="opacity:.65">Dipakai AI saat proyek ini dipilih untuk obrolan. Tersimpan di perangkat ini.</small></div>';
    var sel = q("select", card), ta = q("textarea", card), info = q(".uup-count", card), chips = q(".uup-chips", card);
    if (!ps.length) { q("select", card).remove(); ta.disabled = true; ta.placeholder = "Buat proyek dulu, lalu tulis instruksinya di sini."; }
    ps.forEach(function (p) { var o = document.createElement("option"); o.value = p.id; o.textContent = p.name; sel.appendChild(o); });
    var active = localStorage.getItem(CHAT_KEY);
    if (active && ps.some(function (p) { return p.id === active; })) sel.value = active;
    function load() { ta.value = (readJSON(IK, {})[sel.value] || {}).text || ""; info.textContent = ta.value.length + "/2000"; }
    TPL.forEach(function (t) { var b = pill(t[0]); b.onclick = function () { ta.value = (ta.value ? ta.value + "\n" : "") + t[1]; info.textContent = ta.value.length + "/2000"; }; chips.appendChild(b); });
    var save = mkBtn("Simpan instruksi", true);
    save.onclick = function () {
      var m = readJSON(IK, {}), id = sel.value; if (!id) return;
      if (ta.value.trim()) m[id] = { text: ta.value.trim().slice(0, 2000), at: Date.now() }; else delete m[id];
      try { localStorage.setItem(IK, JSON.stringify(m)); tip("Instruksi tersimpan", "Berlaku untuk obrolan dengan proyek ini.", "ok"); } catch (e) { tip("Gagal menyimpan", "Penyimpanan browser penuh atau diblokir.", "warn"); }
    };
    ta.oninput = function () { info.textContent = ta.value.length + "/2000"; };
    if (sel.tagName === "SELECT") sel.onchange = load;
    q("div", card).insertBefore(save, q("small", card));
    load();
    var anchor = q(".uup-pbar") || pb.parentElement || pb;
    anchor.insertAdjacentElement("afterend", card);
  }

  /* ---- Lab kode: salin & unduh semua kode ---- */
  function codeAll() {
    var panel = q(".wsm-panel");
    return panel ? qa("pre", panel).map(function (p) { return p.textContent; }).filter(Boolean) : [];
  }
  function codexTools() {
    var ta = q('textarea[placeholder^="Instruksi"]');
    if (!ta || !ta.offsetParent || q(".uup-cbar")) return;
    var bar = document.createElement("div"); bar.className = "uup-bar uup-cbar";
    var c = mkBtn("Salin semua kode"), d = mkBtn("Unduh semua kode");
    c.onclick = function () {
      var a = codeAll(); if (!a.length) return tip("Belum ada kode", "Jalankan satu permintaan dulu.", "info");
      (navigator.clipboard ? navigator.clipboard.writeText(a.join("\n\n")) : Promise.reject()).then(function () { tip("Kode disalin", a.length + " blok kode ada di clipboard.", "ok"); }, function () { tip("Gagal menyalin", "Izin clipboard ditolak browser.", "warn"); });
    };
    d.onclick = function () {
      var a = codeAll(); if (!a.length) return tip("Belum ada kode", "Jalankan satu permintaan dulu.", "info");
      var blob = new Blob([a.map(function (x, i) { return "// ===== Blok " + (i + 1) + " =====\n" + x; }).join("\n\n")], { type: "text/plain" });
      var l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = "umaira-kode-" + new Date().toISOString().slice(0, 10) + ".txt";
      document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(l.href); }, 2000);
      tip("Kode diunduh", "File teks sudah tersimpan.", "ok");
    };
    bar.appendChild(c); bar.appendChild(d);
    ta.parentNode.insertBefore(bar, ta);
  }

  var t = 0;
  function run() { if (t) return; t = requestAnimationFrame(function () { t = 0; try { projectCard(); codexTools(); } catch (e) {} }); }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();
})();
