(() => {
  const FENCE = "\x60\x60\x60";
  const EXT = { javascript: "js", js: "js", typescript: "ts", python: "py", html: "html", css: "css",
    bash: "sh", sh: "sh", sql: "sql", java: "java", php: "php", json: "json", c: "c", cpp: "cpp" };

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
  const putJson = (path, body) => api(path, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });

  /* ================= PLUGIN ================= */
  async function renderPlugins(host) {
    const panel = make("section", "wsm-panel");
    const status = make("p", "wsm-status", "Memuat plugin...");
    const list = make("div", "wsm-list");
    panel.append(
      make("h2", "", "Ekstensi"),
      make("p", "wsm-hint", "Aktifkan kemampuan tambahan untuk Obrolan Umaira. Pengaturan tersimpan di akunmu."),
      status, list
    );
    host.replaceChildren(panel);
    try {
      const data = await api("/api/wsdata/plugins");
      const enabled = new Set(data.enabled || []);
      status.textContent = enabled.size + " plugin aktif.";
      data.catalog.forEach((p) => {
        const card = make("label", "wsm-card");
        const info = make("div", "wsm-card-info");
        info.append(make("strong", "", p.name), make("span", "", p.description));
        const box = make("input");
        box.type = "checkbox";
        box.checked = enabled.has(p.id);
        box.addEventListener("change", async () => {
          const wanted = box.checked;
          box.disabled = true;
          if (wanted) enabled.add(p.id); else enabled.delete(p.id);
          try {
            await putJson("/api/wsdata/plugins", { value: { enabled: [...enabled] } });
            status.textContent = p.name + (wanted ? " diaktifkan. " : " dinonaktifkan. ") + enabled.size + " plugin aktif.";
          } catch (err) {
            if (wanted) enabled.delete(p.id); else enabled.add(p.id);
            box.checked = !wanted;
            status.textContent = err.message;
          } finally {
            box.disabled = false;
          }
        });
        card.append(info, box);
        list.append(card);
      });
    } catch (err) {
      status.textContent = err.message;
    }
  }

  /* ================= CODEX ================= */
  const TASKS = {
    buat: "Tulis kode sesuai instruksi.",
    perbaiki: "Temukan dan perbaiki bug pada kode, lalu jelaskan perubahannya.",
    jelaskan: "Jelaskan kode langkah demi langkah dengan bahasa sederhana.",
    review: "Review kode: kualitas, keamanan, dan performa, lalu berikan versi yang lebih baik."
  };
  const LANGS = [["auto", "Bahasa: otomatis"], ["JavaScript", "JavaScript"], ["Python", "Python"],
    ["HTML/CSS", "HTML/CSS"], ["Bash", "Bash"], ["SQL", "SQL"], ["Java", "Java"], ["PHP", "PHP"]];

  function composePrompt(task, lang, instruction, code) {
    const head = "Kamu adalah asisten coding Umaira Codex. " + TASKS[task] +
      (lang && lang !== "auto" ? " Bahasa/teknologi: " + lang + "." : "") +
      " Jawab dalam bahasa Indonesia dan tulis kode dalam blok kode markdown.";
    const parts = [head];
    if (instruction) parts.push("Instruksi:\n" + instruction);
    if (code) parts.push("Kode:\n" + FENCE + "\n" + code + "\n" + FENCE);
    return parts.join("\n\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function renderAnswer(container, text) {
    const re = new RegExp(FENCE + "([\\w+#.-]*)[ \\t]*\\n([\\s\\S]*?)" + FENCE, "g");
    let last = 0;
    let m;
    const addText = (t) => { t = t.trim(); if (t) container.append(make("p", "", t)); };
    while ((m = re.exec(text)) !== null) {
      addText(text.slice(last, m.index));
      const lang = (m[1] || "").toLowerCase();
      const code = m[2].replace(/\n$/, "");
      const block = make("div", "wsm-codeblock");
      const head = make("div", "wsm-codehead");
      head.append(make("span", "", lang || "kode"));
      const actions = make("span");
      const copy = make("button", "wsm-btn", "Salin");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        const ok = await copyText(code);
        copy.textContent = ok ? "Tersalin" : "Gagal";
        setTimeout(() => { copy.textContent = "Salin"; }, 1500);
      });
      const dl = make("button", "wsm-btn", "Unduh");
      dl.type = "button";
      dl.addEventListener("click", () => {
        const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "kode-umaira." + (EXT[lang] || "txt");
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      actions.append(copy, document.createTextNode(" "), dl);
      head.append(actions);
      const pre = make("pre");
      pre.textContent = code;
      block.append(head, pre);
      container.append(block);
      last = re.lastIndex;
    }
    addText(text.slice(last));
  }

  async function renderCodex(host) {
    const panel = make("section", "wsm-panel");
    const status = make("p", "wsm-status", "Memuat sesi Codex...");
    panel.append(
      make("h2", "", "Lab kode"),
      make("p", "wsm-hint", "Tulis, perbaiki, dan jelaskan kode dengan AI. Sesi tersimpan di akunmu."),
      status
    );
    host.replaceChildren(panel);

    let sessions = [];
    try {
      const d = await api("/api/wsdata/codex");
      sessions = Array.isArray(d.value) ? d.value : [];
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    status.textContent = "";
    let active = sessions[0] || null;
    let saveTimer = null;
    let busy = false;
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try { await putJson("/api/wsdata/codex", { value: sessions }); }
        catch (err) { status.textContent = "Gagal menyimpan sesi: " + err.message; }
      }, 500);
    };

    const select = make("select");
    const newBtn = make("button", "wsm-btn", "Sesi baru");
    const delBtn = make("button", "wsm-btn danger", "Hapus sesi");
    newBtn.type = delBtn.type = "button";
    const bar = make("div", "wsm-row");
    bar.append(select, newBtn, delBtn);

    const taskSel = make("select");
    [["buat", "Buat kode"], ["perbaiki", "Perbaiki kode"], ["jelaskan", "Jelaskan kode"], ["review", "Review kode"]]
      .forEach(([v, l]) => taskSel.append(new Option(l, v)));
    const langSel = make("select");
    LANGS.forEach(([v, l]) => langSel.append(new Option(l, v)));
    const opts = make("div", "wsm-row");
    opts.append(taskSel, langSel);

    const chat = make("div", "wsm-chat");
    const ins = make("textarea");
    ins.rows = 3;
    ins.placeholder = "Instruksi, contoh: buatkan fungsi untuk memvalidasi email";
    const codeBox = make("textarea", "wsm-code");
    codeBox.rows = 6;
    codeBox.placeholder = "Tempel kode di sini (opsional)";
    const run = make("button", "wsm-btn primary", "Jalankan");
    run.type = "button";
    panel.append(bar, opts, chat, ins, codeBox, run);

    function fillSelect() {
      select.replaceChildren();
      if (!sessions.length) select.append(new Option("(belum ada sesi)", ""));
      sessions.forEach((s) => select.append(new Option(s.title || "Sesi tanpa judul", s.id)));
      if (active) {
        select.value = active.id;
        langSel.value = LANGS.some(([v]) => v === active.language) ? active.language : "auto";
      }
    }
    function renderMessages() {
      chat.replaceChildren();
      if (!active || !active.messages.length) {
        chat.append(make("p", "wsm-hint", "Belum ada percakapan. Tulis instruksi lalu tekan Jalankan."));
        return;
      }
      active.messages.forEach((m) => {
        const box = make("div", "wsm-msg " + (m.role === "assistant" ? "assistant" : "user"));
        if (m.role === "assistant") renderAnswer(box, m.content);
        else box.append(make("p", "", m.label || m.content.slice(0, 300)));
        chat.append(box);
      });
      chat.scrollTop = chat.scrollHeight;
    }
    function create() {
      const now = new Date().toISOString();
      const s = { id: "codex-" + Date.now(), title: "Sesi baru", language: "auto", createdAt: now, updatedAt: now, messages: [] };
      sessions.unshift(s);
      if (sessions.length > 30) sessions.length = 30;
      active = s;
      persist();
      fillSelect();
      renderMessages();
    }

    select.addEventListener("change", () => {
      active = sessions.find((s) => s.id === select.value) || null;
      fillSelect();
      renderMessages();
    });
    newBtn.addEventListener("click", create);
    delBtn.addEventListener("click", () => {
      if (!active || !window.confirm("Hapus sesi ini?")) return;
      sessions = sessions.filter((s) => s.id !== active.id);
      active = sessions[0] || null;
      persist();
      fillSelect();
      renderMessages();
    });

    run.addEventListener("click", async () => {
      if (busy) return;
      const instruction = ins.value.trim();
      const code = codeBox.value.trim();
      if (!instruction && !code) { status.textContent = "Tulis instruksi atau tempel kode dulu."; return; }
      if (!active) create();
      const session = active;
      const lang = langSel.value;
      const prompt = composePrompt(taskSel.value, lang, instruction, code);
      const history = session.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      while (history.length && history[0].role !== "user") history.shift();
      const userMsg = {
        role: "user",
        content: prompt,
        label: (instruction || "(tanpa instruksi)") + (code ? "  [+ kode " + code.split("\n").length + " baris]" : "")
      };
      session.messages.push(userMsg);
      if (session.title === "Sesi baru") session.title = (instruction || code).slice(0, 40);
      session.language = lang;
      busy = true;
      run.disabled = true;
      run.textContent = "Memproses...";
      status.textContent = "Umaira sedang bekerja...";
      renderMessages();
      try {
        const data = await api("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...history, { role: "user", content: prompt }], projectContext: "" })
        });
        const reply = typeof data.message === "string" ? data.message : (data.message?.content || data.message?.text || "");
        if (!reply) throw new Error("AI tidak mengembalikan jawaban.");
        session.messages.push({ role: "assistant", content: reply });
        ins.value = "";
        status.textContent = "Selesai.";
      } catch (err) {
        const i = session.messages.lastIndexOf(userMsg);
        if (i >= 0) session.messages.splice(i, 1);
        status.textContent = err.message;
      } finally {
        session.updatedAt = new Date().toISOString();
        persist();
        fillSelect();
        renderMessages();
        busy = false;
        run.disabled = false;
        run.textContent = "Jalankan";
      }
    });

    fillSelect();
    renderMessages();
  }

  /* ================= PEMASANGAN ================= */
  const MODULES = {
    plugins: { render: renderPlugins, desc: "Aktifkan kemampuan tambahan untuk Obrolan Umaira." },
    codex: { render: renderCodex, desc: "Ruang kerja coding untuk menulis, memperbaiki, dan menjelaskan kode." }
  };
  function mount(view) {
    const mod = MODULES[view];
    const host = document.getElementById("featurePageContent");
    if (!mod || !host) return;
    const act = document.querySelector(".nav-item.active[data-view]");
    if (act && act.dataset.view !== view) return;
    const desc = document.getElementById("featureDescription");
    if (desc) desc.textContent = mod.desc;
    mod.render(host);
  }
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", () => {
      if (MODULES[item.dataset.view]) setTimeout(() => mount(item.dataset.view), 40);
    });
  });
})();
