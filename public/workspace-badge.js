(() => {
  const nav = document.querySelector('.nav-item[data-view="scheduled"]');
  if (!nav) return;
  const badge = document.createElement("span");
  badge.className = "wsm-badge";
  badge.hidden = true;
  badge.setAttribute("aria-label", "Tugas terjadwal baru");
  nav.appendChild(badge);

  async function poll() {
    if (document.hidden) return;
    try {
      const res = await fetch("/api/wsdata/scheduled", { headers: { Accept: "application/json" } });
      if (!res.ok) { badge.hidden = true; return; }
      const data = await res.json();
      const n = (data.tasks || []).filter((t) => t.unread).length;
      badge.textContent = n > 9 ? "9+" : String(n);
      badge.hidden = n === 0;
    } catch { /* abaikan, coba lagi nanti */ }
  }

  nav.addEventListener("click", () => { badge.hidden = true; });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  setInterval(poll, 60000);
  poll();
})();
