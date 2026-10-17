(function () {
  "use strict";
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var S = function (inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>"; };
  var IC = {
    foto: '<rect x="3.5" y="4.5" width="17" height="15" rx="4"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3 3-2.5 4.5 4"/>',
    kamera: '<path d="M4 8a2 2 0 012-2h1.5l1.5-2h6l1.5 2H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    berkas: '<path d="M14 3H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V7zM14 3v4h4"/>',
    proyek: '<path d="M3.5 7a2.5 2.5 0 012.5-2.5h3.5L12 7h6a2.5 2.5 0 012.5 2.5v7A2.5 2.5 0 0118 19H6a2.5 2.5 0 01-2.5-2.5z"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    ekstensi: '<path d="M9 4a2 2 0 014 0v2h4v4h-2a2 2 0 100 4h2v4H5v-4h2a2 2 0 100-4H5V6h4z"/>',
    gaya: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    suara: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>'
  };
  var K = { chat: "umaira-chat-project-v1", gaya: "umaira-gaya-v1", web: "umaira-web-v1" };
  var tip = function (a, b, c) { if (window.umairaToast) window.umairaToast(a, b, c); };
  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k) || "") || d; } catch (e) { return d; } }
  function lset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { tip("Gagal menyimpan", "Penyimpanan browser penuh atau diblokir.", "warn"); return false; } }
  function listProjects() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/project|proyek/i.test(k) || /instructions/.test(k)) continue;
        var v = jget(k, null);
        if (Array.isArray(v) && v.length && v.every(function (p) { return p && p.id && p.name; })) return v;
      }
    } catch (e) {}
    return [];
  }

  /* ---------- lembar bawah ---------- */
  var cur = null;
  function closeSheet() { if (cur) { cur.remove(); cur = null; } }
  function sheet(title, node) {
    closeSheet();
    var b = document.createElement("div"); b.className = "uu1-back";
    var s = document.createElement("div"); s.className = "uu1-sheet"; s.setAttribute("role", "dialog"); s.setAttribute("aria-modal", "true");
    s.innerHTML = '<div class="uu1-grip"></div><h3></h3>'; q("h3", s).textContent = title; s.appendChild(node);
    b.appendChild(s); b.addEventListener("click", function (e) { if (e.target === b) closeSheet(); });
    document.body.appendChild(b); cur = b;
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  /* ---------- Gaya Umaira ---------- */
  var NADA = { netral: "", santai: "Gunakan nada santai dan akrab.", formal: "Gunakan nada formal dan profesional.", hangat: "Gunakan nada hangat, ramah, dan menyemangati." };
  var PANJANG = { ringkas: "Jawab singkat, maksimal beberapa kalimat.", sedang: "", detail: "Jawab lengkap dan mendalam dengan contoh bila perlu." };
  function gayaSheet() {
    var g = jget(K.gaya, { nama: "", nada: "netral", panjang: "sedang" });
    var box = el("div");
    box.appendChild(el("label", "uu1-label", "Nama panggilan"));
    var nm = el("input", "uu1-field"); nm.maxLength = 40; nm.placeholder = "Umaira memanggilmu..."; nm.value = g.nama || ""; box.appendChild(nm);
    function group(label, opts, key) {
      box.appendChild(el("span", "uu1-label", label));
      var row = el("div", "uu1-row");
      Object.keys(opts).forEach(function (o) {
        var b = el("button", "uu1-item" + (g[key] === o ? " on" : ""), o.charAt(0).toUpperCase() + o.slice(1)); b.type = "button";
        b.onclick = function () { g[key] = o; qa("button", row).forEach(function (x) { x.classList.toggle("on", x === b); }); };
        row.appendChild(b);
      });
      box.appendChild(row);
    }
    group("Nada jawaban", NADA, "nada"); group("Panjang jawaban", PANJANG, "panjang");
    var end = el("div", "uu1-end"), c = el("button", "uup-btn", "Tutup"), s = el("button", "uup-btn uup-main", "Simpan");
    c.type = s.type = "button"; c.onclick = closeSheet;
    s.onclick = function () { g.nama = nm.value.trim().slice(0, 40); if (lset(K.gaya, JSON.stringify(g))) { tip("Gaya tersimpan", "Berlaku di obrolan berikutnya.", "ok"); closeSheet(); } };
    end.appendChild(c); end.appendChild(s); box.appendChild(end);
    sheet("Gaya Umaira", box);
  }
  var of = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var m = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (/\/api\/chat(\?|$)/.test(url) && m === "POST" && init && typeof init.body === "string") {
        var g = jget(K.gaya, null), parts = [];
        if (g) {
          if (g.nama) parts.push("Panggil pengguna dengan nama \"" + g.nama + "\".");
          if (NADA[g.nada]) parts.push(NADA[g.nada]);
          if (PANJANG[g.panjang]) parts.push(PANJANG[g.panjang]);
        }
        if (parts.length) {
          var b = JSON.parse(init.body);
          if (b.projectContext == null || typeof b.projectContext === "string") {
            b.projectContext = String(b.projectContext || "") + "\n\n[Gaya Umaira dari pengguna]\n- " + parts.join("\n- ");
            init = Object.assign({}, init, { body: JSON.stringify(b) });
          }
        }
      }
    } catch (e) {}
    return of.call(this, input, init);
  };

  /* ---------- pilih proyek ---------- */
  function proyekSheet() {
    var ps = listProjects(), act = localStorage.getItem(K.chat), box = el("div", "uu1-list");
    function item(label, id) {
      var b = el("button", "uu1-item" + ((act || "") === id ? " on" : ""), label); b.type = "button";
      b.onclick = function () {
        if (id) lset(K.chat, id); else try { localStorage.removeItem(K.chat); } catch (e) {}
        tip(id ? "Proyek dipilih" : "Tanpa proyek", id ? label : "Obrolan berjalan tanpa konteks proyek.", "ok"); closeSheet();
      };
      box.appendChild(b);
    }
    item("Tanpa proyek", "");
    ps.forEach(function (p) { item(p.name, p.id); });
    if (!ps.length) box.appendChild(el("p", "", "Belum ada proyek. Buat dulu di Ruang proyek."));
    sheet("Pilih proyek untuk obrolan", box);
  }

  /* ---------- kisi lampiran ---------- */
  function pick(id) {
    var i = document.getElementById(id);
    closeSheet();
    if (i) i.click(); else tip("Belum tersedia", "Input untuk ini tidak ditemukan.", "warn");
  }
  function kisi() {
    var web = localStorage.getItem(K.web) === "1";
    var items = [
      ["Foto", "foto", function () { pick("composerImageInput"); }],
      ["Kamera", "kamera", function () { pick("composerCameraInput"); }],
      ["Berkas", "berkas", function () { pick("composerFileInput"); }],
      ["Proyek", "proyek", proyekSheet],
      ["Jelajah web", "web", function () {
        var on = localStorage.getItem(K.web) !== "1"; lset(K.web, on ? "1" : "0");
        tip(on ? "Jelajah web aktif" : "Jelajah web mati", on ? "Pengaturan tersimpan. Mesin pencarinya menyusul di fase berikutnya." : "", "info"); closeSheet();
      }, web],
      ["Ekstensi", "ekstensi", function () { closeSheet(); var n = q('.nav-item[data-view="plugins"]'); if (n) n.click(); }],
      ["Gaya", "gaya", gayaSheet]
    ];
    var g = el("div", "uu1-grid");
    items.forEach(function (it) {
      var b = el("button", "uu1-tile" + (it[3] ? " on" : "")); b.type = "button";
      b.innerHTML = '<span class="uu1-ic">' + S(IC[it[1]]) + "</span><span></span>"; q("span:last-child", b).textContent = it[0];
      b.onclick = it[2]; g.appendChild(b);
    });
    sheet("Tambahkan ke obrolan", g);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#composerAttachmentBtn");
    if (!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); kisi();
  }, true);

  /* ---------- bacakan + waktu relatif ---------- */
  function rel(ts) {
    var d = (Date.now() - ts) / 1000;
    if (d < 45) return "baru saja";
    if (d < 3600) return Math.round(d / 60) + " menit lalu";
    if (d < 86400) return Math.round(d / 3600) + " jam lalu";
    return Math.round(d / 86400) + " hari lalu";
  }
  var speakBtn = null;
  function stopSpeak() { try { speechSynthesis.cancel(); } catch (e) {} if (speakBtn) speakBtn.classList.remove("uu-on"); speakBtn = null; }
  function aksi() {
    qa(".chat-message-actions").forEach(function (box) {
      if (!q(".uu1-speak", box)) {
        var b = el("button", "uu1-speak"); b.type = "button"; b.title = "Bacakan"; b.setAttribute("aria-label", "Bacakan"); b.innerHTML = S(IC.suara);
        b.onclick = function () {
          if (!("speechSynthesis" in window)) return tip("Tidak didukung", "Browser ini belum bisa membacakan teks.", "warn");
          if (speakBtn === b) return stopSpeak();
          stopSpeak();
          var w = box.closest(".chat-response-wrapper"), t = w && q(".chat-bubble", w);
          var text = t ? (t.innerText || t.textContent || "").trim() : ""; if (!text) return;
          var u = new SpeechSynthesisUtterance(text.slice(0, 4000)); u.lang = "id-ID";
          u.onend = u.onerror = function () { if (speakBtn === b) stopSpeak(); };
          speakBtn = b; b.classList.add("uu-on"); speechSynthesis.speak(u);
        };
        box.insertBefore(b, box.children[1] || null);
      }
      var cb = q(".copy-response-button", box), idx = cb ? Number(cb.dataset.messageIndex) : NaN;
      if (isFinite(idx) && typeof window.getCurrentMessages === "function") {
        var msg = (window.getCurrentMessages() || [])[idx], tm = q(".uu1-time", box);
        if (msg && msg.createdAt) {
          if (!tm) { tm = el("span", "uu1-time"); box.appendChild(tm); }
          tm.textContent = rel(msg.createdAt);
        }
      }
    });
  }
  var t = 0;
  function run() { if (t) return; t = requestAnimationFrame(function () { t = 0; try { aksi(); } catch (e) {} }); }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  setInterval(run, 60000);
  run();
})();
