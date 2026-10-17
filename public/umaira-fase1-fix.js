(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    try {
      var b = e.target.closest && e.target.closest("button,[role=button],label,a");
      if (!b || b.closest(".uu1-sheet") || b.closest("#composerMenu")) return;
      var txt = (b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      var hit = /^[+＋]?\s*lampirkan$/.test(txt) || b.id === "composerAttachmentBtn";
      if (!hit || typeof window.umairaKisi !== "function") return;
      window.umairaKisi();
      e.preventDefault(); e.stopImmediatePropagation();
    } catch (err) { /* biarkan menu lama yang bekerja */ }
  }, true);
})();
