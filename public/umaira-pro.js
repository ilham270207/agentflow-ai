(function () {
  var USER = window.__UMAIRA_USER__ || null;
  var KEY = "umaira-pro-look";
  var MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  var FONTS = [
    ["default", "Bawaan", ""],
    ["modern", "Modern", 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'],
    ["reading", "Bacaan", 'Georgia,"Times New Roman",serif'],
    ["code", "Kode", MONO]
  ];
  var SIZES = [["0.92", "Kecil"], ["1", "Normal"], ["1.1", "Besar"], ["1.2", "Lebih besar"]];
  var ACCENTS = [
    ["default", "Ungu", "", ""],
    ["blue", "Biru", "#6ea8ff", "#2f6fe4"],
    ["green", "Hijau", "#4cd3a0", "#12a574"],
    ["orange", "Oranye", "#ffb366", "#e2780f"],
    ["pink", "Merah muda", "#f58bbd", "#d63b83"]
  ];

  var CSS = [
    'html[data-pro-font] body,html[data-pro-font] button,html[data-pro-font] input,html[data-pro-font] textarea,html[data-pro-font] select{font-family:var(--umaira-font)!important}',
    'html[data-pro-font] pre,html[data-pro-font] pre *,html[data-pro-font] code{font-family:' + MONO + '!important}',
    'html[data-pro-size] .chat-bubble,html[data-pro-size] #chatInput{zoom:var(--umaira-fscale,1)}',
    '.pro-seg{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px}',
    '.pro-opt{padding:6px 12px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}',
    '.pro-opt.on{background:var(--accent-strong,#3a18e5);border-color:transparent;color:#fff}',
    '.pro-lab{display:block;font-size:12px;margin:8px 0 2px;opacity:.75}',
    '.pro-in,.pro-ta{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-size:13px}',
    '.pro-ta{min-height:96px;resize:vertical}',
    '.pro-note{font-size:12px;margin:0 0 6px}',
    '.pro-status{font-size:12px;margin-left:8px;opacity:.8}'
  ].join("");

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function choice(options, current, onPick) {
    var row = el("div", "pro-seg");
    options.forEach(function (o) {
      var b = el("button", "pro-opt", o[1]);
      b.type = "button";
      if (o[0] === current) b.classList.add("on");
      b.addEventListener("click", function () {
        for (var i = 0; i < row.children.length; i++) row.children[i].classList.remove("on");
        b.classList.add("on");
        onPick(o[0]);
      });
      row.appendChild(b);
    });
    return row;
  }

  /* ---------- font dan warna (tersimpan di perangkat) ---------- */
  function loadLook() {
    var d = { font: "default", size: "1", accent: "default" };
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (v && typeof v === "object") ["font", "size", "accent"].forEach(function (k) { if (typeof v[k] === "string") d[k] = v[k]; });
    } catch (e) {}
    return d;
  }
  function saveLook(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }
  function applyLook() {
    var look = loadLook(), root = document.documentElement;
    var f = FONTS.filter(function (x) { return x[0] === look.font; })[0];
    if (f && f[2]) { root.style.setProperty("--umaira-font", f[2]); root.setAttribute("data-pro-font", "1"); }
    else { root.style.removeProperty("--umaira-font"); root.removeAttribute("data-pro-font"); }
    var sz = parseFloat(look.size);
    if (sz && sz !== 1 && sz >= 0.8 && sz <= 1.3) { root.style.setProperty("--umaira-fscale", String(sz)); root.setAttribute("data-pro-size", "1"); }
    else { root.style.removeProperty("--umaira-fscale"); root.removeAttribute("data-pro-size"); }
    var a = ACCENTS.filter(function (x) { return x[0] === look.accent; })[0];
    if (a && a[2]) {
      root.style.setProperty("--accent", a[2]);
      root.style.setProperty("--accent-strong", a[3]);
      root.style.setProperty("--accent-soft", rgba(a[3], 0.16));
    } else {
      root.style.removeProperty("--accent"); root.style.removeProperty("--accent-strong"); root.style.removeProperty("--accent-soft");
    }
  }
  function lookCard() {
    var card = el("div", "uui-card");
    card.setAttribute("data-pro", "look");
    card.appendChild(el("h3", null, "Font dan warna"));
    var body = el("div");
    card.appendChild(body);
    function render() {
      var look = loadLook();
      body.textContent = "";
      body.appendChild(el("span", "pro-lab", "Jenis huruf"));
      body.appendChild(choice(FONTS, look.font, function (v) { var l = loadLook(); l.font = v; saveLook(l); applyLook(); }));
      body.appendChild(el("span", "pro-lab", "Ukuran huruf obrolan"));
      body.appendChild(choice(SIZES, look.size, function (v) { var l = loadLook(); l.size = v; saveLook(l); applyLook(); }));
      body.appendChild(el("span", "pro-lab", "Warna aksen"));
      body.appendChild(choice(ACCENTS, look.accent, function (v) { var l = loadLook(); l.accent = v; saveLook(l); applyLook(); }));
      var reset = el("button", "pro-opt", "Kembalikan bawaan");
      reset.type = "button";
      reset.addEventListener("click", function () { saveLook({ font: "default", size: "1", accent: "default" }); applyLook(); render(); });
      body.appendChild(reset);
    }
    render();
    return card;
  }

  /* ---------- Gaya Umaira (tersimpan di akun) ---------- */
  function gayaCard() {
    var card = el("div", "uui-card");
    card.setAttribute("data-pro", "gaya");
    card.appendChild(el("h3", null, "Gaya Umaira"));
    card.appendChild(el("p", "uui-muted pro-note", "Atur cara Umaira menjawab. Tersimpan di akunmu dan berlaku di semua obrolan."));
    var state = { nama: "", gaya: "seimbang", nada: "netral", bahasa: "id", instruksi: "" };
    var body = el("div");
    card.appendChild(body);

    function render() {
      body.textContent = "";
      body.appendChild(el("span", "pro-lab", "Nama panggilan"));
      var nama = el("input", "pro-in");
      nama.type = "text"; nama.maxLength = 40; nama.placeholder = "Contoh: Ilham"; nama.value = state.nama;
      nama.addEventListener("input", function () { state.nama = nama.value; });
      body.appendChild(nama);

      body.appendChild(el("span", "pro-lab", "Gaya jawaban"));
      body.appendChild(choice([["ringkas", "Ringkas"], ["seimbang", "Seimbang"], ["rinci", "Rinci"]], state.gaya, function (v) { state.gaya = v; }));
      body.appendChild(el("span", "pro-lab", "Nada"));
      body.appendChild(choice([["santai", "Santai"], ["netral", "Netral"], ["formal", "Formal"]], state.nada, function (v) { state.nada = v; }));
      body.appendChild(el("span", "pro-lab", "Bahasa jawaban"));
      body.appendChild(choice([["id", "Indonesia"], ["en", "Inggris"], ["auto", "Ikuti bahasaku"]], state.bahasa, function (v) { state.bahasa = v; }));

      body.appendChild(el("span", "pro-lab", "Instruksi khusus (opsional)"));
      var ta = el("textarea", "pro-ta");
      ta.maxLength = 1500;
      ta.placeholder = "Contoh: Saya mahasiswa, jelaskan dengan contoh sederhana.";
      ta.value = state.instruksi;
      var count = el("span", "pro-note", state.instruksi.length + "/1500");
      ta.addEventListener("input", function () { state.instruksi = ta.value; count.textContent = ta.value.length + "/1500"; });
      body.appendChild(ta);
      body.appendChild(count);

      var row = el("div");
      var save = el("button", "uui-btn primary", "Simpan");
      save.type = "button";
      var status = el("span", "pro-status", "");
      save.addEventListener("click", function () {
        save.disabled = true;
        status.textContent = "Menyimpan...";
        fetch("/api/gaya", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: state })
        }).then(function (r) { status.textContent = r.ok ? "Tersimpan." : "Gagal menyimpan."; })
          .catch(function () { status.textContent = "Gagal menyimpan."; })
          .then(function () { save.disabled = false; });
      });
      row.appendChild(save); row.appendChild(status);
      body.appendChild(row);
      body.appendChild(el("p", "uui-muted pro-note", "Instruksi khusus tidak mengubah aturan keselamatan dan kejujuran Umaira."));
    }
    render();

    fetch("/api/gaya", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.value && typeof d.value === "object") {
          ["nama", "gaya", "nada", "bahasa", "instruksi"].forEach(function (k) { if (typeof d.value[k] === "string") state[k] = d.value[k]; });
          render();
        }
      }).catch(function () {});
    return card;
  }

  /* ---------- sisipkan kartu ke panel Pengaturan ---------- */
  function inject() {
    var heads = document.querySelectorAll(".uui-card > h3");
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].textContent.trim() !== "Tampilan") continue;
      var card = heads[i].parentNode;
      var next = card.nextElementSibling;
      if (next && next.getAttribute("data-pro")) continue;
      var ref = card;
      if (USER) { var g = gayaCard(); ref.after(g); ref = g; }
      ref.after(lookCard());
    }
  }

  function init() {
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    applyLook();
    var timer = null;
    new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () { timer = null; inject(); }, 200);
    }).observe(document.body, { childList: true, subtree: true });
    inject();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
