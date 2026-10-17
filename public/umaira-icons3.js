(function () {
  var S = function (d) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  };
  var NEW = S("M12 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-5M17.5 3.5a2 2 0 0 1 3 3L11 16l-4 1 1-4z");
  var EXP = S("M12 4v11M7 11l5 5 5-5M5 20h14");
  var busy = false;

  function run() {
    if (busy) return; busy = true;
    requestAnimationFrame(function () {
      try {
        var exp = document.querySelector('[data-uu="exp"]');
        if (!exp) {
          document.querySelectorAll("button, a").forEach(function (b) {
            if (exp || b.closest(".sidebar")) return;
            var t = (b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            if (/^ekspor\b/.test(t) && t.length < 12) exp = b;
          });
          if (exp) {
            exp.innerHTML = EXP; exp.classList.add("uu-iconbtn"); exp.dataset.uu = "exp";
            exp.title = "Ekspor obrolan"; exp.setAttribute("aria-label", "Ekspor obrolan");
          }
        }
        if (exp && !document.getElementById("uuNewTop")) {
          var nb = document.createElement("button");
          nb.type = "button"; nb.id = "uuNewTop"; nb.className = exp.className;
          nb.innerHTML = NEW; nb.title = "Obrolan baru"; nb.setAttribute("aria-label", "Obrolan baru");
          nb.addEventListener("click", function () {
            var b = document.getElementById("newChatBtn"); if (b) b.click();
          });
          exp.parentNode.insertBefore(nb, exp);
        }
      } catch (e) {}
      busy = false;
    });
  }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();

  // thumbnail kecil (maks 240px, jpeg) agar tersimpan bersama pesan
  window.__uuThumbData = window.__uuThumbData || {};
  window.__uuThumbBusy = window.__uuThumbBusy || {};
  window.uuMakeThumb = function (file) {
    try {
      if (!file || !String(file.type || "").startsWith("image/")) return;
      var key = file.name + "|" + file.size;
      if (window.__uuThumbData[key] || window.__uuThumbBusy[key]) return;
      window.__uuThumbBusy[key] = 1;
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 240 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        try { window.__uuThumbData[key] = c.toDataURL("image/jpeg", 0.72); } catch (e) {}
        URL.revokeObjectURL(url);
      };
      img.onerror = function () { URL.revokeObjectURL(url); };
      img.src = url;
    } catch (e) {}
  };
})();
