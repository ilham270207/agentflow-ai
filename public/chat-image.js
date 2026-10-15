/* Umaira chat-image v1: gambar langsung dari chat lewat AI Horde */
(function () {
  "use strict";

  var INTENT = new RegExp(
    "^\\s*(?:" +
      "\\/(?:gambar|image|img)\\s+" +
      "|(?:tolong\\s+|please\\s+|coba\\s+)?(?:buatkan|buatin|bikinkan|bikinin|bikin|buat|generate|create|make)\\s+" +
        "(?:untuk\\s+)?(?:saya\\s+|aku\\s+|me\\s+)?(?:sebuah\\s+|satu\\s+|a\\s+|an\\s+)?" +
        "(?:gambar|foto|ilustrasi|lukisan|image|picture|illustration|artwork)\\s*" +
        "(?:tentang|dari|of|about|yang menunjukkan|berupa|:)?\\s*" +
      "|(?:tolong\\s+|please\\s+)?(?:gambarkan|lukiskan|draw|paint)\\s+" +
    ")(.{3,})$",
    "is"
  );

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function detect(text) {
    var m = INTENT.exec(text || "");
    if (!m) return null;
    var prompt = m[1].trim();
    if (prompt.length < 3 || /\?\s*$/.test(prompt)) return null;
    var ratio = "square";
    if (/\b(portrait|potret|vertikal|vertical)\b/i.test(text)) ratio = "portrait";
    else if (/\b(landscape|lanskap|horizontal|wide)\b/i.test(text)) ratio = "landscape";
    return { prompt: prompt.slice(0, 2000), ratio: ratio };
  }

  function toSrc(raw) {
    if (/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw)) return raw;
    var mime = "image/png";
    if (raw.indexOf("UklGR") === 0) mime = "image/webp";
    else if (raw.indexOf("/9j/") === 0) mime = "image/jpeg";
    return "data:" + mime + ";base64," + raw;
  }

  function showUserMessage(text) {
    var container = $("chatMessages");
    try {
      if (typeof addChatMessage === "function") {
        addChatMessage("user", text);
        if (container && container.textContent.indexOf(text) === -1 &&
            typeof renderChatMessages === "function") renderChatMessages();
      }
    } catch (e) { /* lanjut ke cadangan */ }
    if (container && container.textContent.indexOf(text) === -1) {
      container.appendChild(el("div", "umi-fallback-user", text));
    }
  }

  function makeCard() {
    var card = el("div", "umi-imgchat");
    var status = el("div", "umi-imgchat-status");
    var body = el("div", "umi-imgchat-body");
    card.append(status, body);
    var container = $("chatMessages");
    if (container) container.appendChild(card);
    return { card: card, status: status, body: body, token: 0 };
  }

  function setStatus(ui, text, busy, isError) {
    ui.status.replaceChildren();
    ui.card.classList.toggle("is-error", !!isError);
    if (!text) return;
    if (busy) ui.status.appendChild(el("span", "umi-imgchat-spin"));
    ui.status.appendChild(el("span", "", text));
    ui.card.scrollIntoView({ block: "end", behavior: "smooth" });
  }

  async function download(src, btn) {
    try {
      var blob = await (await fetch(src)).blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "umaira-" + Date.now() + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) {
      window.open(src, "_blank", "noopener");
    }
  }

  function renderResult(ui, job, images) {
    ui.body.replaceChildren();
    images.forEach(function (item) {
      var src = toSrc(item.img);
      var wrap = el("div");
      wrap.style.display = "grid";
      wrap.style.gap = "10px";

      var img = el("img", "umi-imgchat-img");
      img.alt = job.prompt;
      img.loading = "lazy";
      img.src = src;

      var cap = el("p", "umi-imgchat-cap", job.prompt);
      var modelNote = el("p", "umi-imgchat-cap umi-imgchat-model", item.model ? "Model: " + item.model : "");
      if (!item.model) modelNote.hidden = true;
      var actions = el("div", "umi-imgchat-actions");

      var save = el("button", "umi-primary", "Simpan ke Pustaka");
      save.type = "button";
      save.addEventListener("click", async function () {
        save.disabled = true;
        save.textContent = "Menyimpan...";
        try {
          var res = await fetch("/api/gallery/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: job.id, prompt: job.prompt, style: "none" })
          });
          var out = await res.json().catch(function () { return {}; });
          if (!res.ok) throw new Error(out.error || "Gagal menyimpan.");
          save.textContent = "Tersimpan di Pustaka ✓";
        } catch (e) {
          save.disabled = false;
          save.textContent = "Simpan ke Pustaka";
          setStatus(ui, e.message, false, true);
        }
      });

      var again = el("button", "", "Buat ulang");
      again.type = "button";
      again.addEventListener("click", function () { run(ui, job.prompt, job.ratio); });

      var dl = el("button", "", "Unduh");
      dl.type = "button";
      dl.addEventListener("click", function () { download(src, dl); });

      actions.append(save, again, dl);
      wrap.append(img, cap, modelNote, actions);
      ui.body.appendChild(wrap);
    });
  }

  async function run(ui, prompt, ratio) {
    var token = ++ui.token;
    ui.body.replaceChildren();
    setStatus(ui, "Mengirim permintaan gambar...", true);

    try {
      var res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt, aspectRatio: ratio, style: "none", negativePrompt: "" })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.id) throw new Error(data.error || "Permintaan gambar gagal.");

      var job = { id: data.id, prompt: prompt, ratio: ratio };
      setStatus(ui, "Masuk antrean. Menunggu worker AI Horde...", true);

      for (var i = 0; i < 120; i++) {
        await sleep(5000);
        if (token !== ui.token) return;

        var chk = await fetch("/api/images/status/" + encodeURIComponent(job.id));
        var st = await chk.json().catch(function () { return {}; });
        if (!chk.ok) throw new Error(st.error || "Gagal memeriksa progres.");
        if (st.faulted) throw new Error("Pekerjaan gambar gagal di AI Horde. Coba prompt lain.");

        if (st.done) {
          var images = Array.isArray(st.generations)
            ? st.generations.filter(function (g) { return g && typeof g.img === "string"; })
            : [];
          if (!images.length) throw new Error("Pekerjaan selesai, tetapi gambar tidak tersedia.");
          setStatus(ui, "");
          renderResult(ui, job, images);
          ui.card.scrollIntoView({ block: "end", behavior: "smooth" });
          return;
        }

        var pos = Number(st.queue_position || 0);
        var wait = Number(st.wait_time || 0);
        setStatus(ui,
          pos > 0
            ? "Antrean posisi " + pos + (wait > 0 ? " · perkiraan " + wait + " detik" : "")
            : "Gambar sedang diproses...",
          true);
      }
      throw new Error("Gambar belum selesai. Antrean AI Horde sedang padat, coba lagi nanti.");
    } catch (e) {
      if (token === ui.token) {
        setStatus(ui, e.message || "Terjadi kesalahan saat membuat gambar.", false, true);
        var retry = el("div", "umi-imgchat-actions");
        var b = el("button", "", "Coba lagi");
        b.type = "button";
        b.addEventListener("click", function () { run(ui, prompt, ratio); });
        retry.appendChild(b);
        ui.body.replaceChildren(retry);
      }
    }
  }

  function tryHandle() {
    var ta = document.querySelector(".chat-composer textarea");
    if (!ta) return false;
    var att = $("composerAttachments");
    if (att && att.children.length > 0) return false; // ada lampiran: biarkan alur biasa
    var found = detect(ta.value);
    if (!found) return false;

    var original = ta.value.trim();
    ta.value = "";
    ta.dispatchEvent(new Event("input", { bubbles: true }));

    showUserMessage(original);
    run(makeCard(), found.prompt, found.ratio);
    return true;
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("#chatSendBtn");
    if (!btn) return;
    if (tryHandle()) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    var t = e.target;
    if (!t || t.tagName !== "TEXTAREA" || !t.closest(".chat-composer")) return;
    if (tryHandle()) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
  }, true);
})();
