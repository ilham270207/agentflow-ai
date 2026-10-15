/* Umaira composer modern v1: menandai komposer saat ada teks atau lampiran */
(function () {
  var composer = document.querySelector(".chat-composer");
  if (!composer) return;
  var ta = composer.querySelector("textarea");
  var att = document.getElementById("composerAttachments");
  function sync() {
    var has = (ta && ta.value.trim().length > 0) || (att && att.children.length > 0);
    composer.classList.toggle("has-text", !!has);
  }
  if (ta) ["input", "change", "keyup"].forEach(function (e) { ta.addEventListener(e, sync); });
  if (att && window.MutationObserver) new MutationObserver(sync).observe(att, { childList: true });
  setInterval(sync, 300); // menangkap value yang dikosongkan lewat kode setelah kirim
  sync();
})();
