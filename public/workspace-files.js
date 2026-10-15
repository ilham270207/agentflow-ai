(() => {
  const BASE = "/api/wsdata/files";
  const ACCEPT = ".txt,.md,.csv,.json,.log,.xml,.yml,.yaml,.ini,.js,.ts,.py,.html,.css,.sql,.sh,.java,.php,.c,.cpp,text/*";

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
  const chars = (n) => (n < 1000 ? n + " karakter" : (n / 1000).toFixed(1).replace(".", ",") + " rb karakter");

  function build() {
    const panel = make("section", "wsm-panel");
    panel.id = "wsmFiles";
    panel.style.marginTop = "28px";
    const status = make("p", "wsm-status", "Memuat berkas...");
    const usage = make("p", "wsm-hint", "");
    const picker = make("input");
    picker.type = "file";
    picker.multiple = true;
    picker.accept = ACCEPT;
    const list = make("div", "wsm-list");
    panel.append(
      make("h2", "", "Berkas teks"),
      make("p", "wsm-hint", "Unggah file teks (txt, md, csv, json, kode). Aktifkan \"Pakai di Obrolan\" agar Umaira membaca bagian yang relevan saat kamu bertanya."),
      picker, status, usage, list
    );

    let state = { files: [], usage: null };
    let busy = false;

    function render() {
      const u = state.usage;
      if (u) {
        usage.textContent = u.count + "/" + u.maxFiles + " file, " + chars(u.chars) + " dari " + chars(u.maxChars) +
          ". Aktif di Obrolan: " + state.files.filter((f) => f.inChat).length + "/" + u.maxActive + ".";
      }
      list.replaceChildren();
      if (!state.files.length) {
        list.append(make("p", "wsm-hint", "Belum ada berkas."));
        return;
      }
      state.files.forEach((f) => {
        const card = make("div", "wsm-card wsm-task");
        const info = make("div", "wsm-card-info");
        info.append(
          make("strong", "", f.name),
          make("span", "", chars(f.size) + " · " + new Date(f.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" }))
        );
        const row = make("div", "wsm-row");
        const useLabel = make("label");
        useLabel.style.cssText = "display:flex;align-items:center;gap:8px;cursor:pointer";
        const box = make("input");
        box.type = "checkbox";
        box.checked = f.inChat;
        box.addEventListener("change", async () => {
          const want = box.checked;
          box.disabled = true;
          try {
            const d = await api(BASE + "/" + encodeURIComponent(f.id) + "/chat", json("PATCH", { inChat: want }));
            state.files = state.files.map((x) => (x.id === f.id ? d.file : x));
            status.textContent = want ? "File dipakai di Obrolan." : "File tidak dipakai di Obrolan.";
          } catch (err) {
            box.checked = !want;
            status.textContent = err.message;
          } finally {
            render();
          }
        });
        useLabel.append(box, make("span", "", "Pakai di Obrolan"));
        const dl = make("button", "wsm-btn", "Unduh");
        const del = make("button", "wsm-btn danger", "Hapus");
        dl.type = del.type = "button";
        dl.addEventListener("click", async () => {
          try {
            const d = await api(BASE + "/" + encodeURIComponent(f.id));
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([d.content], { type: "text/plain;charset=utf-8" }));
            a.download = d.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          } catch (err) { status.textContent = err.message; }
        });
        del.addEventListener("click", async () => {
          if (!window.confirm("Hapus \"" + f.name + "\"?")) return;
          try {
            await api(BASE + "/" + encodeURIComponent(f.id), { method: "DELETE" });
            await load("Berkas dihapus.");
          } catch (err) { status.textContent = err.message; }
        });
        row.append(useLabel, dl, del);
        card.append(info, row);
        list.append(card);
      });
    }

    async function load(msg) {
      try {
        state = await api(BASE);
        status.textContent = msg || "";
      } catch (err) {
        status.textContent = err.message;
      }
      render();
    }

    picker.addEventListener("change", async () => {
      if (busy || !picker.files.length) return;
      busy = true;
      picker.disabled = true;
      const notes = [];
      let ok = 0;
      for (const file of picker.files) {
        status.textContent = "Mengunggah " + file.name + "...";
        try {
          if (file.size > 800000) throw new Error("terlalu besar");
          const content = await file.text();
          await api(BASE, json("POST", { name: file.name, content }));
          ok += 1;
        } catch (err) {
          notes.push(file.name + ": " + err.message);
        }
      }
      picker.value = "";
      picker.disabled = false;
      busy = false;
      await load(ok + " file terunggah." + (notes.length ? " Gagal: " + notes.join("; ") : ""));
    });

    load();
    return panel;
  }

  function mountWhenReady(tries = 0) {
    const host = document.getElementById("featurePageContent");
    const act = document.querySelector(".nav-item.active[data-view]");
    if (!host || (act && act.dataset.view !== "library")) return;
    if (!host.querySelector(".library-panel")) {
      if (tries < 15) setTimeout(() => mountWhenReady(tries + 1), 80);
      return;
    }
    host.querySelector("#wsmFiles")?.remove();
    host.append(build());
  }
  document.querySelectorAll('.nav-item[data-view="library"]').forEach((item) => {
    item.addEventListener("click", () => setTimeout(mountWhenReady, 40));
  });
})();
