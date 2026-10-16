(() => {
  const G = "url(#umairaGrad)";
  const P = (d) => '<path d="' + d + '"/>';
  const A = (d) => '<path d="' + d + '" stroke="' + G + '"/>';
  const F = (d) => '<path d="' + d + '" fill="' + G + '" stroke="none"/>';
  const wrap = (inner) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + "</svg>";

  const ICONS = {
    chat: wrap(
      P("M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11.5L8 18.5V15h-.5A2.5 2.5 0 0 1 5 12.5z") +
      F("M12 7.4l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z")),
    archive: wrap(
      P("M5.5 9.5v8A1.5 1.5 0 0 0 7 19h10a1.5 1.5 0 0 0 1.5-1.5v-8") +
      P("M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 8z") +
      A("M10 13h4")),
    library: wrap(
      P("M5 5.5h3.2v13H5z") + P("M10.4 5.5h3.2v13h-3.2z") + P("M15.6 6.6l3-.8 2.9 12.4-3 .8z") +
      A("M10.4 9.5h3.2")),
    scheduled: wrap(
      '<circle cx="12" cy="12" r="7.5"/>' + A("M12 8.2V12l2.6 1.6")),
    images: wrap(
      P("M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5z") +
      P("M4 16.5l4.2-4.2 3 3 2.3-2.3 4.5 4.5") +
      F("M16.5 8.2l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3-1.3-.6 1.3-.6z")),
    plugins: wrap(
      P("M9 4v3.5") + P("M15 4v3.5") + P("M7 7.5h10V11a5 5 0 0 1-10 0z") + A("M12 16v4")),
    projects: wrap(
      P("M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l1.8 2h8A1.5 1.5 0 0 1 20.5 9v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z") +
      A("M9 13.3l2.2 2.2 3.9-3.9")),
    codex: wrap(
      P("M8.5 8L4.8 12l3.7 4") + P("M15.5 8l3.7 4-3.7 4") + A("M13.3 6.5l-2.6 11")),
    settings: wrap(
      P("M4.5 7h15") + P("M4.5 12h15") + P("M4.5 17h15") +
      '<circle cx="9" cy="7" r="2" fill="' + G + '" stroke="none"/>' +
      '<circle cx="15" cy="12" r="2" fill="' + G + '" stroke="none"/>' +
      '<circle cx="10" cy="17" r="2" fill="' + G + '" stroke="none"/>'),
    account: wrap(
      '<circle cx="12" cy="8.8" r="3.3" stroke="' + G + '"/>' + P("M5.5 19.2a6.5 6.5 0 0 1 13 0"))
  };

  // definisi gradasi (userSpaceOnUse agar garis lurus pun ikut bergradasi)
  const sprite = document.createElement("div");
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  sprite.innerHTML =
    '<svg width="0" height="0" focusable="false"><defs>' +
    '<linearGradient id="umairaGrad" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">' +
    '<stop offset="0" stop-color="#6d5dfc"/><stop offset="1" stop-color="#c26bf5"/>' +
    "</linearGradient></defs></svg>";
  document.body.prepend(sprite);

  const BY_ID = { navArchiveBtn: "archive", navSettingsBtn: "settings", navLoginBtn: "account" };
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const key = btn.dataset.view || BY_ID[btn.id];
    const icon = btn.querySelector(".nav-icon");
    if (!key || !ICONS[key] || !icon) return;
    if (icon.querySelector("img.wsm-avatar")) return; // foto Google tetap dipakai
    icon.innerHTML = ICONS[key];
    icon.classList.add("wsm-ico");
  });
})();
