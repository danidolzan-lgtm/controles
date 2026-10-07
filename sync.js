/* Sincronização dos controles com o Firebase (login Google + Firestore).
   Cada página carrega este arquivo com data-app="nome-do-controle".
   Os dados ficam em users/{seu uid}/apps/{controle}/... e só a sua conta lê e grava. */
(function () {
  var me = document.currentScript;
  var APP = (me && me.dataset.app) || "geral";
  var cfg = window.FIREBASE_CONFIG;
  var ready = !!(cfg && cfg.apiKey && cfg.apiKey.indexOf("COLE") !== 0 && window.firebase);

  var resolveDb, dbPromise = new Promise(function (r) { resolveDb = r; });
  window.claude = {
    use: function (name) {
      if (name === "db") return dbPromise;
      return Promise.resolve(null);
    }
  };
  if (!ready) { resolveDb(null); return; }

  firebase.initializeApp(cfg);
  var auth = firebase.auth();
  var fs = firebase.firestore();
  try { fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}

  function adapter(uid) {
    var base = "users/" + uid + "/apps/" + APP + "/";
    return {
      doc: function (p) { return fs.doc(base + p); },
      collection: function (p) { return fs.collection(base + p); }
    };
  }

  var bar;
  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Conta");
    bar.style.cssText = "display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:12px 16px 0;padding:10px 12px;border-radius:9px;border:1px solid rgba(127,140,136,.4);font:14px system-ui,sans-serif";
    document.body.insertBefore(bar, document.body.firstChild.nextSibling);
    return bar;
  }
  function showLogin() {
    var b = ensureBar();
    b.innerHTML = "<span>Entre para sincronizar seus dados entre celular e PC.</span>";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Entrar com Google";
    btn.style.cssText = "font:600 14px system-ui,sans-serif;padding:8px 14px;border-radius:7px;border:0;background:#1F5C7A;color:#fff;cursor:pointer";
    btn.onclick = function () {
      var prov = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(prov).catch(function () { auth.signInWithRedirect(prov); });
    };
    b.appendChild(btn);
    b.hidden = false;
  }
  function showUser(u) {
    if (!me.dataset.showUser) { if (bar) bar.hidden = true; return; }
    var b = ensureBar();
    b.innerHTML = "<span>Sincronizando como <b></b></span>";
    b.querySelector("b").textContent = u.email || "sua conta";
    var out = document.createElement("button");
    out.type = "button"; out.textContent = "Sair";
    out.style.cssText = "font:600 14px system-ui,sans-serif;padding:6px 12px;border-radius:7px;border:1px solid rgba(127,140,136,.5);background:transparent;color:inherit;cursor:pointer";
    out.onclick = function () { auth.signOut().then(function () { location.reload(); }); };
    b.appendChild(out);
    b.hidden = false;
  }

  var done = false;
  auth.onAuthStateChanged(function (u) {
    var go = function () {
      if (u) { showUser(u); if (!done) { done = true; resolveDb(adapter(u.uid)); } }
      else showLogin();
    };
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  });
})();
