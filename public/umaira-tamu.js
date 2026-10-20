(function () {
  if (window.__UMAIRA_USER__ || !window.__UMAIRA_GUEST__) return;

  // Fitur yang butuh akun. Ubah daftar ini kalau ada yang ternyata bisa dipakai tamu.
  var LOCKED = ["studio gambar", "ekstensi", "ruang proyek", "lab kode", "koleksi", "pengingat"];
  var INFO = "Masuk atau daftar gratis untuk membuka Studio gambar, Ekstensi, Ruang proyek, Lab kode, Koleksi, dan Pengingat, serta menyimpan obrolanmu di akun.";

  var origFetch = window.fetch;
  function pathOf(input) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || String(input);
      var u = new URL(url, location.href);
      return u.origin === location.origin ? u.pathname : "";
    } catch (e) { return ""; }
  }
  window.fetch = function (input) {
    var p = pathOf(input);
    if (p.indexOf("/api/") === 0) {
      var open = p === "/api/chat" || p === "/api/health" || p === "/api/auth" || p.indexOf("/api/auth/") === 0;
      if (!open) {
        return Promise.resolve(new Response(JSON.stringify({ error: "Masuk untuk memakai fitur ini.", login: true }), {
          status: 401, headers: { "Content-Type": "application/json" }
        }));
      }
      if (p === "/api/chat") {
        var pr = origFetch.apply(this, arguments);
        pr.then(function (res) {
          res.clone().json().then(function (d) {
            if (d && d.mode === "guest-limit") openModal("Batas pesan tamu tercapai", d.message);
          }).catch(function () {});
        }, function () {});
        return pr;
      }
    }
    return origFetch.apply(this, arguments);
  };

  var CSS = [
    '.tm-pill{position:fixed;top:10px;right:10px;z-index:9998;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;font-family:inherit;background:var(--accent-strong,#3a18e5);color:#fff;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.35)}',
    '.tm-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:16px}',
    '.tm-card{width:100%;max-width:360px;background:var(--panel,#0a0913);color:var(--text,#f5f4fd);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;font-family:inherit}',
    '.tm-card h3{margin:0 0 8px;font-size:17px}',
    '.tm-card p{margin:0 0 16px;font-size:13px;line-height:1.5;color:var(--text-soft,#d9d5ee)}',
    '.tm-row{display:flex;gap:8px;flex-wrap:wrap}',
    '.tm-btn{padding:9px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:inherit;font-size:13px;font-family:inherit;text-decoration:none;cursor:pointer}',
    '.tm-primary{background:var(--accent-strong,#3a18e5);border-color:transparent;color:#fff}',
    '.nav-item[data-tm-lock]::after{content:"\\1F512";font-size:11px;margin-left:auto;opacity:.7}'
  ].join("");

  function openModal(title, text) {
    if (document.querySelector(".tm-ov")) return;
    var ov = document.createElement("div");
    ov.className = "tm-ov";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var card = document.createElement("div");
    card.className = "tm-card";
    var h = document.createElement("h3");
    h.textContent = title;
    var p = document.createElement("p");
    p.textContent = text;
    var row = document.createElement("div");
    row.className = "tm-row";
    var a = document.createElement("a");
    a.className = "tm-btn tm-primary";
    a.href = "/login";
    a.textContent = "Masuk / Daftar gratis";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tm-btn";
    b.textContent = "Nanti saja";
    row.appendChild(a); row.appendChild(b);
    card.appendChild(h); card.appendChild(p); card.appendChild(row);
    ov.appendChild(card);
    function close() { ov.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    b.addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
    a.focus();
  }

  function label(el) { return (el.textContent || "").replace(/\s+/g, " ").trim(); }
  function isLocked(el) {
    var t = label(el).toLowerCase();
    return LOCKED.some(function (n) { return t.indexOf(n) !== -1; });
  }
  function mark() {
    var items = document.querySelectorAll(".nav-item");
    for (var i = 0; i < items.length; i++) {
      if (isLocked(items[i])) items[i].setAttribute("data-tm-lock", "1");
    }
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var nav = t.closest(".nav-item");
    if (nav && isLocked(nav)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openModal(label(nav) + " khusus anggota", INFO);
      return;
    }
    if (t.closest('input[type="file"]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openModal("Lampiran khusus anggota", "Unggah foto dan berkas tersedia setelah kamu masuk. " + INFO);
    }
  }, true);

  function init() {
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    var pill = document.createElement("a");
    pill.className = "tm-pill";
    pill.href = "/login";
    pill.textContent = "Masuk / Daftar";
    pill.title = "Kamu memakai mode tamu";
    document.body.appendChild(pill);
    mark();
    var timer = null;
    new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () { timer = null; mark(); }, 300);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
