// Umaira theme + layout v2
document.addEventListener("click", function (e) {
  var t = e.target;
  if (!t || !t.closest) return;

  var go = t.closest("[data-view-goto]");
  if (go) {
    var nav = document.querySelector('.nav-item[data-view="' + go.getAttribute("data-view-goto") + '"]');
    if (nav) nav.click();
    return;
  }

  var pr = t.closest(".umaira-suggest[data-prompt], .umaira-chip[data-prompt]");
  if (pr) {
    var input = document.getElementById("chatInput");
    if (!input) return;
    input.value = pr.getAttribute("data-prompt") || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    return;
  }

  if (t.closest("#sidebarCollapseBtn, #sidebarReopenBtn")) {
    var tg = document.getElementById("sidebarToggle");
    if (tg) tg.click();
    return;
  }

  if (t.closest("#navArchiveBtn")) {
    window.__umairaShowArchived = true;
    var chatNav = document.querySelector('.nav-item[data-view="chat"]');
    if (chatNav) chatNav.click();
    if (typeof renderChatHistory === "function") renderChatHistory();
    var list = document.getElementById("chatHistoryList");
    if (list) list.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }

  if (t.closest("#exportChatBtn")) {
    var conv = null;
    try { conv = (typeof currentConversation !== "undefined") ? currentConversation : null; } catch (err) {}
    var msgs = conv && Array.isArray(conv.messages) ? conv.messages : [];
    if (!msgs.length) { alert("Belum ada pesan untuk diekspor."); return; }
    var title = (conv.title || "Obrolan Umaira");
    var text = "# " + title + "\n\n" + msgs.map(function (m) {
      return (m.role === "user" ? "Saya" : "Umaira AI") + ":\n" + (typeof m.content === "string" ? m.content : "");
    }).join("\n\n---\n\n");
    var blob = new Blob([text], { type: "text/markdown" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = (title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "obrolan-umaira") + ".md";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
});
