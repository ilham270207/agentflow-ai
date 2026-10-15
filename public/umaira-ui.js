/* Umaira UI: lapisan fitur tambahan (tema, logo, alat di sidebar, panel Akun dan Pengaturan).
   Tidak mengubah app.js. Untuk menonaktifkan, hapus tautan umaira-ui.js dari public/index.html. */
(function () {
  "use strict";
  if (window.__uuiLoaded) return;
  window.__uuiLoaded = true;

  var root = document.documentElement;
  var LS = window.localStorage;
  var LOGO = "/assets/umaira-logo-gradient.svg";
  var THEME_KEY = "umaira-theme-preference";
  var user = window.__UMAIRA_USER__ || null;
  var panel = null;
  var ignoreClick = false;

  /* ---------- util ---------- */
  function lsGet(k, d) { try { var v = LS.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { LS.setItem(k, v); } catch (e) {} }
  function jget(k, d) { try { var v = JSON.parse(lsGet(k, "null")); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { lsSet(k, JSON.stringify(v)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector(".uui-toast");
    if (old) old.remove();
    var t = h("div", { class: "uui-toast", role: "status", text: msg });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2400);
  }
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      var c = new C(), o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(c.destination); o.start();
      setTimeout(function () { o.stop(); c.close(); }, 350);
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e2) {}
  }

  /* ---------- preferensi tampilan ---------- */
  function applyPrefs() {
    root.setAttribute("data-uui-density", lsGet("uui-density", "compact"));
    root.setAttribute("data-uui-motion", lsGet("uui-motion", "normal"));
  }

  /* ---------- tema ---------- */
  function wantDark() {
    var p = lsGet(THEME_KEY, "light");
    if (p === "dark" || p === "gelap") return true;
    if (p === "system" || p === "sistem" || p === "auto") {
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  }
  function lum(c) {
    var m = String(c).match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    var a = m.length > 3 ? +m[3] : 1;
    if (a < 0.05) return null;
    return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
  }
  function pageLum() {
    var els = [document.querySelector(".main"), document.querySelector("main"), document.body, root];
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      var l = lum(getComputedStyle(els[i]).backgroundColor);
      if (l !== null) return l;
    }
    var t = document.body ? lum(getComputedStyle(document.body).color) : null;
    return t === null ? null : 1 - t;
  }
  function applyTheme() {
    var want = wantDark();
    var l = pageLum();
    var isDark = l !== null && l < 0.45;
    var inverted = want && !isDark;
    var ui = inverted ? "light" : (isDark ? "dark" : "light");
    if (root.classList.contains("uui-inverted") !== inverted) root.classList.toggle("uui-inverted", inverted);
    if (root.getAttribute("data-uui") !== ui) root.setAttribute("data-uui", ui);
  }
  function setTheme(v) {
    lsSet(THEME_KEY, v);
    try { window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: v })); } catch (e) {}
    setTimeout(function () {
      applyTheme();
      var trulyDark = root.getAttribute("data-uui") === "dark" && !root.classList.contains("uui-inverted");
      if (!wantDark() && trulyDark) { location.reload(); return; }
      if (panel && panel.getAttribute("data-view") === "settings") openPanel("settings");
    }, 200);
  }
  function currentThemeChoice() {
    var p = lsGet(THEME_KEY, "light");
    if (p === "dark" || p === "gelap") return "dark";
    if (p === "system" || p === "sistem" || p === "auto") return "system";
    return "light";
  }

  /* ---------- data lokal (per akun) ---------- */
  function ownKeys() {
    var prefix = user && user.id ? "u:" + user.id + ":" : "";
    var out = [];
    try {
      for (var i = 0; i < LS.length; i++) {
        var k = Storage.prototype.key.call(LS, i);
        if (!k) continue;
        if (prefix ? k.indexOf(prefix) === 0 : (k.indexOf("u:") !== 0 && k !== THEME_KEY)) out.push(k);
      }
    } catch (e) {}
    return { keys: out, prefix: prefix };
  }
  function rawGet(k) { try { return Storage.prototype.getItem.call(LS, k); } catch (e) { return null; } }
  function exportData() {
    var o = ownKeys(), data = {};
    o.keys.forEach(function (k) {
      var v = rawGet(k), name = o.prefix ? k.slice(o.prefix.length) : k;
      try { data[name] = JSON.parse(v); } catch (e) { data[name] = v; }
    });
    var payload = { app: "Umaira AI", exportedAt: new Date().toISOString(), user: user ? { name: user.name, email: user.email } : null, data: data };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = h("a", { download: "umaira-data-" + today() + ".json" });
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast("Data diekspor ke file JSON");
  }
  function clearData() {
    if (!confirm("Hapus semua data lokal akun ini (obrolan, catatan, tugas, prompt) di perangkat ini? Tindakan ini tidak bisa dibatalkan.")) return;
    var o = ownKeys();
    o.keys.forEach(function (k) { try { Storage.prototype.removeItem.call(LS, k); } catch (e) {} });
    toast("Data lokal dihapus");
    setTimeout(function () { location.reload(); }, 600);
  }
  function storageKB() {
    var n = 0;
    ownKeys().keys.forEach(function (k) { var v = rawGet(k); n += k.length + (v ? v.length : 0); });
    return Math.max(0.1, Math.round(n / 102.4) / 10);
  }
  function deviceInfo() {
    var ua = navigator.userAgent || "";
    var b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Peramban";
    var o = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "perangkat ini";
    return b + " di " + o;
  }
  function logout() {
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(function () { location.replace(window.__UMAIRA_USER__ ? "/login" : "/"); })
      .catch(function () { toast("Gagal keluar. Periksa koneksi lalu coba lagi."); });
  }

  /* ---------- timer fokus (berjalan di latar belakang) ---------- */
  var ft = { mode: "Fokus", mins: 25, left: 25 * 60, run: false, iv: null, end: 0, tick: null };
  function fmtTime(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r; }
  function ftStop() { ft.run = false; clearInterval(ft.iv); ft.iv = null; }
  function ftStart() {
    if (ft.run) return;
    ft.run = true; ft.end = Date.now() + ft.left * 1000;
    ft.iv = setInterval(function () {
      ft.left = Math.max(0, Math.round((ft.end - Date.now()) / 1000));
      if (ft.tick) ft.tick();
      if (ft.left <= 0) {
        ftStop();
        if (ft.mode === "Fokus") {
          var f = jget("uui-focus", { d: today(), n: 0 });
          if (f.d !== today()) f = { d: today(), n: 0 };
          f.n++; jset("uui-focus", f);
        }
        beep(); toast("Sesi " + ft.mode.toLowerCase() + " selesai");
        ft.left = ft.mins * 60;
        if (ft.tick) ft.tick();
      }
    }, 500);
    if (ft.tick) ft.tick();
  }
  function ftSet(label, mins) { ftStop(); ft.mode = label; ft.mins = mins; ft.left = mins * 60; if (ft.tick) ft.tick(); }

  /* ---------- panel ---------- */
  var TOOLS = [
    { id: "notes", icon: "✎", label: "Catatan" },
    { id: "tasks", icon: "☑", label: "Tugas" },
    { id: "prompts", icon: "✦", label: "Prompt" },
    { id: "focus", icon: "◷", label: "Fokus" }
  ];
  function leftOffset() {
    var sb = document.querySelector(".sidebar");
    if (!sb) return 0;
    var r = sb.getBoundingClientRect();
    var vis = getComputedStyle(sb).visibility !== "hidden" && r.width > 40 && r.right > 40 && (window.innerWidth - r.right) >= 420;
    return vis ? Math.round(r.right + 8) : 0;
  }
  function closePanel() {
    ft.tick = null;
    if (panel) { panel.remove(); panel = null; }
    var on = document.querySelectorAll(".uui-on");
    for (var i = 0; i < on.length; i++) on[i].classList.remove("uui-on");
  }
  function shell(title, sub) {
    var p = h("div", { class: "uui-panel", role: "dialog", "aria-label": title });
    p.style.setProperty("--uui-left", leftOffset() + "px");
    var wrap = h("div", { class: "uui-wrap" });
    var head = h("div", { class: "uui-head" }, [
      h("div", { class: "uui-grow" }, [h("h2", { class: "uui-title", text: title }), sub ? h("p", { class: "uui-sub", text: sub }) : null]),
      h("button", { class: "uui-x", type: "button", "aria-label": "Tutup", text: "×", onclick: closePanel })
    ]);
    wrap.appendChild(head);
    p.appendChild(wrap);
    return { panel: p, body: wrap };
  }
  function openPanel(id) {
    closePanel();
    var builders = { account: viewAccount, settings: viewSettings, notes: viewNotes, tasks: viewTasks, prompts: viewPrompts, focus: viewFocus };
    var fn = builders[id]; if (!fn) return;
    var s = fn();
    s.panel.setAttribute("data-view", id);
    document.body.appendChild(s.panel);
    panel = s.panel;
    var btn = document.querySelector('[data-uui-open="' + id + '"]');
    if (btn) btn.classList.add("uui-on");
  }
  function seg(options, current, onPick) {
    var box = h("div", { class: "uui-seg", role: "group" });
    options.forEach(function (o) {
      var b = h("button", { type: "button", "aria-pressed": String(o[0] === current), text: o[1] });
      b.addEventListener("click", function () {
        var all = box.querySelectorAll("button");
        for (var i = 0; i < all.length; i++) all[i].setAttribute("aria-pressed", "false");
        b.setAttribute("aria-pressed", "true");
        onPick(o[0]);
      });
      box.appendChild(b);
    });
    return box;
  }

  /* ---- Akun ---- */
  function viewAccount() {
    var s = shell("Akun", "Profil dan data Anda di Umaira AI");
    var name = (user && user.name) || "Pengguna";
    var email = (user && user.email) || "-";
    var notes = jget("uui-notes", []).length;
    var tasks = jget("uui-tasks", []).filter(function (t) { return !t.done; }).length;
    var prompts = jget("uui-prompts", []).length;
    var f = jget("uui-focus", { d: today(), n: 0 });
    var focusToday = f.d === today() ? f.n : 0;

    var profile = h("div", { class: "uui-card" }, [
      h("div", { class: "uui-row" }, [
        h("div", { class: "uui-avatar", "aria-hidden": "true", text: name.trim().charAt(0).toUpperCase() || "U" }),
        h("div", { class: "uui-grow" }, [
          h("div", { style: "font-size:17px;font-weight:650", text: name }),
          h("div", { class: "uui-muted", text: email }),
          h("div", { style: "margin-top:6px" }, [h("span", { class: "uui-badge ok", text: "Sesi aktif" })])
        ])
      ])
    ]);
    var stats = h("div", { class: "uui-card" }, [
      h("h3", { text: "Ringkasan" }),
      h("div", { class: "uui-stats" }, [
        h("div", { class: "uui-stat" }, [h("b", { text: String(notes) }), h("span", { text: "Catatan" })]),
        h("div", { class: "uui-stat" }, [h("b", { text: String(tasks) }), h("span", { text: "Tugas aktif" })]),
        h("div", { class: "uui-stat" }, [h("b", { text: String(prompts) }), h("span", { text: "Prompt tersimpan" })]),
        h("div", { class: "uui-stat" }, [h("b", { text: String(focusToday) }), h("span", { text: "Sesi fokus hari ini" })])
      ])
    ]);
    var info = h("div", { class: "uui-card" }, [
      h("h3", { text: "Keamanan dan perangkat" }),
      h("dl", { class: "uui-kv" }, [
        h("dt", { text: "Perangkat" }), h("dd", { text: deviceInfo() }),
        h("dt", { text: "Masa sesi" }), h("dd", { text: "7 hari sejak login terakhir" }),
        h("dt", { text: "Penyimpanan" }), h("dd", { text: "Sekitar " + storageKB() + " KB di perangkat ini" })
      ]),
      h("p", { class: "uui-muted", style: "margin-top:8px", text: "Obrolan dan alat di Umaira tersimpan di browser perangkat ini, terpisah untuk tiap akun." })
    ]);
    var theme = h("div", { class: "uui-card" }, [
      h("h3", { text: "Tema" }),
      seg([["light", "Terang"], ["dark", "Gelap"], ["system", "Sistem"]], currentThemeChoice(), setTheme)
    ]);
    var actions = h("div", { class: "uui-card" }, [
      h("h3", { text: "Tindakan" }),
      h("div", { class: "uui-row" }, [
        h("button", { class: "uui-btn primary", type: "button", text: "Kembali ke obrolan", onclick: closePanel }),
        h("button", { class: "uui-btn", type: "button", text: "Ekspor data", onclick: exportData }),
        h("button", { class: "uui-btn", type: "button", text: "Pengaturan", onclick: function () { openPanel("settings"); } }),
        h("button", { class: "uui-btn danger", type: "button", text: "Keluar", onclick: logout })
      ])
    ]);
    s.body.appendChild(h("div", { class: "uui-stack" }, [profile, stats, h("div", { class: "uui-grid" }, [info, theme]), actions]));
    return s;
  }

  /* ---- Pengaturan ---- */
  function viewSettings() {
    var s = shell("Pengaturan", "Sesuaikan tampilan dan data Umaira AI");
    var look = h("div", { class: "uui-card" }, [
      h("h3", { text: "Tampilan" }),
      h("div", { class: "uui-stack" }, [
        h("div", null, [h("p", { class: "uui-muted", style: "margin-bottom:6px", text: "Tema" }),
          seg([["light", "Terang"], ["dark", "Gelap"], ["system", "Sistem"]], currentThemeChoice(), setTheme)]),
        h("div", null, [h("p", { class: "uui-muted", style: "margin-bottom:6px", text: "Ukuran tampilan" }),
          seg([["compact", "Kompak"], ["normal", "Normal"], ["comfy", "Nyaman"]], lsGet("uui-density", "compact"),
            function (v) { lsSet("uui-density", v); applyPrefs(); })]),
        h("div", null, [h("p", { class: "uui-muted", style: "margin-bottom:6px", text: "Animasi" }),
          seg([["normal", "Normal"], ["reduced", "Dikurangi"]], lsGet("uui-motion", "normal"),
            function (v) { lsSet("uui-motion", v); applyPrefs(); })])
      ])
    ]);
    var data = h("div", { class: "uui-card" }, [
      h("h3", { text: "Data" }),
      h("p", { class: "uui-muted", style: "margin-bottom:8px", text: "Data tersimpan di browser perangkat ini. Ekspor dulu sebelum menghapus." }),
      h("div", { class: "uui-row" }, [
        h("button", { class: "uui-btn", type: "button", text: "Ekspor data", onclick: exportData }),
        h("button", { class: "uui-btn", type: "button", text: "Reset tampilan", onclick: function () {
          try { Storage.prototype.removeItem.call(LS, user && user.id ? "u:" + user.id + ":uui-density" : "uui-density"); Storage.prototype.removeItem.call(LS, user && user.id ? "u:" + user.id + ":uui-motion" : "uui-motion"); } catch (e) {}
          applyPrefs(); openPanel("settings"); toast("Tampilan dikembalikan ke bawaan");
        } }),
        h("button", { class: "uui-btn danger", type: "button", text: "Hapus data lokal", onclick: clearData })
      ])
    ]);
    var about = h("div", { class: "uui-card" }, [
      h("h3", { text: "Tentang" }),
      h("p", { class: "uui-muted", text: "Umaira AI. Alat Catatan, Tugas, Prompt, dan Fokus bekerja tanpa koneksi dan tersimpan di perangkat ini." })
    ]);
    s.body.appendChild(h("div", { class: "uui-stack" }, [look, data, about]));
    return s;
  }

  /* ---- Catatan ---- */
  function viewNotes() {
    var s = shell("Catatan", "Tulis ide dan hal penting. Tersimpan otomatis.");
    var notes = jget("uui-notes", []);
    function save() { jset("uui-notes", notes); }
    var q = h("input", { class: "uui-in", type: "search", placeholder: "Cari catatan...", "aria-label": "Cari catatan" });
    var list = h("div", { class: "uui-grid" });
    function draw() {
      list.textContent = "";
      var term = q.value.trim().toLowerCase();
      var shown = notes.filter(function (n) { return !term || (n.t + " " + n.b).toLowerCase().indexOf(term) >= 0; });
      if (!shown.length) {
        list.appendChild(h("p", { class: "uui-muted", text: notes.length ? "Tidak ada catatan yang cocok." : "Belum ada catatan. Tekan Catatan baru untuk mulai menulis." }));
        return;
      }
      shown.forEach(function (n) {
        var t = h("input", { class: "uui-in", placeholder: "Judul", "aria-label": "Judul catatan" });
        t.value = n.t;
        var b = h("textarea", { class: "uui-in", placeholder: "Tulis di sini...", "aria-label": "Isi catatan" });
        b.value = n.b;
        t.addEventListener("input", function () { n.t = t.value; n.u = Date.now(); save(); });
        b.addEventListener("input", function () { n.b = b.value; n.u = Date.now(); save(); });
        list.appendChild(h("div", { class: "uui-card" }, [
          t, h("div", { style: "height:8px" }), b,
          h("div", { class: "uui-row uui-spread", style: "margin-top:8px" }, [
            h("span", { class: "uui-muted", text: fmtDate(n.u) }),
            h("button", { class: "uui-btn danger", type: "button", text: "Hapus", onclick: function () {
              if (!confirm("Hapus catatan ini?")) return;
              notes = notes.filter(function (x) { return x.id !== n.id; }); save(); draw();
            } })
          ])
        ]));
      });
    }
    q.addEventListener("input", draw);
    s.body.appendChild(h("div", { class: "uui-stack" }, [
      h("div", { class: "uui-row" }, [
        h("div", { class: "uui-grow" }, [q]),
        h("button", { class: "uui-btn primary", type: "button", text: "Catatan baru", onclick: function () {
          notes.unshift({ id: uid(), t: "", b: "", u: Date.now() }); save(); q.value = ""; draw();
        } })
      ]),
      list
    ]));
    draw();
    return s;
  }

  /* ---- Tugas ---- */
  function viewTasks() {
    var s = shell("Tugas", "Daftar pekerjaan yang perlu diselesaikan");
    var tasks = jget("uui-tasks", []);
    var filter = "all";
    function save() { jset("uui-tasks", tasks); }
    var inp = h("input", { class: "uui-in", placeholder: "Tulis tugas lalu tekan Enter", "aria-label": "Tugas baru", maxlength: "200" });
    var list = h("ul", { class: "uui-list" });
    var count = h("p", { class: "uui-muted" });
    function draw() {
      list.textContent = "";
      var left = tasks.filter(function (t) { return !t.done; }).length;
      count.textContent = left + " tugas aktif dari " + tasks.length;
      var shown = tasks.filter(function (t) { return filter === "all" || (filter === "open" ? !t.done : t.done); });
      if (!shown.length) { list.appendChild(h("li", { class: "uui-muted", text: "Tidak ada tugas di daftar ini." })); return; }
      shown.forEach(function (t) {
        var cb = h("input", { type: "checkbox", "aria-label": "Selesai" });
        cb.checked = !!t.done;
        cb.addEventListener("change", function () { t.done = cb.checked; save(); draw(); });
        list.appendChild(h("li", { class: "uui-item" + (t.done ? " done" : "") }, [
          cb, h("span", { class: "uui-item-t", text: t.t }),
          h("button", { class: "uui-btn", type: "button", "aria-label": "Hapus tugas", text: "×", onclick: function () {
            tasks = tasks.filter(function (x) { return x.id !== t.id; }); save(); draw();
          } })
        ]));
      });
    }
    function add() {
      var v = inp.value.trim(); if (!v) return;
      tasks.unshift({ id: uid(), t: v.slice(0, 200), done: false }); save(); inp.value = ""; draw();
    }
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
    s.body.appendChild(h("div", { class: "uui-stack" }, [
      h("div", { class: "uui-row" }, [h("div", { class: "uui-grow" }, [inp]), h("button", { class: "uui-btn primary", type: "button", text: "Tambah", onclick: add })]),
      h("div", { class: "uui-row uui-spread" }, [
        seg([["all", "Semua"], ["open", "Aktif"], ["done", "Selesai"]], "all", function (v) { filter = v; draw(); }),
        h("button", { class: "uui-btn", type: "button", text: "Hapus yang selesai", onclick: function () {
          tasks = tasks.filter(function (t) { return !t.done; }); save(); draw();
        } })
      ]),
      count, list
    ]));
    draw();
    return s;
  }

  /* ---- Prompt ---- */
  var DEFAULT_PROMPTS = [
    { id: "d1", t: "Ringkas teks", p: "Ringkas teks berikut menjadi 5 poin utama yang jelas:\n\n" },
    { id: "d2", t: "Perbaiki kode", p: "Periksa kode berikut, jelaskan bug-nya, lalu berikan versi yang sudah diperbaiki:\n\n" },
    { id: "d3", t: "Brainstorm ide", p: "Beri 10 ide kreatif tentang topik ini, urutkan dari yang paling mudah dikerjakan:\n\n" },
    { id: "d4", t: "Terjemahkan", p: "Terjemahkan teks berikut ke bahasa Inggris dengan gaya natural dan sopan:\n\n" },
    { id: "d5", t: "Rencana belajar", p: "Buat rencana belajar 7 hari untuk topik ini, lengkap dengan target harian dan latihan singkat:\n\n" },
    { id: "d6", t: "Tulis email", p: "Tulis email profesional singkat dengan tujuan berikut:\n\n" }
  ];
  function usePrompt(text) {
    var ta = document.querySelector("main textarea, .main textarea, textarea");
    if (ta) {
      var setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, text);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      closePanel();
      setTimeout(function () { ta.focus(); }, 60);
      toast("Prompt dimasukkan ke kolom obrolan");
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Prompt disalin. Buka Obrolan lalu tempel."); });
    } else { toast("Buka halaman Obrolan lebih dulu"); }
  }
  function viewPrompts() {
    var s = shell("Prompt", "Template siap pakai. Tekan Pakai untuk memasukkannya ke obrolan.");
    var items = jget("uui-prompts", null);
    if (!items) { items = DEFAULT_PROMPTS.slice(); jset("uui-prompts", items); }
    function save() { jset("uui-prompts", items); }
    var list = h("div", { class: "uui-grid" });
    var nt = h("input", { class: "uui-in", placeholder: "Nama prompt", maxlength: "60", "aria-label": "Nama prompt" });
    var np = h("textarea", { class: "uui-in", placeholder: "Isi prompt", "aria-label": "Isi prompt" });
    function draw() {
      list.textContent = "";
      items.forEach(function (it) {
        list.appendChild(h("div", { class: "uui-card" }, [
          h("h3", { text: it.t }),
          h("p", { class: "uui-muted", style: "white-space:pre-wrap;max-height:4.5em;overflow:hidden", text: it.p.trim() }),
          h("div", { class: "uui-row", style: "margin-top:10px" }, [
            h("button", { class: "uui-btn primary", type: "button", text: "Pakai", onclick: function () { usePrompt(it.p); } }),
            h("button", { class: "uui-btn", type: "button", text: "Hapus", onclick: function () {
              items = items.filter(function (x) { return x.id !== it.id; }); save(); draw();
            } })
          ])
        ]));
      });
    }
    var add = h("div", { class: "uui-card" }, [
      h("h3", { text: "Prompt baru" }), nt, h("div", { style: "height:8px" }), np,
      h("div", { class: "uui-row", style: "margin-top:8px" }, [
        h("button", { class: "uui-btn primary", type: "button", text: "Simpan prompt", onclick: function () {
          var t = nt.value.trim(), p = np.value.trim();
          if (!t || !p) { toast("Isi nama dan prompt lebih dulu"); return; }
          items.unshift({ id: uid(), t: t, p: p + "\n\n" }); save(); nt.value = ""; np.value = ""; draw(); toast("Prompt disimpan");
        } })
      ])
    ]);
    s.body.appendChild(h("div", { class: "uui-stack" }, [add, list]));
    draw();
    return s;
  }

  /* ---- Fokus ---- */
  function viewFocus() {
    var s = shell("Fokus", "Timer Pomodoro untuk menjaga ritme kerja");
    var f = jget("uui-focus", { d: today(), n: 0 });
    var timeEl = h("div", { class: "uui-timer", role: "timer", "aria-live": "off", text: fmtTime(ft.left) });
    var modeEl = h("p", { class: "uui-muted", style: "text-align:center", text: ft.mode });
    var cntEl = h("p", { class: "uui-muted", style: "text-align:center" });
    var go = h("button", { class: "uui-btn primary", type: "button" });
    function paint() {
      timeEl.textContent = fmtTime(ft.left);
      modeEl.textContent = ft.mode + (ft.run ? " berjalan" : "");
      go.textContent = ft.run ? "Jeda" : "Mulai";
      var g = jget("uui-focus", { d: today(), n: 0 });
      cntEl.textContent = "Sesi fokus selesai hari ini: " + (g.d === today() ? g.n : 0);
    }
    ft.tick = paint;
    go.addEventListener("click", function () { if (ft.run) { ftStop(); } else { ftStart(); } paint(); });
    var current = ft.mins === 5 ? "5" : ft.mins === 15 ? "15" : "25";
    var picker = seg([["25", "Fokus 25"], ["5", "Istirahat 5"], ["15", "Panjang 15"]], current, function (v) {
      ftSet(v === "25" ? "Fokus" : "Istirahat", parseInt(v, 10)); paint();
    });
    var card = h("div", { class: "uui-card" }, [
      h("div", { class: "uui-row", style: "justify-content:center" }, [picker]),
      timeEl, modeEl,
      h("div", { class: "uui-row", style: "justify-content:center;margin:10px 0" }, [
        go,
        h("button", { class: "uui-btn", type: "button", text: "Reset", onclick: function () { ftStop(); ft.left = ft.mins * 60; paint(); } })
      ]),
      cntEl
    ]);
    s.body.appendChild(card);
    paint();
    return s;
  }

  /* ---------- perbaikan sidebar dan halaman ---------- */
  function addTools() {
    var sb = document.querySelector(".sidebar");
    if (!sb || sb.querySelector(".uui-tools")) return;
    var sample = sb.querySelector(".nav-item");
    if (!sample) return;
    var secs = sb.querySelectorAll(".sidebar-section");
    var anchor = null;
    for (var i = 0; i < secs.length; i++) { if (/workspace/i.test((secs[i].textContent || "").slice(0, 40))) anchor = secs[i]; }
    var sec = h("div", { class: (anchor ? anchor.className : "sidebar-section") + " uui-tools" });
    var label = null;
    if (anchor) {
      var all = anchor.querySelectorAll("*");
      for (var j = 0; j < all.length; j++) {
        if (all[j].children.length === 0 && /^\s*workspace\s*$/i.test(all[j].textContent || "")) { label = all[j].cloneNode(true); break; }
      }
    }
    if (label) label.textContent = "Alat"; else label = h("div", { class: "uui-tools-label", text: "Alat" });
    sec.appendChild(label);
    TOOLS.forEach(function (t) {
      var b = sample.cloneNode(true);
      var names = b.getAttributeNames();
      for (var n = 0; n < names.length; n++) { if (names[n] !== "class") b.removeAttribute(names[n]); }
      b.classList.remove("active", "is-active", "selected", "uui-on");
      b.setAttribute("type", "button");
      b.setAttribute("data-uui-open", t.id);
      var spans = b.querySelectorAll("span");
      if (spans.length >= 2) { spans[0].textContent = t.icon; spans[spans.length - 1].textContent = t.label; }
      else b.textContent = t.icon + " " + t.label;
      sec.appendChild(b);
    });
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    else {
      var settings = sb.querySelector(".sidebar-settings");
      if (settings && settings.parentNode) settings.parentNode.insertBefore(sec, settings);
      else sb.appendChild(sec);
    }
  }
  function fixLogos() {
    var imgs = document.querySelectorAll('img[src*="umaira-logo"]');
    for (var i = 0; i < imgs.length; i++) { if (imgs[i].getAttribute("src") !== LOGO) imgs[i].setAttribute("src", LOGO); }
  }
  function tagHeads() {
    try {
      var r = document.evaluate("//*[normalize-space(text())='UMAIRA WORKSPACE']", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (var i = 0; i < r.snapshotLength; i++) {
        var el = r.snapshotItem(i);
        if (!el.classList.contains("uui-eyebrow")) el.classList.add("uui-eyebrow");
        var p = el.parentElement;
        if (p && !p.classList.contains("uui-pagehead")) p.classList.add("uui-pagehead");
      }
    } catch (e) {}
  }
  function fixAccountLabel() {
    if (!user) return;
    var l = document.getElementById("navAccountLabel");
    var want = user.name || "Akun";
    if (l && l.textContent !== want) l.textContent = want;
  }
  function enhance() { addTools(); fixLogos(); tagHeads(); fixAccountLabel(); }

  /* ---------- peristiwa ---------- */
  function closeDrawer() {
    if (window.innerWidth >= 900) return;
    var bd = document.getElementById("sidebarBackdrop");
    if (bd) { ignoreClick = true; try { bd.click(); } catch (e) {} ignoreClick = false; }
  }
  document.addEventListener("click", function (e) {
    if (ignoreClick) return;
    var el = e.target;
    if (!el || !el.closest) return;
    var mine = el.closest("[data-uui-open]");
    if (mine) {
      e.preventDefault(); e.stopPropagation();
      openPanel(mine.getAttribute("data-uui-open")); closeDrawer();
      return;
    }
    if (user && el.closest("#navLoginBtn")) {
      e.preventDefault(); e.stopImmediatePropagation();
      openPanel("account"); closeDrawer();
      return;
    }
    var btn = el.closest(".sidebar button, .sidebar a");
    if (btn && /pengaturan\s*$/i.test((btn.textContent || "").trim())) {
      e.preventDefault(); e.stopImmediatePropagation();
      openPanel("settings"); closeDrawer();
      return;
    }
    if (btn && panel) closePanel();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel) closePanel(); });

  function inPanel(n) {
    while (n) { if (n.nodeType === 1 && n.classList && n.classList.contains("uui-panel")) return true; n = n.parentNode; }
    return false;
  }
  var pending = false;
  function startObservers() {
    new MutationObserver(function (muts) {
      var relevant = false;
      for (var i = 0; i < muts.length; i++) { if (!inPanel(muts[i].target)) { relevant = true; break; } }
      if (!relevant || pending) return;
      pending = true;
      setTimeout(function () { pending = false; enhance(); }, 300);
    }).observe(document.body, { childList: true, subtree: true });
    var tp = false;
    new MutationObserver(function () {
      if (tp) return; tp = true;
      setTimeout(function () { tp = false; applyTheme(); }, 120);
    }).observe(root, { attributes: true, attributeFilter: ["class", "data-theme", "data-color-scheme", "style"] });
    try {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", applyTheme);
    } catch (e) {}
    window.addEventListener("storage", function (e) { if (!e.key || e.key === THEME_KEY) applyTheme(); });
  }

  function init() {
    applyPrefs();
    applyTheme();
    enhance();
    startObservers();
    setTimeout(applyTheme, 400);
    setTimeout(applyTheme, 1500);
    if (!user) {
      fetch("/api/auth/me", { credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.user) { user = d.user; enhance(); } })
        .catch(function () {});
    }
  }
  applyPrefs();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
