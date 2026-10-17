(function () {
  if (window.__aaInit) return; window.__aaInit = true;
  /* UMAIRA AUDIT V2 */
  ['/admin-audit.css?v=3', '/admin-neutral.css?v=3'].forEach(function (u) { var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = u; document.head.appendChild(lk); });
  var CSS = [
    '.aa2-alert{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.45);color:#b91c1c;font-size:13px;margin-bottom:8px}',
    '.aa-dark .aa2-alert{color:#fca5a5}',
    '.aa2-alert span{flex:1;min-width:0;word-break:break-word}',
    '.aa2-btn,.aa2-link{border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;border-radius:10px;padding:5px 10px;font-size:12px;cursor:pointer}',
    '.aa2-link{margin-top:8px}',
    '.aa2-card{border:1px solid rgba(128,128,128,.25);border-radius:14px;padding:12px;margin-bottom:10px}',
    '.aa2-h{font-size:12px;opacity:.7;margin-bottom:8px}',
    '.aa2-bars{display:flex;align-items:flex-end;gap:6px;height:100px}',
    '.aa2-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:10px}',
    '.aa2-bar{width:100%;max-width:28px;border-radius:6px 6px 2px 2px;background:#8b5cf6;position:relative;overflow:hidden}',
    '.aa2-bad{position:absolute;left:0;right:0;bottom:0;background:#ef4444}',
    '.aa2-lbl{opacity:.65;font-size:11px;margin-top:3px}',
    '.aa2-rk{margin-top:12px}',
    '.aa2-rrow{display:grid;grid-template-columns:110px 1fr 28px;align-items:center;gap:8px;font-size:12px;margin:4px 0}',
    '.aa2-rtr{height:6px;border-radius:4px;background:rgba(128,128,128,.2)}',
    '.aa2-rfl{display:block;height:100%;border-radius:4px;background:#8b5cf6}',
    '.aa2-rrow b{text-align:right}',
    '.aa2-diff{margin-top:8px;border-top:1px dashed rgba(128,128,128,.35);padding-top:8px;font-size:12px}',
    '.aa2-dr{display:grid;grid-template-columns:80px 1fr 1fr;gap:6px;padding:3px 0;word-break:break-word}',
    '.aa2-old{color:#b91c1c;text-decoration:line-through;opacity:.85}',
    '.aa2-new{color:#15803d}',
    '.aa-dark .aa2-old{color:#fca5a5}',
    '.aa-dark .aa2-new{color:#86efac}'
  ].join('');
  var stl = document.createElement('style'); stl.id = 'aa2-style'; stl.textContent = CSS; document.head.appendChild(stl);
  var LABEL = { login: 'Login', logout: 'Logout', register: 'Daftar akun', password_forgot: 'Lupa password', password_reset: 'Reset password', password_change_request: 'Minta ganti password', password_change: 'Ganti password', account_delete: 'Hapus akun', profile_update: 'Ubah profil', system_error: 'Error sistem', chat_message: 'Kirim chat', chat_action: 'Aksi chat', image_generate: 'Buat gambar', gallery_save: 'Simpan ke Pustaka', gallery_delete: 'Hapus dari Pustaka', task_edit: 'Ubah tugas', task_regenerate: 'Buat ulang tugas', task_plan: 'Rencana tugas', api_create: 'Tambah data', api_update: 'Ubah data', api_delete: 'Hapus data', server_start: 'Server dimulai', admin_view_users: 'Buka daftar pengguna', admin_export: 'Ekspor log CSV', admin_denied: 'Akses admin ditolak' };
  var GROUPS = [['all', 'Semua'], ['login', 'Login'], ['gagal', 'Gagal'], ['password', 'Password'], ['hapus', 'Hapus'], ['ubah', 'Perubahan'], ['fitur', 'Fitur'], ['sistem', 'Sistem']];
  var RANGES = [['24h', '24 jam'], ['7d', '7 hari'], ['30d', '30 hari'], ['all', 'Semua waktu']];
  var S = { group: 'all', range: '7d', q: '', limit: 50, open: {}, data: null, err: '' };
  var btn = null, sheet = null, bodyEl = null, timer = null, qTimer = null, skew = 0;
  var IC = {
    log: '<path d="M7 4h10a2 2 0 012 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 012-2z"/><path d="M9 9h6M9 13h4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    re: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
    dl: '<path d="M12 4v10M8 10l4 4 4-4M5 19h14"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + IC[n] + '</svg>'; }
  function h(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function lum(c) { var m = String(c).match(/[\d.]+/g); if (!m || m.length < 3) return null; if (m.length > 3 && +m[3] === 0) return null; return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; }
  function isDark() {
    var r = document.querySelector('.ap-root');
    if (r && r.dataset.theme) return r.dataset.theme === 'dark';
    var e = document.querySelector('.ap-big');
    while (e && e !== document.documentElement) { var l = lum(getComputedStyle(e).backgroundColor); if (l !== null) return l < 0.45; e = e.parentElement; }
    return document.documentElement.getAttribute('data-uui') === 'dark';
  }
  function theme() { var d = isDark(); if (sheet) sheet.classList.toggle('aa-dark', d); }
  function now() { return Date.now() + skew; }
  function ago(t) { var s = Math.floor((now() - t) / 1000); if (s < 60) return 'baru saja'; var m = Math.floor(s / 60); if (m < 60) return m + ' menit lalu'; var j = Math.floor(m / 60); if (j < 24) return j + ' jam lalu'; return Math.floor(j / 24) + ' hari lalu'; }
  function full(t) { return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function fmt(v) { return v == null || v === '' ? '—' : String(v); }
  function dayLbl(d) { return d.slice(8, 10) + '/' + d.slice(5, 7); }

  function load() {
    var u = '/api/auth/admin/audit?range=' + S.range + '&group=' + S.group + '&limit=' + S.limit + '&q=' + encodeURIComponent(S.q.trim());
    return fetch(u, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
    }).then(function (d) { if (d.serverTime) skew = d.serverTime - Date.now(); S.data = d; S.err = ''; draw(); })
      .catch(function (e) { S.err = 'Gagal memuat log (' + e.message + ').'; draw(); });
  }

  function exportCsv() {
    var u = '/api/auth/admin/audit?format=csv&range=' + S.range + '&group=' + S.group + '&q=' + encodeURIComponent(S.q.trim());
    fetch(u, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob();
    }).then(function (b) {
      var a = document.createElement('a'), url = URL.createObjectURL(b);
      a.href = url; a.download = 'log-aktivitas-umaira.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }).catch(function (e) { S.err = 'Gagal ekspor CSV (' + e.message + ').'; draw(); });
  }

  function chips(list, key) {
    var w = h('div', 'aa-chips');
    list.forEach(function (x) {
      var c = h('button', 'aa-chip' + (S[key] === x[0] ? ' on' : ''), x[1]); c.type = 'button';
      c.onclick = function () { S[key] = x[0]; S.limit = 50; load(); };
      w.appendChild(c);
    });
    return w;
  }

  function alertsBox(d) {
    if (!d || !d.alerts || !d.alerts.length) return null;
    var w = h('div', 'aa2-wrap');
    d.alerts.forEach(function (a) {
      var row = h('div', 'aa2-alert');
      row.appendChild(h('span', null, 'Peringatan keamanan: ' + a.count + ' kali gagal login dalam 10 menit dari ' + (a.by === 'ip' ? 'IP ' : 'email ') + a.key + ' (' + ago(a.last) + ').'));
      var b = h('button', 'aa2-btn', 'Lihat'); b.type = 'button';
      b.onclick = function () { S.q = a.key; S.group = 'gagal'; S.range = '24h'; S.limit = 50; load(); };
      row.appendChild(b);
      w.appendChild(row);
    });
    return w;
  }

  function rank(title, arr, f) {
    var w = h('div', 'aa2-rk'); w.appendChild(h('div', 'aa2-h', title));
    if (!arr || !arr.length) { w.appendChild(h('div', 'aa2-lbl', 'Belum ada data.')); return w; }
    var max = arr[0].n || 1;
    arr.forEach(function (x) {
      var r = h('div', 'aa2-rrow'), tr = h('div', 'aa2-rtr'), fl = h('i', 'aa2-rfl');
      fl.style.width = Math.max(4, Math.round(x.n / max * 100)) + '%'; tr.appendChild(fl);
      r.append(h('span', null, f(x.key)), tr, h('b', null, String(x.n)));
      w.appendChild(r);
    });
    return w;
  }

  function chartsBox(d) {
    var c = d && d.charts; if (!c || !c.days) return null;
    var card = h('div', 'aa2-card');
    card.appendChild(h('div', 'aa2-h', 'Aktivitas 7 hari terakhir (merah = gagal)'));
    var max = 1; c.days.forEach(function (x) { if (x.total > max) max = x.total; });
    var bars = h('div', 'aa2-bars');
    c.days.forEach(function (x) {
      var col = h('div', 'aa2-col'), bar = h('div', 'aa2-bar');
      bar.style.height = Math.max(x.total ? 6 : 2, Math.round(x.total / max * 64)) + 'px';
      if (x.failed) { var bd = h('div', 'aa2-bad'); bd.style.height = Math.round(x.failed / x.total * 100) + '%'; bar.appendChild(bd); }
      col.append(h('span', null, x.total ? String(x.total) : ''), bar, h('span', 'aa2-lbl', dayLbl(x.d)));
      bars.appendChild(col);
    });
    card.appendChild(bars);
    card.appendChild(rank('Aksi terbanyak', c.topActions, function (k) { return LABEL[k] || k; }));
    card.appendChild(rank('Modul terbanyak', c.topModules, function (k) { return k; }));
    return card;
  }

  function diffBox(r) {
    if (!r.before && !r.after) return null;
    var keys = Object.keys(r.before || {});
    Object.keys(r.after || {}).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    if (!keys.length) return null;
    var df = h('div', 'aa2-diff'); df.appendChild(h('div', 'aa2-h', 'Perubahan data (lama \u2192 baru)'));
    keys.forEach(function (k) {
      var row = h('div', 'aa2-dr');
      row.append(h('span', null, k), h('span', 'aa2-old', fmt(r.before && r.before[k])), h('span', 'aa2-new', fmt(r.after && r.after[k])));
      df.appendChild(row);
    });
    return df;
  }

  function draw() {
    if (!bodyEl) return;
    var keep = bodyEl.scrollTop, d = S.data;
    bodyEl.replaceChildren();
    var st = h('div', 'aa-stats');
    var s = d ? d.stats : { total24h: 0, logins24h: 0, failed24h: 0 };
    [['Aktivitas 24 jam', s.total24h, ''], ['Login 24 jam', s.logins24h, ''], ['Gagal 24 jam', s.failed24h, s.failed24h ? ' bad' : '']].forEach(function (x) {
      var c = h('div', 'aa-stat' + x[2]); c.append(h('b', null, String(x[1])), h('span', null, x[0])); st.appendChild(c);
    });
    var q = h('input', 'aa-search'); q.type = 'search'; q.placeholder = 'Cari nama, email, atau IP...'; q.value = S.q;
    q.oninput = function () { S.q = q.value; clearTimeout(qTimer); qTimer = setTimeout(function () { S.limit = 50; load(); }, 350); };
    var al = alertsBox(d), ch = chartsBox(d);
    if (al) bodyEl.appendChild(al);
    bodyEl.appendChild(st);
    if (ch) bodyEl.appendChild(ch);
    bodyEl.append(q, chips(GROUPS, 'group'), chips(RANGES, 'range'));
    if (S.err) bodyEl.appendChild(h('div', 'aa-err', S.err));
    else if (!d) bodyEl.appendChild(h('div', 'aa-empty', 'Memuat...'));
    else if (!d.items.length) bodyEl.appendChild(h('div', 'aa-empty', 'Belum ada aktivitas yang cocok.'));
    else {
      d.items.forEach(function (r) {
        var open = !!S.open[r.id], it = h('div', 'aa-item'), row = h('div', 'aa-row');
        var m = h('div', 'aa-main');
        m.append(h('div', 'aa-t', LABEL[r.action] || r.action), h('div', 'aa-s', (r.name || r.email || 'Tidak diketahui') + ' \u00b7 ' + ago(r.ts)));
        row.append(h('i', 'aa-dot ' + r.status), m, h('span', 'aa-badge ' + r.status, r.status));
        row.onclick = function () { S.open[r.id] = !S.open[r.id]; draw(); };
        it.appendChild(row);
        if (open) {
          var dd = h('div', 'aa-det');
          [['Pengguna', r.name || '\u2014'], ['Email', r.email || '\u2014'], ['Role', r.role || '\u2014'], ['Waktu', full(r.ts)], ['Modul', r.module || '\u2014'], ['Detail', r.detail || '\u2014'], ['IP', r.ip || '\u2014'], ['Perangkat', (r.device || '\u2014') + ' \u00b7 ' + (r.os || '\u2014')], ['Browser', r.browser || '\u2014']].forEach(function (x) {
            var k = h('div', 'aa-kv'); k.append(h('span', null, x[0]), h('span', null, x[1])); dd.appendChild(k);
          });
          var df = diffBox(r); if (df) dd.appendChild(df);
          if (r.email) {
            var lk = h('button', 'aa2-link', 'Lihat semua aktivitas pengguna ini'); lk.type = 'button';
            lk.onclick = function (ev) { ev.stopPropagation(); S.q = r.email; S.group = 'all'; S.range = '30d'; S.limit = 50; load(); };
            dd.appendChild(lk);
          }
          it.appendChild(dd);
        }
        bodyEl.appendChild(it);
      });
      if (d.items.length < d.total) {
        var mb = h('button', 'aa-more', 'Muat lebih banyak (' + d.items.length + ' dari ' + d.total + ')'); mb.type = 'button';
        mb.onclick = function () { S.limit += 50; load(); }; bodyEl.appendChild(mb);
      }
    }
    bodyEl.scrollTop = keep;
  }

  function openSheet() {
    if (sheet) return;
    sheet = h('div', 'aa-sheet');
    var top = h('div', 'aa-top'), t = h('h2', null, 'Log Aktivitas');
    var ex = h('button', 'aa-ib'); ex.type = 'button'; ex.innerHTML = svg('dl'); ex.setAttribute('aria-label', 'Ekspor CSV'); ex.onclick = exportCsv;
    var rf = h('button', 'aa-ib'); rf.type = 'button'; rf.innerHTML = svg('re'); rf.setAttribute('aria-label', 'Muat ulang'); rf.onclick = load;
    var cl = h('button', 'aa-ib'); cl.type = 'button'; cl.innerHTML = svg('x'); cl.setAttribute('aria-label', 'Tutup'); cl.onclick = closeSheet;
    top.append(t, ex, rf, cl);
    bodyEl = h('div', 'aa-body');
    sheet.append(top, bodyEl);
    document.body.appendChild(sheet);
    theme(); draw(); load();
    timer = setInterval(load, 20000);
  }
  function closeSheet() { clearInterval(timer); if (sheet) sheet.remove(); sheet = null; bodyEl = null; }

  window.__aaOpen = openSheet;
})();
