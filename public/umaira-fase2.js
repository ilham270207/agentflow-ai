(function () {
  "use strict";
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PIN_KEY = "umaira-pinned-v1";
  var tip = function (a, b, c) { if (window.umairaToast) window.umairaToast(a, b, c); };
  var svg = function (d, fill) { return '<svg viewBox="0 0 24 24" fill="' + (fill ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
  var PEN = svg("M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19zM14 7l3 3");
  var STAR = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  /* ---------- fungsi aplikasi (aman bila tidak terbaca) ---------- */
  function fGet() { return typeof getCurrentMessages === "function" ? getCurrentMessages : window.getCurrentMessages; }
  function fPersist() { return typeof persistConversation === "function" ? persistConversation : window.persistConversation; }
  function fRender() { return typeof renderChatMessages === "function" ? renderChatMessages : window.renderChatMessages; }
  function fSend() { return typeof sendChatMessage === "function" ? sendChatMessage : window.sendChatMessage; }

  /* ---------- 1. Edit pesan ---------- */
  var editing = -1;
  function addEdit() {
    var box = document.getElementById("chatMessages"), get = fGet();
    if (!box || typeof get !== "function") return;
    var msgs = get() || [], nodes = qa(":scope > .chat-message", box);
    if (nodes.length !== msgs.length) return;
    nodes.forEach(function (n, i) {
      var m = msgs[i];
      if (!n.classList.contains("user") || !m || (m.attachments && m.attachments.length) || q(".uu2-uact", n) || editing === i) return;
      var w = q(".chat-response-wrapper", n) || n, row = el("div", "uu2-uact"), b = el("button"); b.type = "button";
      b.title = "Ubah pesan"; b.setAttribute("aria-label", "Ubah pesan"); b.innerHTML = PEN;
      b.onclick = function () { startEdit(i, n, m); };
      row.appendChild(b); w.appendChild(row);
    });
  }
  function startEdit(i, node, m) {
    editing = i;
    var bub = q(".chat-bubble", node); if (!bub) return;
    var ed = el("div", "uu2-edit"), ta = el("textarea"), note = el("small", "", "Pesan setelah ini akan diganti jawaban baru."), end = el("div", "uu2-end");
    ta.value = m.content || ""; ta.maxLength = 8000;
    var c = el("button", "uup-btn", "Batal"), s = el("button", "uup-btn uup-main", "Kirim ulang"); c.type = s.type = "button";
    c.onclick = function () { editing = -1; var r = fRender(); if (typeof r === "function") r(); };
    s.onclick = function () {
      var text = ta.value.trim(); if (!text) return tip("Pesan kosong", "Tulis sesuatu dulu.", "info");
      var get = fGet(), per = fPersist(), ren = fRender(), snd = fSend(), inp = document.getElementById("chatInput");
      if (![get, per, ren, snd].every(function (f) { return typeof f === "function"; }) || !inp) return tip("Belum bisa mengedit", "Fungsi chat tidak terbaca dari luar app.js.", "warn");
      var arr = get(); if (!Array.isArray(arr) || !arr[i]) return;
      arr.splice(i); per(); editing = -1; ren();
      inp.value = text; inp.dispatchEvent(new Event("input", { bubbles: true }));
      snd();
    };
    end.appendChild(c); end.appendChild(s); ed.appendChild(ta); ed.appendChild(note); ed.appendChild(end);
    bub.replaceChildren(ed); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  /* ---------- 2. Sematkan riwayat ---------- */
  function pins() { try { var a = JSON.parse(localStorage.getItem(PIN_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function savePins(a) { try { localStorage.setItem(PIN_KEY, JSON.stringify(a.slice(0, 30))); return true; } catch (e) { tip("Gagal menyimpan", "Penyimpanan browser penuh atau diblokir.", "warn"); return false; } }
  function toggle(id) {
    if (!id) return tip("Pilih obrolan dulu", "Buka satu obrolan, lalu tandai.", "info");
    var a = pins(), on = a.indexOf(id) < 0;
    if (on) a.unshift(id); else a = a.filter(function (x) { return x !== id; });
    if (!savePins(a)) return;
    tip(on ? "Ditandai penting" : "Tanda dilepas", on ? "Obrolan naik ke bagian Disematkan." : "", "ok");
    applyPins();
  }
  function activeId() { var r = q(".chat-history-row.active"); return r ? r.getAttribute("data-chat-row") : ""; }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest('[data-header-action="pin"]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var m = document.getElementById("chatHeaderMenu"); if (m) m.hidden = true;
    toggle(activeId());
  }, true);

  var holdT = 0, held = false;
  document.addEventListener("pointerdown", function (e) {
    var r = e.target.closest && e.target.closest(".chat-history-row"); if (!r || e.target.closest("button")) return;
    held = false; clearTimeout(holdT);
    holdT = setTimeout(function () { held = true; toggle(r.getAttribute("data-chat-row")); }, 600);
  });
  ["pointerup", "pointercancel", "pointermove", "scroll"].forEach(function (ev) { document.addEventListener(ev, function () { clearTimeout(holdT); }, true); });
  document.addEventListener("click", function (e) {
    if (held && e.target.closest && e.target.closest(".chat-history-row")) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); held = false; }
  }, true);

  function applyPins() {
    var list = document.getElementById("chatHistoryList"); if (!list) return;
    var a = pins(), rows = qa(".chat-history-row[data-chat-row]", list), zone = q(".uu2-pinned", list);
    rows.forEach(function (r) {
      var on = a.indexOf(r.getAttribute("data-chat-row")) > -1, b = q(".uu2-badge", r);
      r.classList.toggle("uu2-pin", on);
      if (on && !b) { b = el("span", "uu2-badge"); b.innerHTML = svg(STAR, true); r.appendChild(b); }
      if (!on && b) b.remove();
    });
    var pinned = a.map(function (id) { return rows.filter(function (r) { return r.getAttribute("data-chat-row") === id; })[0]; }).filter(Boolean);
    if (!pinned.length) { if (zone) zone.remove(); return; }
    if (!zone) {
      zone = el("div", "uu2-pinned"); var lb = el("div", "uu2-pinned-label"); lb.innerHTML = svg(STAR, true) + "<span>Disematkan</span>"; zone.appendChild(lb);
      list.insertBefore(zone, list.firstChild);
    }
    pinned.forEach(function (r) { if (r.parentElement !== zone) zone.appendChild(r); });
  }

  var t = 0;
  function run() { if (t) return; t = requestAnimationFrame(function () { t = 0; try { addEdit(); applyPins(); } catch (e) {} }); }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();
})();
