/* Sincronização dos controles com o Firebase (login + Firestore).
   Cada página carrega este arquivo com data-app="nome-do-controle".
   Os dados ficam em users/{seu uid}/apps/{controle}/... e só a sua conta lê e grava. */
(function () {
  var me = document.currentScript;
  var APP = (me && me.dataset.app) || "geral";
  var SHOW_USER = !!(me && me.dataset.showUser);
  var cfg = window.FIREBASE_CONFIG;
  /* Confirmação visual para os botões de salvar/lançar de todas as páginas:
     ui.done(botão, "Salvo")  → botão fica verde com ✓ por 2 s e aparece um aviso embaixo da tela
     ui.toast("texto")        → só o aviso */
  (function () {
    var st = document.createElement("style");
    st.textContent = ".ui-ok{background:#15803D!important;border-color:#15803D!important;color:#fff!important;opacity:1!important;transition:background .2s}" +
      ".ui-toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;z-index:99;background:#13203B;color:#fff;font:600 14px system-ui,sans-serif;padding:10px 16px;border-radius:9px;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:opacity .2s,transform .2s;max-width:calc(100% - 32px);text-align:center;pointer-events:none}" +
      ".ui-toast.on{opacity:1;transform:translate(-50%,0)}.ui-toast.err{background:#E11D48}" +
      /* efeito de clique em todos os botões: afunda e volta */
      "button,.btn,a.calc{transition:transform .08s ease,filter .08s ease,box-shadow .08s ease;-webkit-tap-highlight-color:transparent}" +
      "button:not([disabled]):active,.btn:active,a.calc:active,.ui-press{transform:scale(.95);filter:brightness(.88)}" +
      ".ui-busy{position:relative;pointer-events:none;opacity:.85}" +
      ".ui-spin{display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:-2px;margin-right:6px;animation:uispin .7s linear infinite}" +
      "@keyframes uispin{to{transform:rotate(360deg)}}" +
      /* "← Meus Controles" fixo no topo enquanto rola a página */
      "html,body{overflow-x:clip!important}" +
      ".voltar{position:sticky!important;top:8px;z-index:60;display:flex!important;width:max-content;align-items:center;gap:4px;margin:10px 16px 0!important;padding:7px 14px;border-radius:999px;opacity:1!important;color:#2563EB!important;background:rgba(255,255,255,.88);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(37,99,235,.25);box-shadow:0 4px 14px -4px rgba(19,32,59,.25)}" +
      "@media (prefers-color-scheme: dark){.voltar{background:rgba(22,33,58,.88);color:#93C5FD!important;border-color:rgba(147,197,253,.3)}}" +
      /* visual mais vivo em todas as páginas */
      "body{background-image:radial-gradient(900px 420px at 0% -8%,rgba(37,99,235,.16),transparent 62%),radial-gradient(800px 380px at 100% 0%,rgba(124,58,237,.12),transparent 60%),radial-gradient(700px 500px at 50% 110%,rgba(34,197,94,.08),transparent 60%);background-attachment:fixed}" +
      ".panel,.wrap>.grid>a,.step,.it,.ib{box-shadow:0 1px 2px rgba(19,32,59,.05),0 6px 18px -6px rgba(37,99,235,.18)}" +
      "h1{background:linear-gradient(90deg,#2563EB,#7C3AED);-webkit-background-clip:text;background-clip:text;color:transparent!important}" +
      "@media (prefers-color-scheme: dark){h1{background:linear-gradient(90deg,#60A5FA,#C4B5FD);-webkit-background-clip:text;background-clip:text}.panel,.wrap>.grid>a,.step,.it{box-shadow:0 6px 18px -8px rgba(0,0,0,.6)}}";
    (document.head || document.documentElement).appendChild(st);
    var box, tmr;
    function toast(msg, err) {
      if (!document.body) return;
      if (!box) { box = document.createElement("div"); box.className = "ui-toast"; box.setAttribute("role", "status"); document.body.appendChild(box); }
      box.textContent = msg; box.classList.toggle("err", !!err);
      box.classList.add("on"); clearTimeout(tmr); tmr = setTimeout(function () { box.classList.remove("on"); }, 2200);
    }
    function done(btn, label, keep) {
      if (btn && !btn.isConnected) btn = null;
      if (btn) {
        if (btn._uiT) clearTimeout(btn._uiT); else btn._uiOld = btn.innerHTML;
        btn.classList.add("ui-ok"); btn.innerHTML = "✓ " + (label || "Salvo");
        if (!keep) btn._uiT = setTimeout(function () { btn.classList.remove("ui-ok"); btn.innerHTML = btn._uiOld; btn._uiT = null; }, 2000);
      }
      toast("✓ " + (label || "Salvo"));
    }
    /* "apertado" visível também no celular (o :active do iPhone precisa de touchstart) */
    document.addEventListener("touchstart", function () {}, { passive: true });
    document.addEventListener("pointerdown", function (e) {
      var b = e.target.closest && e.target.closest("button,.btn"); if (!b || b.disabled) return;
      b.classList.add("ui-press"); setTimeout(function () { b.classList.remove("ui-press"); }, 140);
    }, true);
    function busy(btn, label) {
      if (!btn) return function () {};
      var old = btn.innerHTML; btn.classList.add("ui-busy"); btn.innerHTML = "<span class='ui-spin'></span>" + (label || "Aguarde…");
      return function () { btn.classList.remove("ui-busy"); btn.innerHTML = old; };
    }
    window.ui = { toast: toast, done: done, busy: busy };
  })();

  var resolveDb, dbPromise = new Promise(function (r) { resolveDb = r; });
  window.claude = { use: function (name) { return name === "db" ? dbPromise : Promise.resolve(null); } };

  var MSG = {
    "auth/unauthorized-domain": "Este endereço não está liberado. No Firebase: Authentication → Configurações → Domínios autorizados → adicione exatamente " + location.hostname + " (sem https e sem /controles).",
    "auth/operation-not-allowed": "Esse tipo de login não está ativado. No Firebase: Authentication → Método de login → ative Google e também E-mail/senha.",
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Tentando de outro jeito…",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes de terminar.",
    "auth/cancelled-popup-request": "A janela do Google foi fechada antes de terminar.",
    "auth/invalid-api-key": "A chave do firebase-config.js está errada. Copie de novo o apiKey do Firebase.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "A chave do firebase-config.js está errada. Copie de novo o apiKey do Firebase.",
    "auth/network-request-failed": "Sem internet ou conexão bloqueada. Tente de novo.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/user-not-found": "Não existe conta com esse e-mail. Toque em Criar conta.",
    "auth/email-already-in-use": "Já existe conta com esse e-mail. Use Entrar.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/web-storage-unsupported": "Este navegador está bloqueando o login. Abra pelo Chrome normal, fora de aba anônima.",
    "auth/missing-initial-state": "O navegador perdeu o login no caminho de volta do Google. Use o login com e-mail e senha abaixo."
  };
  function explain(e) { var c = e && e.code; return MSG[c] || ("Não deu certo (" + (c || (e && e.message) || "erro") + ")."); }

  var bar;
  var css = "font:600 14px system-ui,sans-serif;padding:8px 14px;border-radius:7px;cursor:pointer;";
  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Conta");
    bar.style.cssText = "display:grid;gap:8px;margin:10px auto 0;padding:8px 12px;border-radius:10px;border:1px solid rgba(127,140,136,.45);font:13px/1.4 system-ui,sans-serif;width:calc(100% - 32px);max-width:420px;box-sizing:border-box";
    var ref = document.body.firstChild;
    if (ref && ref.classList && ref.classList.contains("voltar")) ref = ref.nextSibling;
    document.body.insertBefore(bar, ref);
    return bar;
  }
  function errBox(b) { var p = document.createElement("div"); p.style.cssText = "color:#E11D48;font-size:13px"; p.setAttribute("role", "alert"); b.appendChild(p); return p; }

  if (!(cfg && cfg.apiKey && cfg.apiKey.indexOf("COLE") !== 0)) {
    var go0 = function () { var b = ensureBar(); b.textContent = "Firebase ainda não configurado: preencha o firebase-config.js. Por enquanto os dados ficam só neste aparelho."; };
    if (document.body) go0(); else document.addEventListener("DOMContentLoaded", go0);
    resolveDb(null); return;
  }
  if (!window.firebase) {
    var go1 = function () { var b = ensureBar(); b.textContent = "Não carregou o Firebase (sem internet?). Os dados ficam só neste aparelho por enquanto."; };
    if (document.body) go1(); else document.addEventListener("DOMContentLoaded", go1);
    resolveDb(null); return;
  }

  firebase.initializeApp(cfg);
  var auth = firebase.auth();
  var fs = firebase.firestore();
  try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
  try { fs.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}

  var lastErr = "";
  auth.getRedirectResult().catch(function (e) { lastErr = explain(e); if (bar && bar._err) bar._err.textContent = lastErr; });

  function adapter(uid) {
    var base = "users/" + uid + "/apps/" + APP + "/";
    return { doc: function (p) { return fs.doc(base + p); }, collection: function (p) { return fs.collection(base + p); } };
  }

  function showLogin() {
    var b = ensureBar(); b.innerHTML = ""; b.hidden = false;
    var t = document.createElement("div"); t.textContent = "Entre para sincronizar seus dados entre celular e PC."; b.appendChild(t);
    var g = document.createElement("button"); g.type = "button"; g.textContent = "Entrar com Google";
    g.style.cssText = css + "border:0;background:#2563EB;color:#fff;justify-self:start";
    b.appendChild(g);
    var det = document.createElement("details");
    det.innerHTML = "<summary style='cursor:pointer'>Entrar com e-mail e senha</summary>";
    var f = document.createElement("form"); f.style.cssText = "display:grid;gap:8px;margin-top:8px";
    f.innerHTML = "<input type='email' autocomplete='email' placeholder='E-mail' required style='font:inherit;padding:9px 10px;border-radius:7px;border:1px solid rgba(127,140,136,.6);background:transparent;color:inherit;min-width:0'>" +
      "<input type='password' autocomplete='current-password' placeholder='Senha (mín. 6)' required minlength='6' style='font:inherit;padding:9px 10px;border-radius:7px;border:1px solid rgba(127,140,136,.6);background:transparent;color:inherit;min-width:0'>" +
      "<div style='display:flex;gap:8px;flex-wrap:wrap'><button type='submit' style='" + css + "border:0;background:#2563EB;color:#fff'>Entrar</button><button type='button' data-new style='" + css + "border:1px solid rgba(127,140,136,.6);background:transparent;color:inherit'>Criar conta</button></div>";
    det.appendChild(f); b.appendChild(det);
    var err = errBox(b); b._err = err; err.textContent = lastErr;
    g.onclick = function () {
      err.textContent = "";
      var prov = new firebase.auth.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: "select_account" });
      auth.signInWithPopup(prov).catch(function (e) {
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
          err.textContent = MSG["auth/popup-blocked"];
          auth.signInWithRedirect(prov).catch(function (e2) { err.textContent = explain(e2); });
        } else err.textContent = explain(e);
      });
    };
    var em = f.querySelector("input[type=email]"), pw = f.querySelector("input[type=password]");
    f.onsubmit = function (ev) { ev.preventDefault(); err.textContent = ""; auth.signInWithEmailAndPassword(em.value.trim(), pw.value).catch(function (e) { err.textContent = explain(e); }); };
    f.querySelector("[data-new]").onclick = function () {
      if (!em.value || pw.value.length < 6) { err.textContent = "Preencha e-mail e uma senha de pelo menos 6 caracteres."; return; }
      err.textContent = ""; auth.createUserWithEmailAndPassword(em.value.trim(), pw.value).catch(function (e) { err.textContent = explain(e); });
    };
  }
  function showUser(u) {
    if (!SHOW_USER) { if (bar) bar.hidden = true; return; }
    var b = ensureBar(); b.innerHTML = ""; b.hidden = false;
    b.style.gridTemplateColumns = "1fr auto"; b.style.alignItems = "center";
    var s = document.createElement("span"); s.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.8"; var dot = document.createElement("span"); dot.textContent = "● "; dot.style.color = "#22C55E"; s.appendChild(dot); s.appendChild(document.createTextNode("Online · " + (u.email || "sua conta"))); b.appendChild(s);
    var out = document.createElement("button"); out.type = "button"; out.textContent = "Sair";
    out.style.cssText = "font:600 12px system-ui,sans-serif;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid rgba(127,140,136,.6);background:transparent;color:inherit";
    out.onclick = function () { auth.signOut().then(function () { location.reload(); }); };
    b.appendChild(out);
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
