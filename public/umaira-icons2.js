(function () {
  var KEYS = { navArchiveBtn: "archive", navSettingsBtn: "settings", navLoginBtn: "account" };
  var TIPS = { "copy-response-button": "Salin", "regenerate-button": "Buat ulang" };
  var busy = false;

  function navIcons() {
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      var key = btn.dataset.view || KEYS[btn.id];
      var icon = btn.querySelector(".nav-icon");
      if (!key || !icon || icon.querySelector("img.wsm-avatar") || icon.querySelector(".uu-i")) return;
      icon.innerHTML = '<i class="uu-i" data-i="' + key + '"></i>';
    });
    var plus = document.querySelector("#newChatBtn span:first-child");
    if (plus && !plus.querySelector(".uu-i")) plus.innerHTML = '<i class="uu-i" data-i="plus"></i>';
  }

  function mk(cls, label) {
    var b = document.createElement("button");
    b.type = "button"; b.className = cls; b.title = label;
    b.setAttribute("aria-label", label);
    return b;
  }

  function actions() {
    document.querySelectorAll(".chat-message-actions").forEach(function (box) {
      box.querySelectorAll("button").forEach(function (b) {
        Object.keys(TIPS).forEach(function (k) { if (b.classList.contains(k)) b.title = TIPS[k]; });
      });
      if (box.querySelector(".uu-like")) return;
      var up = mk("uu-like", "Suka"), dn = mk("uu-dislike", "Tidak suka");
      function pick(me, other) {
        var on = !me.classList.contains("uu-on");
        me.classList.toggle("uu-on", on);
        other.classList.remove("uu-on");
      }
      up.onclick = function () { pick(up, dn); };
      dn.onclick = function () { pick(dn, up); };
      box.appendChild(up); box.appendChild(dn);
    });
  }

  function run() {
    if (busy) return; busy = true;
    requestAnimationFrame(function () { try { navIcons(); actions(); } catch (e) {} busy = false; });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".copy-response-button");
    if (!b) return;
    b.classList.add("uu-done");
    setTimeout(function () { b.classList.remove("uu-done"); }, 1400);
  });

  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  run();
})();
