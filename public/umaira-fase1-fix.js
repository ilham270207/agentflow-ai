(function () {
  "use strict";
  function bukaKisi() {
    if (typeof window.umairaKisi !== "function") return false;
    try { window.umairaKisi(); return true; } catch (e) { return false; }
  }
  // jalur 1: tombol dikenali dari tulisannya
  document.addEventListener("click", function (e) {
    try {
      var b = e.target.closest && e.target.closest("button,[role=button],label,a");
      if (!b || b.closest(".uu1-sheet") || b.closest("#composerMenu")) return;
      var txt = (b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!/^[+＋]?\s*lampirkan$/.test(txt)) return;
      if (bukaKisi()) { e.preventDefault(); e.stopImmediatePropagation(); }
    } catch (err) {}
  }, true);
  // jalur 2 (jaring pengaman): menu lama hendak terbuka -> buka kisi
  var menu = document.getElementById("composerMenu"), busy = false;
  if (menu) {
    new MutationObserver(function () {
      if (busy) return;
      var shown = !menu.hidden && getComputedStyle(menu).display !== "none";
      if (!shown) return;
      busy = true;
      if (bukaKisi()) {
        menu.hidden = true;
        ["open", "show", "active", "is-open"].forEach(function (c) { menu.classList.remove(c); });
      }
      setTimeout(function () { busy = false; }, 80);
    }).observe(menu, { attributes: true, attributeFilter: ["hidden", "class", "style"] });
  }
})();
