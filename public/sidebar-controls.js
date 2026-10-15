
// ===== UMAIRA SIDEBAR CONTROLS =====
(() => {
  const errs = [];
  const banner = () => {
    if (!errs.length) return;
    let t = document.getElementById("umairaDiag");
    if (!t) {
      t = document.createElement("div"); t.id = "umairaDiag";
      t.style.cssText = "position:fixed;left:6px;right:6px;top:62px;z-index:99999;padding:6px 10px;" +
        "border-radius:8px;background:#000d;color:#d7c2fa;font:11px monospace;word-break:break-all";
      t.addEventListener("click", () => t.remove());
      document.body.appendChild(t);
    }
    t.textContent = "sidebar v4 | w=" + window.innerWidth +
      " mobile=" + window.matchMedia("(max-width: 760px)").matches +
      (errs.length ? " | ERROR: " + errs.join(" || ") : " | tidak ada error");
    clearTimeout(t._h);
    if (!errs.length) t._h = setTimeout(() => t.remove(), 12000);
  };
  window.addEventListener("error", e => {
    errs.push((e.message || "error") + " @" + String(e.filename || "").split("/").pop() + ":" + e.lineno);
    banner();
  });
  window.addEventListener("unhandledrejection", e => {
    errs.push("promise: " + String(e.reason && e.reason.message || e.reason));
    banner();
  });
  const body = document.body;
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  const topbar = document.querySelector(".topbar");
  const KEY = "umaira-sidebar-collapsed";
  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

  const syncTop = () => {
    if (topbar) {
      document.documentElement.style.setProperty(
        "--umaira-top", Math.round(topbar.getBoundingClientRect().height) + "px");
    }
  };
  const applyMobile = () => {
    const sb = document.querySelector(".sidebar");
    if (!sb) return;
    const props = ["position","top","bottom","left","width","z-index","display",
      "flex-direction","overflow-y","height","background","visibility","opacity","transform"];
    if (!isMobile()) { props.forEach(k => sb.style.removeProperty(k)); return; }
    const open = body.classList.contains("sidebar-open");
    const set = (k, v) => sb.style.setProperty(k, v, "important");
    set("position", "fixed");
    set("top", (topbar ? Math.round(topbar.getBoundingClientRect().height) : 56) + "px");
    set("bottom", "0"); set("height", "auto");
    set("left", open ? "0" : "-340px");
    set("width", "min(300px, 86vw)");
    set("z-index", "60"); set("display", "flex"); set("flex-direction", "column");
    set("overflow-y", "auto"); set("background", open ? "#ffffff" : "#ffffff");
    set("visibility", "visible"); set("opacity", "1"); set("transform", "none");
  };
  const toast = msg => {
    let t = document.getElementById("umairaSidebarToast");
    if (!t) {
      t = document.createElement("div"); t.id = "umairaSidebarToast";
      t.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;padding:6px 10px;" +
        "border-radius:8px;background:#000c;color:#d7c2fa;font:11px monospace;pointer-events:none";
      document.body.appendChild(t);
    }
    t.textContent = msg; clearTimeout(t._h); t._h = setTimeout(() => t.remove(), 4000);
  };
  const syncAria = () => {
    applyMobile();
    if (!toggle) return;
    const open = isMobile()
      ? body.classList.contains("sidebar-open")
      : !body.classList.contains("sidebar-collapsed");
    toggle.setAttribute("aria-expanded", String(open));
  };
  const closeMobile = () => { body.classList.remove("sidebar-open"); syncAria(); };
  const closeMenus = () => {
    document.querySelectorAll(".chat-history-menu").forEach(m => { m.hidden = true; });
  };

  try {
    if (localStorage.getItem(KEY) === "1") body.classList.add("sidebar-collapsed");
  } catch (e) { /* abaikan */ }
  syncTop(); syncAria();

  toggle?.addEventListener("click", () => {
    syncTop();
    if (isMobile()) {
      body.classList.toggle("sidebar-open");
    } else {
      body.classList.toggle("sidebar-collapsed");
      try {
        localStorage.setItem(KEY, body.classList.contains("sidebar-collapsed") ? "1" : "0");
      } catch (e) { /* abaikan */ }
    }
    syncAria();
  });

  backdrop?.addEventListener("click", closeMobile);

  window.addEventListener("resize", () => {
    syncTop();
    if (!isMobile()) body.classList.remove("sidebar-open");
    syncAria();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeMenus(); closeMobile(); }
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".chat-history-menu, .chat-history-menu-btn")) closeMenus();
  });
  document.addEventListener("scroll", closeMenus, true);

  document.querySelectorAll(".nav-item[data-view]").forEach(item => {
    item.addEventListener("click", () => { if (isMobile()) closeMobile(); });
  });

  document.getElementById("newChatBtn")?.addEventListener("click", () => {
    const chatNav = document.querySelector('.nav-item[data-view="chat"]');
    if (chatNav) chatNav.click();
    window.__umairaShowArchived = false;
    const s = document.getElementById("chatSearchInput");
    if (s) s.value = "";
    closeMobile();
  });

  const search = document.getElementById("chatSearchInput");
  search?.addEventListener("input", () => { if (typeof renderChatHistory === "function") renderChatHistory(); });
  search?.addEventListener("keydown", e => {
    if (e.key === "Escape") { search.value = ""; if (typeof renderChatHistory === "function") renderChatHistory(); }
  });
})();
// ===== END UMAIRA SIDEBAR CONTROLS =====
