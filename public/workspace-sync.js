(() => {
  const KEY = "umaira-projects-v1";
  let timer = null;
  let pulled = false;

  const readLocal = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  };

  async function push() {
    try {
      const res = await fetch("/api/workspaces", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: readLocal() })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
    } catch (err) {
      console.warn("[workspace] gagal sinkron ke server:", err.message);
    }
  }

  window.umairaWorkspacePush = () => {
    if (!pulled) return;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; push(); }, 400);
  };

  async function pull() {
    if (timer) return;
    try {
      const res = await fetch("/api/workspaces", { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      pulled = true;
      if (data.initialized) {
        const next = JSON.stringify(data.items);
        if (localStorage.getItem(KEY) !== next) {
          localStorage.setItem(KEY, next);
          window.dispatchEvent(new Event("umaira-workspaces-synced"));
        }
      } else if (readLocal().length) {
        await push(); // migrasi sekali jalan dari browser ke server
      }
    } catch (err) {
      console.warn("[workspace] gagal memuat dari server:", err.message);
    }
  }

  window.addEventListener("umaira-workspaces-synced", () => {
    window.__umairaProjectsRerender?.();
    window.__umairaChatProjectRerender?.();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pull();
  });
  pull();
})();
