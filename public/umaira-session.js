(function () {
  var user = window.__UMAIRA_USER__;
  if (!user || !user.id) return;

  var PREFIX = "u:" + user.id + ":";
  var SHARED = /^(umaira-theme|umaira-legacy-claimed)/;
  var ls = window.localStorage;
  var proto = Storage.prototype;
  var rawGet = proto.getItem;
  var rawSet = proto.setItem;
  var rawRemove = proto.removeItem;
  var rawKey = proto.key;

  try {
    if (rawGet.call(ls, "umaira-legacy-claimed") === null) {
      var legacy = [];
      for (var i = 0; i < ls.length; i++) {
        var k = rawKey.call(ls, i);
        if (k && k.indexOf("u:") !== 0 && !SHARED.test(k)) legacy.push(k);
      }
      legacy.forEach(function (key) {
        if (rawGet.call(ls, PREFIX + key) === null) {
          rawSet.call(ls, PREFIX + key, rawGet.call(ls, key));
        }
      });
      rawSet.call(ls, "umaira-legacy-claimed", user.id);
    }
  } catch (e) {}

  function map(key) {
    key = String(key);
    return SHARED.test(key) || key.indexOf("u:") === 0 ? key : PREFIX + key;
  }
  proto.getItem = function (key) { return rawGet.call(this, this === ls ? map(key) : key); };
  proto.setItem = function (key, value) { return rawSet.call(this, this === ls ? map(key) : key, value); };
  proto.removeItem = function (key) { return rawRemove.call(this, this === ls ? map(key) : key); };

  var done = false;
  function goLogin() {
    if (done) return;
    done = true;
    location.replace("/login");
  }

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || String(input);
    var p = origFetch.apply(this, arguments);
    p.then(function (res) {
      try {
        var u = new URL(url, location.href);
        if (u.origin !== location.origin) return;
        if (u.pathname === "/api/auth/logout" && res.ok) goLogin();
        else if (res.status === 401 && u.pathname.indexOf("/api/") === 0 && u.pathname.indexOf("/api/auth/") !== 0) goLogin();
      } catch (e) {}
    }, function () {});
    return p;
  };
  // ===== UMAIRA PRESENCE HEARTBEAT =====
  function ping() {
    if (document.visibilityState !== "visible") return;
    origFetch.call(window, "/api/auth/me", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    }).catch(function () {});
  }
  setInterval(ping, 60000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") ping();
  });
  // ===== END UMAIRA PRESENCE HEARTBEAT =====
})();
