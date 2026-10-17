(function () {
  "use strict";
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var svg = function (d) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  };
  var I = {
    info: svg("M21 12a9 9 0 11-18 0 9 9 0 0118 0zM12 11v5M12 8h.01"),
    ok: svg("M5 12.5l4.5 4.5L19 7.5"),
    warn: svg("M12 9v4M12 17h.01M10.3 4.2L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z"),
    x: svg("M6 6l12 12M18 6L6 18"),
    dl: svg("M12 4v11M7 11l5 5 5-5M5 20h14"),
    up: svg("M12 20V9M7 13l5-5 5 5M5 4h14")
  };
  function pill(t, on) { var b = document.createElement("button"); b.type = "button"; b.className = "uup-pill" + (on ? " on" : ""); b.textContent = t; return b; }
  function btn(icon, t) { var b = document.createElement("button"); b.type = "button"; b.className = "uup-btn"; b.innerHTML = icon + "<span></span>"; q("span", b).textContent = t; return b; }
  function view() { var t = q("#featureTitle"); return t && t.offsetParent ? t.textContent.trim().toLowerCase() : ""; }

  /* ---------- 1. Toast menggantikan alert bawaan ---------- */
  var stack = null;
  function toast(title, sub, kind, ms) {
    kind = kind || "info";
    if (!stack) {
      stack = document.createElement("div"); stack.className = "uup-stack";
      stack.setAttribute("role", "status"); stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    if (qa(".uup-toast strong", stack).some(function (s) { return s.textContent === title; })) return;
    var t = document.createElement("div");
    t.className = "uup-toast uup-" + kind;
    t.innerHTML = '<span class="uup-ti">' + I[kind] + '</span><div class="uup-tt"><strong></strong><small></small></div><button type="button" class="uup-tx" aria-label="Tutup">' + I.x + "</button>";
    q("strong", t).textContent = title;
    var sm = q("small", t); if (sub) sm.textContent = sub; else sm.remove();
    function close() { t.classList.add("uup-leave"); setTimeout(function () { t.remove(); }, 200); }
    q(".uup-tx", t).onclick = close;
    stack.appendChild(t); setTimeout(close, ms || 3800);
  }
  window.umairaToast = toast;
  var MAP = [
    [/belum ada pesan untuk diekspor/i, "Belum ada yang bisa diekspor", "Mulai obrolan dulu, lalu ekspor dari sini.", "info"],
    [/isi obrolan disalin/i, "Obrolan disalin", "Isinya sudah ada di clipboard.", "ok"],
    [/failed to regenerate/i, "Gagal membuat ulang tugas", "Coba lagi sebentar lagi.", "warn"],
    [/pilih task/i, "Pilih tugas dulu", "Pilih tugas yang ingin dibuat ulang.", "info"]
  ];
  window.alert = function (m) {
    m = String(m == null ? "" : m);
    for (var i = 0; i < MAP.length; i++) if (MAP[i][0].test(m)) return toast(MAP[i][1], MAP[i][2], MAP[i][3]);
    toast(m.length > 110 ? m.slice(0, 107) + "…" : m, "", /gagal|error|salah|tidak (bisa|dapat)/i.test(m) ? "warn" : "info");
  };

  /* ---------- konfirmasi kaca ---------- */
  function ask(title, msg, ok) {
    return new Promise(function (res) {
      var o = document.createElement("div"); o.className = "uup-modal";
      o.innerHTML = '<div class="uup-card" role="dialog" aria-modal="true"><h3></h3><p></p><div class="uup-row"><button type="button" class="uup-btn" data-r="0">Batal</button><button type="button" class="uup-btn uup-main" data-r="1"></button></div></div>';
      q("h3", o).textContent = title; q("p", o).textContent = msg; q(".uup-main", o).textContent = ok || "Lanjutkan";
      o.onclick = function (e) { var r = e.target.getAttribute && e.target.getAttribute("data-r"); if (r !== null || e.target === o) { o.remove(); res(r === "1"); } };
      document.body.appendChild(o);
    });
  }

  /* ---------- 2. Lab kode ---------- */
  var QUICK = [
    ["Jelaskan kode", "Jelaskan kode berikut baris per baris dengan bahasa sederhana."],
    ["Cari bug", "Periksa kode berikut, cari bug atau masalah tersembunyi, lalu berikan perbaikannya."],
    ["Buat unit test", "Tulis unit test lengkap untuk kode berikut, termasuk kasus tepi."],
    ["Rapikan & optimalkan", "Refactor kode berikut agar lebih rapi, mudah dibaca, dan efisien, lalu jelaskan perubahannya."],
    ["Tambah komentar", "Tambahkan komentar singkat dalam bahasa Indonesia pada kode berikut tanpa mengubah logikanya."],
    ["Ubah ke Python", "Ubah kode berikut ke Python dengan perilaku yang sama."]
  ];
  function panel(blk, title) {
    var old = blk.nextElementSibling; if (old && old.classList.contains("uup-out")) old.remove();
    var box = document.createElement("div"); box.className = "uup-out";
    box.innerHTML = '<header><span></span><button type="button" class="uup-tx" aria-label="Tutup">' + I.x + '</button></header><div class="uup-body"></div>';
    q("span", box).textContent = title; q("button", box).onclick = function () { box.remove(); };
    blk.insertAdjacentElement("afterend", box);
    return q(".uup-body", box);
  }
  function line(body, cls, text) { var p = document.createElement("pre"); if (cls) p.className = cls; p.textContent = text; body.appendChild(p); }
  function runJS(code, blk) {
    var body = panel(blk, "Hasil (dijalankan di sandbox, maks 5 detik)"), got = false, w, url;
    var src = 'var __f=function(a){return Array.prototype.map.call(a,function(x){try{return typeof x==="object"?JSON.stringify(x,null,2):String(x)}catch(e){return String(x)}}).join(" ")};' +
      '["log","info","warn","error"].forEach(function(k){console[k]=function(){postMessage({k:k,t:__f(arguments)})}});\ntry{\n' + code + '\n}catch(e){postMessage({k:"error",t:String(e)})}\npostMessage({k:"done"});';
    try { url = URL.createObjectURL(new Blob([src], { type: "text/javascript" })); w = new Worker(url); }
    catch (e) { line(body, "e", "Browser tidak mengizinkan menjalankan kode di sini."); return; }
    var timer = setTimeout(function () { w.terminate(); line(body, "e", "Dihentikan: berjalan lebih dari 5 detik."); }, 5000);
    w.onmessage = function (ev) {
      var d = ev.data || {};
      if (d.k === "done") { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); if (!got) line(body, "w", "(tidak ada keluaran, gunakan console.log untuk menampilkan hasil)"); return; }
      got = true; line(body, d.k === "error" ? "e" : d.k === "warn" ? "w" : "", d.t);
    };
    w.onerror = function (ev) { clearTimeout(timer); line(body, "e", ev.message || "Terjadi error"); w.terminate(); if (ev.preventDefault) ev.preventDefault(); };
  }
  function previewHTML(code, blk) {
    var body = panel(blk, "Pratinjau"), f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts"); f.srcdoc = code; body.appendChild(f);
  }
  function codex() {
    var ta = q('textarea[placeholder^="Instruksi"]');
    if (!ta || !ta.offsetParent) return;
    if (!q('.uup-chips[data-k="codex"]')) {
      var box = document.createElement("div"); box.className = "uup-chips"; box.setAttribute("data-k", "codex");
      QUICK.forEach(function (p) {
        var b = pill(p[0]);
        b.onclick = function () { ta.value = p[1]; ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); };
        box.appendChild(b);
      });
      ta.parentNode.insertBefore(box, ta);
    }
    qa("button").forEach(function (b) {
      if (b.dataset.uup || b.textContent.trim() !== "Salin" || !b.offsetParent) return;
      b.dataset.uup = "1";
      var blk = b.parentElement, n = 0;
      while (blk && !blk.querySelector("pre") && n++ < 4) blk = blk.parentElement;
      if (!blk) return;
      var pre = q("pre", blk), head = (blk.textContent || "").trim().slice(0, 24).toLowerCase();
      var js = /^(javascript|js|node)\b/.test(head), html = /^html\b/.test(head);
      if (!pre || (!js && !html)) return;
      var r = document.createElement("button"); r.type = "button"; r.className = b.className; r.textContent = js ? "Jalankan" : "Pratinjau";
      r.onclick = function () { var code = pre.textContent || ""; if (js) runJS(code, blk); else previewHTML(code, blk); };
      b.parentNode.insertBefore(r, b);
    });
  }

  /* ---------- 3. Ekstensi: cari & saring ---------- */
  var st = { q: "", f: "all" };
  function plugins() {
    if (view() !== "ekstensi") return;
    var h = qa("h2").filter(function (e) { return e.offsetParent && e.textContent.trim().toLowerCase() === "ekstensi"; })[0];
    if (!h) return;
    var host = h.parentElement, n = 0;
    while (host && !host.querySelector("input[type=checkbox]") && n++ < 3) host = host.parentElement;
    if (!host) return;
    var cbs = qa("input[type=checkbox]", host); if (!cbs.length) return;
    var cards = cbs.map(function (cb) {
      var el = cb;
      while (el.parentElement && el.parentElement !== host && el.parentElement.querySelectorAll("input[type=checkbox]").length === 1) el = el.parentElement;
      return el;
    });
    var bar = q('.uup-bar[data-k="plug"]', host), count;
    if (!bar) {
      bar = document.createElement("div"); bar.className = "uup-bar"; bar.setAttribute("data-k", "plug");
      var s = document.createElement("input"); s.type = "search"; s.className = "uup-search"; s.placeholder = "Cari ekstensi..."; s.setAttribute("aria-label", "Cari ekstensi"); s.value = st.q;
      s.oninput = function () { st.q = s.value.trim().toLowerCase(); run(); };
      bar.appendChild(s);
      [["all", "Semua"], ["on", "Aktif"], ["off", "Nonaktif"]].forEach(function (f) {
        var p = pill(f[1], st.f === f[0]); p.setAttribute("data-f", f[0]);
        p.onclick = function () { st.f = f[0]; qa(".uup-pill", bar).forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-f") === st.f); }); run(); };
        bar.appendChild(p);
      });
      count = document.createElement("span"); count.className = "uup-count"; bar.appendChild(count);
      cards[0].parentElement.insertBefore(bar, cards[0]);
    }
    count = q(".uup-count", bar);
    var shown = 0;
    cards.forEach(function (c, i) {
      var okq = !st.q || c.textContent.toLowerCase().indexOf(st.q) > -1;
      var okf = st.f === "all" || (st.f === "on" && cbs[i].checked) || (st.f === "off" && !cbs[i].checked);
      c.style.display = okq && okf ? "" : "none"; if (okq && okf) shown++;
    });
    count.textContent = shown + " dari " + cards.length;
  }
  document.addEventListener("change", function (e) { if (e.target && e.target.type === "checkbox") setTimeout(run, 80); });

  /* ---------- 4. Ruang proyek: cadangkan & pulihkan ---------- */
  var RE = /project|proyek/i;
  function backup() {
    var data = {}, i, k;
    try { for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); if (RE.test(k)) data[k] = localStorage.getItem(k); } } catch (e) {}
    if (!Object.keys(data).length) return toast("Belum ada proyek", "Buat proyek dulu, lalu cadangkan.", "info");
    var blob = new Blob([JSON.stringify({ app: "umaira", type: "projects", version: 1, exportedAt: new Date().toISOString(), data: data }, null, 2)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "umaira-proyek-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast("Cadangan tersimpan", "File JSON sudah diunduh.", "ok");
  }
  function restore(file) {
    var r = new FileReader();
    r.onload = function () {
      var o; try { o = JSON.parse(r.result); } catch (e) { return toast("File tidak valid", "Pilih file cadangan Umaira (.json).", "warn"); }
      var keys = o && o.app === "umaira" && o.type === "projects" && o.data ? Object.keys(o.data) : [];
      if (!keys.length || !keys.every(function (k) { return RE.test(k); })) return toast("File tidak dikenali", "Ini bukan cadangan proyek Umaira.", "warn");
      ask("Pulihkan proyek?", "Proyek di perangkat ini akan ditimpa isi cadangan (" + keys.length + " data).", "Pulihkan").then(function (ok) {
        if (!ok) return;
        try { keys.forEach(function (k) { localStorage.setItem(k, String(o.data[k])); }); } catch (e) { return toast("Gagal memulihkan", "Penyimpanan browser penuh atau diblokir.", "warn"); }
        toast("Proyek dipulihkan", "Memuat ulang...", "ok", 1500); setTimeout(function () { location.reload(); }, 1000);
      });
    };
    r.readAsText(file);
  }
  function projects() {
    var pb = q(".projects-button"); if (!pb || !pb.offsetParent || q(".uup-pbar")) return;
    var wrap = document.createElement("div"); wrap.className = "uup-bar uup-pbar";
    var b1 = btn(I.dl, "Cadangkan proyek"), b2 = btn(I.up, "Pulihkan"), fi = document.createElement("input");
    fi.type = "file"; fi.accept = "application/json,.json"; fi.hidden = true;
    b1.onclick = backup; b2.onclick = function () { fi.click(); };
    fi.onchange = function () { if (fi.files[0]) restore(fi.files[0]); fi.value = ""; };
    wrap.appendChild(b1); wrap.appendChild(b2); wrap.appendChild(fi);
    (pb.parentElement || pb).insertAdjacentElement("afterend", wrap);
  }

  var t = 0;
  function run() { if (t) return; t = requestAnimationFrame(function () { t = 0; try { codex(); plugins(); projects(); } catch (e) {} }); }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();
})();
