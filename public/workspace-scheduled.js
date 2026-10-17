(() => {
  const URL_BASE = "/api/wsdata/scheduled";
  const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const STATUS = { ok: "berhasil", error: "gagal", terlewat: "terlewat" };

  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  async function api(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Permintaan gagal (" + res.status + ").");
    return data;
  }
  const json = (method, body) => ({
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB"
    : "-";
  const describe = (t) => t.type === "once"
    ? "Sekali: " + String(t.at).replace("T", " ") + " WIB"
    : t.type === "daily"
      ? "Setiap hari pukul " + t.time + " WIB"
      : "Setiap " + WEEKDAYS[t.weekday] + " pukul " + t.time + " WIB";
  const newId = () => "task-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const localDefault = () => {
    const d = new Date(Date.now() + 10 * 60000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  async function renderScheduled(host) {
    const panel = make("section", "wsm-panel");
    const status = make("p", "wsm-status", "Memuat tugas...");
    panel.append(
      make("h2", "", "Pengingat"),
      make("p", "wsm-hint", "Tugas dijalankan oleh server pada waktu WIB yang kamu pilih, walaupun halaman ditutup (selama server aktif). Hasilnya tersimpan di sini."),
      status
    );

    /* ----- form tambah tugas ----- */
    const title = make("input");
    title.type = "text";
    title.maxLength = 80;
    title.placeholder = "Judul tugas, contoh: Ringkasan berita pagi";
    const prompt = make("textarea");
    prompt.rows = 3;
    prompt.maxLength = 2000;
    prompt.placeholder = "Instruksi untuk AI, contoh: Beri 3 tips produktif hari ini";
    const typeSel = make("select");
    [["daily", "Setiap hari"], ["weekly", "Setiap minggu"], ["once", "Sekali saja"]]
      .forEach(([v, l]) => typeSel.append(new Option(l, v)));
    const timeIn = make("input");
    timeIn.type = "time";
    timeIn.value = "08:00";
    const dayIn = make("input");
    dayIn.type = "datetime-local";
    dayIn.value = localDefault();
    const weekSel = make("select");
    WEEKDAYS.forEach((n, i) => weekSel.append(new Option(n, String(i))));
    weekSel.value = "1";
    const addBtn = make("button", "wsm-btn primary", "Tambah tugas");
    addBtn.type = "button";
    const when = make("div", "wsm-row");
    when.append(typeSel, weekSel, timeIn, dayIn);
    const syncFields = () => {
      const t = typeSel.value;
      weekSel.hidden = t !== "weekly";
      timeIn.hidden = t === "once";
      dayIn.hidden = t !== "once";
    };
    typeSel.addEventListener("change", syncFields);
    syncFields();

    const list = make("div", "wsm-list");
    panel.append(title, prompt, when, addBtn, list);
    host.replaceChildren(panel);

    let tasks = [];
    let busy = false;
    const fresh = new Set();

    function renderList() {
      list.replaceChildren();
      if (!tasks.length) {
        list.append(make("p", "wsm-hint", "Belum ada tugas terjadwal."));
        return;
      }
      tasks.forEach((t) => {
        if (t.unread) fresh.add(t.id);
        const card = make("div", "wsm-card wsm-task");
        const info = make("div", "wsm-card-info");
        info.append(
          make("strong", "", t.title + (fresh.has(t.id) ? "  • Baru" : "")),
          make("span", "", describe(t)),
          make("span", "", t.enabled ? "Berikutnya: " + fmt(t.nextRun) : "Nonaktif"),
          make("span", "", t.lastRun
            ? "Terakhir: " + fmt(t.lastRun) + " (" + (STATUS[t.lastStatus] || t.lastStatus || "-") + ")"
            : "Belum pernah dijalankan")
        );
        if (t.lastResult) {
          const det = make("details");
          det.append(make("summary", "", "Lihat hasil terakhir"), make("div", "wsm-result", t.lastResult));
          info.append(det);
        }
        const actions = make("div", "wsm-row");
        const run = make("button", "wsm-btn", "Jalankan sekarang");
        const toggle = make("button", "wsm-btn", t.enabled ? "Nonaktifkan" : "Aktifkan");
        const del = make("button", "wsm-btn danger", "Hapus");
        [run, toggle, del].forEach((b) => { b.type = "button"; });

        run.addEventListener("click", async () => {
          if (busy) return;
          busy = true;
          run.disabled = true;
          status.textContent = "Menjalankan \"" + t.title + "\"...";
          try {
            const d = await api(URL_BASE + "/" + encodeURIComponent(t.id) + "/run", json("POST", {}));
            tasks = tasks.map((x) => (x.id === t.id ? d.task : x));
            fresh.add(t.id);
            status.textContent = "Selesai. Buka \"Lihat hasil terakhir\".";
          } catch (err) {
            status.textContent = err.message;
          } finally {
            busy = false;
            renderList();
          }
        });
        toggle.addEventListener("click", () =>
          save(tasks.map((x) => (x.id === t.id ? { ...x, enabled: !x.enabled } : x)),
            t.enabled ? "Tugas dinonaktifkan." : "Tugas diaktifkan."));
        del.addEventListener("click", () => {
          if (!window.confirm("Hapus tugas \"" + t.title + "\"?")) return;
          save(tasks.filter((x) => x.id !== t.id), "Tugas dihapus.");
        });
        actions.append(run, toggle, del);
        card.append(info, actions);
        list.append(card);
      });
      if (tasks.some((t) => t.unread)) {
        fetch(URL_BASE + "/seen", json("POST", {})).catch(() => {});
      }
    }

    async function save(next, okMsg) {
      if (busy) return false;
      busy = true;
      status.textContent = "Menyimpan...";
      try {
        const d = await api(URL_BASE, json("PUT", { tasks: next }));
        tasks = d.tasks;
        status.textContent = okMsg;
        return true;
      } catch (err) {
        status.textContent = err.message;
        return false;
      } finally {
        busy = false;
        renderList();
      }
    }

    addBtn.addEventListener("click", async () => {
      const t = title.value.trim();
      const p = prompt.value.trim();
      if (!t || !p) { status.textContent = "Isi judul dan instruksi tugas."; return; }
      const task = { id: newId(), title: t, prompt: p, type: typeSel.value, enabled: true };
      if (task.type === "once") task.at = dayIn.value;
      else task.time = timeIn.value;
      if (task.type === "weekly") task.weekday = Number(weekSel.value);
      if (task.type === "once" && !task.at) { status.textContent = "Pilih tanggal dan jam."; return; }
      if (task.type !== "once" && !task.time) { status.textContent = "Pilih jam."; return; }
      const ok = await save([...tasks, task], "Tugas ditambahkan.");
      if (ok) { title.value = ""; prompt.value = ""; }
    });

    try {
      const d = await api(URL_BASE);
      tasks = d.tasks || [];
      status.textContent = "";
      renderList();
    } catch (err) {
      status.textContent = err.message;
      return;
    }

    const timer = setInterval(async () => {
      if (!panel.isConnected) { clearInterval(timer); return; }
      if (document.hidden || busy) return;
      try {
        const d = await api(URL_BASE);
        tasks = d.tasks || [];
        renderList();
      } catch { /* diam saja, coba lagi nanti */ }
    }, 30000);
  }

  function mount() {
    const host = document.getElementById("featurePageContent");
    if (!host) return;
    const act = document.querySelector(".nav-item.active[data-view]");
    if (act && act.dataset.view !== "scheduled") return;
    const desc = document.getElementById("featureDescription");
    if (desc) desc.textContent = "Jalankan tugas AI otomatis pada waktu tertentu.";
    renderScheduled(host);
  }
  document.querySelectorAll('.nav-item[data-view="scheduled"]').forEach((item) => {
    item.addEventListener("click", () => setTimeout(mount, 40));
  });
})();
