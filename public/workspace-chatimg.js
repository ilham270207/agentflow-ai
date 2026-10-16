(() => {
  const TOKEN_RE = /\u27e6umairaimg:([\w-]{4,64})\u27e7/g;
  const previewMap = new Map();
  const key = (f) => String(f.name) + "|" + Number(f.size || 0);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isImg = (f) => String(f && (f.mimeType || f.type) || "").startsWith("image/");

  /* ----- pratinjau di gelembung pesan ----- */
  if (typeof renderMessageAttachments === "function") {
    const origRender = renderMessageAttachments;
    window.renderMessageAttachments = function (attachments) {
      const files = Array.isArray(attachments) ? attachments : [];
      const shown = [];
      const rest = [];
      files.forEach((f) => {
        const src = isImg(f) ? (f.url || previewMap.get(key(f))) : "";
        if (src) shown.push({ f, src }); else rest.push(f);
      });
      let html = "";
      if (shown.length) {
        html += '<div class="wsm-chat-images wsm-n' + Math.min(shown.length, 4) + '">' +
          shown.map(({ f, src }) =>
            '<button type="button" class="wsm-chat-img" data-src="' + esc(src) + '">' +
            '<img src="' + esc(src) + '" alt="' + esc(f.name) + '" loading="lazy"></button>').join("") + "</div>";
      }
      if (rest.length) html += origRender(rest);
      return html;
    };
  }

  /* ----- hasil edit di balasan Umaira ----- */
  if (typeof renderChatMarkdown === "function") {
    const origMd = renderChatMarkdown;
    window.renderChatMarkdown = function () {
      const html = origMd.apply(this, arguments);
      if (typeof html !== "string" || html.indexOf("\u27e6umairaimg:") === -1) return html;
      return html.replace(TOKEN_RE, (m, id) => {
        const src = "/api/chat-images/" + id;
        return '<span class="wsm-fig"><button type="button" class="wsm-chat-img" data-src="' + src + '">' +
          '<img src="' + src + '" alt="Hasil edit gambar" loading="lazy"></button>' +
          '<a class="wsm-dl" href="' + src + '" download="umaira-hasil-edit.png">Unduh</a></span>';
      });
    };
  }

  /* ----- perbesar gambar ----- */
  function openLightbox(src, alt) {
    const box = document.createElement("div");
    box.className = "wsm-lightbox";
    box.innerHTML = '<img alt=""><div class="wsm-lb-bar"><a class="wsm-dl" download>Unduh</a><button type="button" class="wsm-dl">Tutup</button></div>';
    const img = box.querySelector("img");
    img.src = src;
    img.alt = alt || "";
    const a = box.querySelector("a");
    a.href = src;
    const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    box.addEventListener("click", (e) => { if (e.target === box || e.target.tagName === "BUTTON") close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(box);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".wsm-chat-img");
    if (!b) return;
    e.preventDefault();
    openLightbox(b.dataset.src, b.querySelector("img") && b.querySelector("img").alt);
  });

  /* ----- kecilkan dan unggah gambar yang dikirim ----- */
  async function toJpegBlob(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("toBlob"))), "image/jpeg", 0.85));
  }
  function blobToBase64(blob) {
    return new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1] || "");
      r.onerror = () => no(new Error("baca"));
      r.readAsDataURL(blob);
    });
  }
  function applyUrl(conv, file, url) {
    const msgs = (conv && conv.messages) || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role !== "user" || !Array.isArray(m.attachments)) continue;
      const a = m.attachments.find((x) => x && !x.url && x.name === file.name && Number(x.size) === Number(file.size));
      if (a) { a.url = url; break; }
    }
    try { if (typeof persistConversation === "function") persistConversation(); } catch {}
    try { if (typeof renderChatMessages === "function") renderChatMessages(); } catch {}
  }
  async function uploadOne(conv, file) {
    try {
      const blob = await toJpegBlob(file);
      const res = await fetch("/api/chat-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: file.name, data: await blobToBase64(blob) })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) applyUrl(conv, file, d.url);
    } catch (err) {
      console.warn("[chatimg] unggah pratinjau gagal:", err && err.message);
    }
  }

  if (typeof prepareUmairaAttachments === "function") {
    const origPrep = prepareUmairaAttachments;
    window.prepareUmairaAttachments = async function (files) {
      try {
        const list = Array.isArray(files) ? files : (typeof umairaAttachments !== "undefined" ? umairaAttachments : []);
        const images = list.filter((f) => f instanceof Blob && isImg(f));
        if (images.length) {
          images.forEach((f) => { if (!previewMap.has(key(f))) previewMap.set(key(f), URL.createObjectURL(f)); });
          if (typeof renderChatMessages === "function") renderChatMessages();
          const conv = typeof currentConversation !== "undefined" ? currentConversation : null;
          images.forEach((f) => { uploadOne(conv, f); });
        }
      } catch (err) {
        console.warn("[chatimg] pratinjau gagal:", err && err.message);
      }
      return origPrep.apply(this, arguments);
    };
  }

  console.log("[chatimg] aktif:", {
    lampiran: typeof renderMessageAttachments,
    siapkan: typeof prepareUmairaAttachments,
    markdown: typeof renderChatMarkdown
  });
})();
