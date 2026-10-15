(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $("da-form"), guest = $("da-guest"), btn = $("da-btn"), msg = $("da-msg");
  var proof = $("da-proof"), confirmBox = $("da-confirm");

  fetch("/api/auth/me", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.user) { $("da-email").textContent = d.user.email || d.user.name || ""; form.hidden = false; }
      else { guest.hidden = false; }
    })
    .catch(function () { msg.textContent = "Gagal memeriksa status login. Muat ulang halaman."; });

  function sync() {
    btn.disabled = !(proof.value.trim() && confirmBox.value.trim() === "HAPUS");
  }
  proof.addEventListener("input", sync);
  confirmBox.addEventListener("input", sync);

  function clearLocal() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (k) {
        if (k && k.indexOf("umaira-") === 0 && k !== "umaira-theme-preference") localStorage.removeItem(k);
      });
    } catch (e) { /* abaikan */ }
  }

  btn.addEventListener("click", function () {
    if (!window.confirm("Akun dan semua gambar di Pustaka akan dihapus permanen. Lanjutkan?")) return;
    btn.disabled = true;
    msg.textContent = "Menghapus akun...";
    fetch("/api/auth/delete-account", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmBox.value.trim(), proof: proof.value })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) { msg.textContent = x.d.error || "Gagal menghapus akun."; sync(); return; }
        clearLocal();
        msg.textContent = "Akun dihapus. Mengalihkan...";
        setTimeout(function () { location.href = "/login"; }, 1200);
      })
      .catch(function () { msg.textContent = "Tidak dapat menghubungi server."; sync(); });
  });
})();
