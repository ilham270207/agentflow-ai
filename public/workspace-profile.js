(() => {
  const btn = document.getElementById("navLoginBtn");
  if (!btn) return;
  let url = "";
  let failed = false;

  function apply() {
    if (!url || failed) return;
    const icon = btn.querySelector(".nav-icon");
    if (!icon || icon.querySelector("img.wsm-avatar")) return;
    const img = document.createElement("img");
    img.className = "wsm-avatar";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => { failed = true; img.remove(); icon.textContent = "♙"; });
    img.src = url;
    icon.textContent = "";
    icon.appendChild(img);
  }

  fetch("/api/auth/me", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((d) => {
      if (d && d.user && d.user.picture) {
        url = d.user.picture;
        apply();
        new MutationObserver(apply).observe(btn, { childList: true, subtree: true, characterData: true });
      }
    })
    .catch(() => {});
})();
