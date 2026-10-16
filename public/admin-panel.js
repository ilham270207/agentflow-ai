(function () {
  if (window.__apInit) return; window.__apInit = true;
  var P = {
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    dl: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chev: '<path d="M6 9l6 6 6-6"/>'
  };
  function ic(n, s) { s = s || 20; return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + P[n] + '</svg>'; }
  function h(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function I(n, s, c) { var e = h('span', 'ap-ic' + (c ? ' ' + c : '')); e.innerHTML = ic(n, s); return e; }

  var S = { data: null, filter: 'all', q: '', skew: 0, open: {}, timer: null, heroEl: null, listEl: null };
  var root, liveEl;
  function now() { return Date.now() + S.skew; }
  function ago(t) { if (!t) return 'belum ada aktivitas'; var s = Math.floor((now() - t) / 1000); if (s < 60) return 'baru saja'; var m = Math.floor(s / 60); if (m < 60) return m + ' menit lalu'; var j = Math.floor(m / 60); if (j < 24) return j + ' jam lalu'; var d = Math.floor(j / 24); return d < 30 ? d + ' hari lalu' : new Date(t).toLocaleDateString('id-ID'); }
  function dt(t) { return t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sebelum pelacakan'; }
  function cat(u) { if (u.online) return 'on'; var a = u.lastSeen ? now() - u.lastSeen : Infinity; return a < 864e5 ? 'd1' : a < 6048e5 ? 'd7' : 'old'; }
  function mth(u) { return u.loginMethod === 'Google' ? 'Google' : (u.loginMethod === 'Akun' ? 'Akun' : 'Email'); }

  function fetchData() {
    return fetch('/api/auth/admin/users', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    }).then(function (d) { if (d.serverTime) S.skew = d.serverTime - Date.now(); S.data = d; return d; });
  }

  function drawList() {
    if (!S.listEl || !S.data) return;
    var q = S.q.trim().toLowerCase(), f = S.filter;
    var us = S.data.users.filter(function (u) {
      if (q && ((u.name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(q) < 0) return false;
      if (f === 'on') return u.online;
      if (f === 'g') return mth(u) === 'Google';
      if (f === 'em') return mth(u) !== 'Google';
      return true;
    });
    S.listEl.replaceChildren();
    if (!us.length) S.listEl.appendChild(h('div', 'ap-empty', 'Tidak ada pengguna yang cocok.'));
    us.forEach(function (u) {
      var open = !!S.open[u.email], card = h('div', 'ap-user' + (open ? ' open' : '')), row = h('div', 'ap-row');
      var av = h('div', 'ap-av', (u.name || u.email || '?').trim().charAt(0).toUpperCase()); av.appendChild(h('i', 'ap-st' + (u.online ? ' on' : '')));
      var m = h('div', 'ap-um'), n = h('div', 'ap-un');
      n.append(h('span', null, u.name || 'Pengguna'), h('span', 'ap-badge', mth(u)));
      m.append(n, h('div', 'ap-ut', u.online ? 'Online sekarang' : (u.lastSeen ? 'Aktif ' + ago(u.lastSeen) : 'Belum ada aktivitas')));
      row.append(av, m, I('chev', 18, 'ap-chev'));
      row.onclick = function () { S.open[u.email] = !S.open[u.email]; drawList(); };
      card.appendChild(row);
      if (open) {
        var dd = h('div', 'ap-det');
        [['Email', u.email || '—'], ['Metode', mth(u)], ['Terakhir aktif', u.lastSeen ? new Date(u.lastSeen).toLocaleString('id-ID') : '—'], ['Bergabung', dt(u.firstSeen)]].forEach(function (r) { var k = h('div', 'ap-kv'); k.append(h('span', null, r[0]), h('span', null, r[1])); dd.appendChild(k); });
        var cp = h('button', 'ap-btn'); cp.type = 'button'; cp.append(I('copy', 16), h('span', null, 'Salin email'));
        cp.onclick = function () { try { navigator.clipboard.writeText(u.email || ''); cp.lastChild.textContent = 'Tersalin'; } catch (e) {} };
        dd.appendChild(cp); card.appendChild(dd);
      }
      S.listEl.appendChild(card);
    });
  }
  function paint() {
    var d = S.data; if (!d || !S.heroEl) return;
    var us = d.users, c = { on: 0, d1: 0, d7: 0, old: 0 }; us.forEach(function (u) { c[cat(u)]++; });
    var hero = S.heroEl; hero.replaceChildren();
    hero.append(h('div', 'ap-big', String(d.online)), h('div', 'ap-sub', 'online sekarang · dari ' + d.total + ' akun'));
    var bar = h('div', 'ap-bar'), tot = Math.max(us.length, 1);
    [['on', 1], ['d1', 0.55], ['d7', 0.3], ['old', 0.12]].forEach(function (x) { var s = h('div'); s.style.width = (c[x[0]] / tot * 100) + '%'; s.style.background = 'rgba(255,255,255,' + x[1] + ')'; bar.appendChild(s); });
    var mini = h('div', 'ap-mini');
    [['Aktif 24 jam', d.activeToday], ['Aktif 7 hari', d.active7d], ['Baru 7 hari', d.newThisWeek]].forEach(function (x) { var m = h('div'); m.append(h('b', null, String(x[1])), h('span', null, x[0])); mini.appendChild(m); });
    hero.append(bar, mini); drawList();
    var o = document.getElementById('apAccCard'); if (o) o.remove(); injectAcc();
  }
  function setLive(ok) { if (liveEl) liveEl.className = 'ap-livedot' + (ok ? '' : ' off'); }
  function refresh() {
    return fetchData().then(function () { setLive(true); paint(); }).catch(function (e) {
      if (e.status === 401) { location.href = '/login'; return; }
      setLive(false);
    });
  }
  function exportCsv() {
    if (!S.data) return;
    var q = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    var rows = [['Nama', 'Email', 'Metode', 'Online', 'Terakhir aktif', 'Pertama terlihat']].concat(S.data.users.map(function (u) { return [u.name, u.email, u.loginMethod, u.online ? 'ya' : 'tidak', u.lastSeen ? new Date(u.lastSeen).toISOString() : '', u.firstSeen ? new Date(u.firstSeen).toISOString() : '']; }));
    var blob = new Blob(['\ufeff' + rows.map(function (r) { return r.map(q).join(','); }).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'umaira-pengguna.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function theme() {
    var sv = null; try { sv = localStorage.getItem('umaira-admin-theme'); } catch (e) {}
    if (sv) return sv;
    var els = [document.body, document.documentElement];
    for (var i = 0; i < els.length; i++) { var m = getComputedStyle(els[i]).backgroundColor.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 120 ? 'dark' : 'light'; }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function btn(n, t, f) { var b = h('button', 'ap-ib'); b.type = 'button'; b.title = t; b.setAttribute('aria-label', t); b.appendChild(I(n, 18)); b.onclick = f; return b; }
  function build() {
    root = h('div', 'ap-root'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Panel Administrator');
    var hd = h('div', 'ap-head'), lg = h('div', 'ap-logo'), tt = h('div', 'ap-title'), tr = h('div', 'ap-trow');
    lg.appendChild(I('shield', 22)); liveEl = h('i', 'ap-livedot'); tr.append(h('b', null, 'Panel Admin'), liveEl);
    tt.append(tr, h('small', null, (window.__UMAIRA_USER__ && window.__UMAIRA_USER__.email) || 'Administrator'));
    hd.append(lg, tt,
      btn('moon', 'Ganti tema', function () { var t = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = t; try { localStorage.setItem('umaira-admin-theme', t); } catch (e) {} }),
      btn('refresh', 'Muat ulang', function () { refresh(); }), btn('x', 'Tutup', close));
    var main = h('div', 'ap-main'), wrap = h('div', 'ap-wrap');
    S.heroEl = h('div', 'ap-hero');
    var sw = h('label', 'ap-search'), inp = h('input'), ctl = h('div', 'ap-ctl');
    inp.type = 'search'; inp.placeholder = 'Cari nama atau email…'; inp.oninput = function () { S.q = inp.value; drawList(); };
    sw.append(I('search', 18), inp); ctl.append(sw, btn('dl', 'Ekspor CSV', exportCsv));
    var chips = h('div', 'ap-chips');
    [['all', 'Semua'], ['on', 'Online'], ['g', 'Google'], ['em', 'Email']].forEach(function (f) {
      var b = h('button', 'ap-chip' + (S.filter === f[0] ? ' on' : ''), f[1]); b.type = 'button';
      b.onclick = function () { S.filter = f[0]; [].forEach.call(chips.children, function (x) { x.classList.remove('on'); }); b.classList.add('on'); drawList(); };
      chips.appendChild(b);
    });
    S.listEl = h('div', 'ap-list');
    wrap.append(S.heroEl, ctl, chips, S.listEl); main.appendChild(wrap); root.append(hd, main); document.body.appendChild(root);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
  }
  function open() {
    if (!root) build();
    root.dataset.theme = theme(); root.classList.add('open'); document.body.style.overflow = 'hidden';
    paint(); refresh();
    clearInterval(S.timer); S.timer = setInterval(function () { if (document.visibilityState === 'visible') refresh(); }, 15000);
  }
  function close() { root.classList.remove('open'); document.body.style.overflow = ''; clearInterval(S.timer); }

  function install() {
    if (document.getElementById('navAdminBtn')) return;
    var nav = document.getElementById('navLoginBtn'), b = h('button', 'nav-item ap-nav-btn');
    b.type = 'button'; b.id = 'navAdminBtn';
    if (nav) { var s = h('span', 'nav-icon'); s.innerHTML = ic('shield', 18); b.append(s, h('span', null, 'Panel Admin')); nav.insertAdjacentElement('afterend', b); }
    else { b.className = 'ap-fab'; b.title = 'Panel Admin'; b.appendChild(I('shield', 22)); document.body.appendChild(b); }
    b.onclick = open;
  }
  function textNodes(t) {
    var out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { if (n.nodeValue.trim() === t && n.parentElement && !n.parentElement.closest('.ap-root,.ap-acc')) out.push(n); }
    return out;
  }
  function injectAcc() {
    if (!S.data || document.getElementById('apAccCard')) return;
    var bs = textNodes('Keamanan dan perangkat'), as = textNodes('Ringkasan');
    if (!bs.length || !as.length) return;
    var best = null;
    as.forEach(function (a) { bs.forEach(function (b) {
      var l = a.parentElement; while (l && !l.contains(b)) l = l.parentElement;
      if (!l || l === document.body) return;
      var size = l.getElementsByTagName('*').length;
      if (!best || size < best.size) best = { a: a, l: l, size: size };
    }); });
    if (!best) return;
    var card = best.a.parentElement; while (card && card.parentElement !== best.l) card = card.parentElement;
    if (!card) return;
    var el = h('div', 'ap-acc'), top = h('div', 'ap-acc-top'), lg = h('div', 'ap-acc-ic'), tx = h('div'), st = h('div', 'ap-acc-st');
    el.id = 'apAccCard'; lg.appendChild(I('shield', 22)); tx.append(h('b', null, 'Panel Administrator'), h('small', null, 'Khusus akun admin')); top.append(lg, tx);
    [['Akun', S.data.total], ['Online', S.data.online], ['Aktif 24 jam', S.data.activeToday]].forEach(function (x) { var d = h('div'); d.append(h('b', null, String(x[1])), h('span', null, x[0])); st.appendChild(d); });
    var b = h('button', 'ap-acc-btn'); b.type = 'button'; b.append(I('grid', 18), h('span', null, 'Buka Panel')); b.onclick = open;
    el.append(top, st, b); best.l.insertBefore(el, card);
  }
  function watchAcc() {
    var t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(injectAcc, 400); }).observe(document.body, { childList: true, subtree: true });
    injectAcc();
  }
  function boot() {
    fetchData().then(function () {
      install(); watchAcc();
      if (/[?&]admin=1(&|$)/.test(location.search)) { try { history.replaceState(null, '', location.pathname); } catch (e) {} open(); }
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
