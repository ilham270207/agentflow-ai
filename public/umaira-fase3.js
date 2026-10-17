(function () {
  "use strict";
  var KEY = "umaira-ingatan-v1", MAXN = 50, MAXL = 300;
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var tip = function (a, b, c) { if (window.umairaToast) window.umairaToast(a, b, c); };
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function svg(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var PEN = svg("M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19zM14 7l3 3");
  var BIN = svg("M4 7h16M9 7V4.5h6V7M6.5 7l1 12a2 2 0 002 1.8h5a2 2 0 002-1.8l1-12M10 11v6M14 11v6");
  var MARK = svg("M7 4h10a1 1 0 011 1v15l-6-3.5L6 20V5a1 1 0 011-1z");

  /* ---------- data ---------- */
  function load() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || ""); } catch (e) {}
    if (!o || !Array.isArray(o.items)) o = { on: true, items: [] };
    o.items = o.items.filter(function (i) { return i && i.id && typeof i.t === "string"; }).slice(0, MAXN);
    return o;
  }
  function save(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch (e) { tip("Gagal menyimpan", "Penyimpanan browser penuh atau diblokir.", "warn"); return false; }
  }
  function add(text) {
    text = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAXL);
    if (text.length < 3) return false;
    var o = load();
    if (o.items.some(function (i) { return i.t.toLowerCase() === text.toLowerCase(); })) { tip("Sudah ada", "Hal ini sudah tersimpan di Ingatan.", "info"); return false; }
    if (o.items.length >= MAXN) { tip("Ingatan penuh", "Hapus beberapa dulu (maksimal " + MAXN + ").", "warn"); return false; }
    o.items.unshift({ id: "m" + Date.now() + Math.random().toString(36).slice(2, 6), t: text, at: Date.now() });
    return save(o);
  }

  /* ---------- lembar Ingatan ---------- */
  var box = null, editing = null, wipe = 0, wipeT = 0;
  var inp = el("input", "uu1-field"); inp.maxLength = MAXL; inp.placeholder = "Contoh: Aku suka jawaban singkat dan langsung";
  function closeSheet() { var b = q(".uu1-back"); if (b) b.remove(); box = null; editing = null; }
  function openSheet() {
    closeSheet();
    var b = el("div", "uu1-back"), s = el("div", "uu1-sheet");
    s.setAttribute("role", "dialog"); s.setAttribute("aria-modal", "true");
    box = el("div");
    s.appendChild(el("div", "uu1-grip")); s.appendChild(el("h3", "", "Ingatan")); s.appendChild(box);
    b.appendChild(s); b.addEventListener("click", function (e) { if (e.target === b) closeSheet(); });
    document.body.appendChild(b); draw();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box) closeSheet(); });
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });

  function submit() {
    var v = inp.value.trim(); if (v.length < 3) return tip("Terlalu pendek", "Tulis minimal beberapa kata.", "info");
    if (editing) {
      var o = load(), it = o.items.filter(function (i) { return i.id === editing; })[0];
      if (it) { it.t = v.replace(/\s+/g, " ").slice(0, MAXL); save(o); tip("Ingatan diperbarui", "", "ok"); }
      editing = null; inp.value = ""; draw();
    } else if (add(v)) { inp.value = ""; tip("Disimpan ke Ingatan", "", "ok"); draw(); }
  }

  function draw() {
    if (!box) return;
    var o = load(), kids = [];
    var sw = el("button", "uu1-item" + (o.on ? " on" : "")); sw.type = "button";
    sw.appendChild(el("span", "", "Pakai Ingatan di obrolan")); sw.appendChild(el("span", "uu3-sw", o.on ? "Aktif" : "Mati"));
    sw.onclick = function () { var x = load(); x.on = !x.on; save(x); draw(); };
    kids.push(sw);
    kids.push(el("label", "uu1-label", editing ? "Ubah ingatan" : "Tambah ingatan"));
    kids.push(inp);
    var row = el("div", "uu1-row"); row.style.marginTop = "10px";
    var go = el("button", "uup-btn uup-main", editing ? "Simpan" : "Tambah"); go.type = "button"; go.onclick = submit; row.appendChild(go);
    if (editing) { var no = el("button", "uup-btn", "Batal"); no.type = "button"; no.onclick = function () { editing = null; inp.value = ""; draw(); }; row.appendChild(no); }
    kids.push(row);
    var meta = el("div", "uu3-meta"); meta.appendChild(el("span", "", o.items.length + "/" + MAXN + " ingatan")); meta.appendChild(el("span", "", "Tersimpan di perangkat ini")); kids.push(meta);
    var list = el("div", "uu3-list");
    if (!o.items.length) list.appendChild(el("p", "uu3-empty", "Belum ada ingatan. Tambahkan di atas, atau ketik \u201cingat bahwa aku suka jawaban singkat\u201d langsung di obrolan."));
    o.items.forEach(function (it) {
      var r = el("div", "uu3-mem"); r.appendChild(el("span", "", it.t));
      var e = el("button"); e.type = "button"; e.title = "Ubah"; e.setAttribute("aria-label", "Ubah ingatan"); e.innerHTML = PEN;
      e.onclick = function () { editing = it.id; inp.value = it.t; draw(); inp.focus(); };
      var d = el("button"); d.type = "button"; d.title = "Hapus"; d.setAttribute("aria-label", "Hapus ingatan"); d.innerHTML = BIN;
      d.onclick = function () { var x = load(); x.items = x.items.filter(function (i) { return i.id !== it.id; }); save(x); if (editing === it.id) { editing = null; inp.value = ""; } draw(); };
      r.appendChild(e); r.appendChild(d); list.appendChild(r);
    });
    kids.push(list);
    if (o.items.length) {
      var all = el("button", "uup-btn", wipe ? "Ketuk lagi untuk hapus semua" : "Hapus semua"); all.type = "button"; all.style.marginTop = "14px";
      all.onclick = function () {
        if (!wipe) { wipe = 1; clearTimeout(wipeT); wipeT = setTimeout(function () { wipe = 0; draw(); }, 3000); return draw(); }
        wipe = 0; var x = load(); x.items = []; save(x); tip("Ingatan dikosongkan", "", "ok"); draw();
      };
      kids.push(all);
    }
    box.replaceChildren.apply(box, kids);
  }

  /* ---------- item di sidebar ---------- */
  function nav() {
    if (q("#navIngatanBtn")) return;
    var after = q('.nav-item[data-view="scheduled"]'); if (!after) return;
    var b = el("button", "nav-item"); b.type = "button"; b.id = "navIngatanBtn";
    var ic = el("span", "nav-icon"); ic.innerHTML = MARK; var sv = q("svg", ic); if (sv) { sv.setAttribute("width", "20"); sv.setAttribute("height", "20"); }
    b.appendChild(ic); b.appendChild(el("span", "", "Ingatan"));
    b.onclick = function () { var bd = document.getElementById("sidebarBackdrop"); if (bd && bd.offsetParent) bd.click(); openSheet(); };
    after.insertAdjacentElement("afterend", b);
  }
  var t = 0;
  function run() { if (t) return; t = requestAnimationFrame(function () { t = 0; try { nav(); } catch (e) {} }); }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();

  /* ---------- suntik ke /api/chat + simpan lewat "ingat bahwa ..." ---------- */
  function capture(txt) {
    var m = txt.match(/^\s*(?:tolong\s+)?ingat(?:lah)?\s*(?:bahwa\b|:)\s*([\s\S]{3,300})$/i) || txt.match(/^\s*tolong\s+ingat\s+([\s\S]{3,300})$/i);
    if (m && add(m[1])) tip("Disimpan ke Ingatan", "Umaira akan mengingatnya di obrolan berikutnya.", "ok");
  }
  var of = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var m = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (/\/api\/chat(\?|$)/.test(url) && m === "POST" && init && typeof init.body === "string") {
        var b = JSON.parse(init.body), ms = b.messages, last = Array.isArray(ms) && ms[ms.length - 1];
        if (last && last.role === "user" && typeof last.content === "string") capture(last.content);
        var o = load();
        if (o.on && o.items.length && (b.projectContext == null || typeof b.projectContext === "string")) {
          b.projectContext = String(b.projectContext || "") +
            "\n\n[Ingatan tentang pengguna. Pakai hanya bila relevan dan jangan menyebutnya kecuali ditanya]\n" +
            o.items.slice(0, MAXN).map(function (i) { return "- " + i.t; }).join("\n");
          init = Object.assign({}, init, { body: JSON.stringify(b) });
        }
      }
    } catch (e) {}
    return of.call(this, input, init);
  };
})();
