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
      ".wrap{grid-template-columns:minmax(0,1fr)}.panel{min-width:0;max-width:100%;grid-template-columns:minmax(0,1fr)}.panel>*,.wrap>*{min-width:0;max-width:100%}input[type=file]{max-width:100%;min-width:0}img,canvas,video{max-width:100%}" +
      ".voltar{display:none!important}" +
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


  /* ===== Layout de site: barra de topo com menu + página em tela cheia (PC, celular em pé e deitado) ===== */
  (function () {
    var file = (decodeURIComponent(location.pathname).split("/").pop() || "index.html").replace(/\.html?$/i, "") || "index";
    document.documentElement.setAttribute("data-page", file);
    var GROUPS = [
      { g: "Opções binárias", s: "OB", k: "ob", c: "#2563EB", items: [["checklist-ob", "Check-list"], ["diario-ob", "Diário"], ["manual-ob", "Manual"], ["progresso-ob", "Progresso"], ["dopamina", "Dopamina"], ["ir-ob", "IR"], ["analise-ob", "Análise"], ["lucro-ob", "Lucro"]] },
      { g: "B3", s: "B3", k: "b3", c: "#0F766E", items: [["checklist-b3", "Check-list"], ["diario-b3", "Diário"], ["manual-b3", "Manual"], ["progresso-b3", "Progresso"], ["dopamina-b3", "Dopamina"], ["ir-b3", "IR"], ["analise-b3", "Análise"]] },
      { g: "Pessoal", s: "Pessoal", k: "pes", c: "#7C3AED", items: [["salario", "Salário"], ["oracao", "Oração"], ["receitas", "Receitas"], ["limpeza", "Limpeza de peças"], ["consorcio", "Consórcios"]] }
    ];
    var cur = null;
    GROUPS.forEach(function (g) { g.items.forEach(function (it) { if (it[0] === file) cur = { g: g, it: it }; }); });
    var css =
      ":root{--site-max:1680px;--site-pad:clamp(16px,2.6vw,40px);--site-h:58px;--stick:58px}" +
      "html[data-page] .wrap{max-width:var(--site-max)!important;width:100%!important;padding-inline:var(--site-pad)!important;padding-top:20px!important}" +
      ".site-h{position:sticky;top:0;z-index:80;background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--line,#DDE4F2);font-family:'IBM Plex Sans',system-ui,sans-serif;padding-top:env(safe-area-inset-top,0px)}" +
      "@media (prefers-color-scheme: dark){.site-h{background:rgba(15,23,42,.86)}}" +
      ".site-h a{background:none;border:0;padding:0;border-radius:0;position:static;overflow:visible;transform:none;box-shadow:none;display:inline}.site-h a:hover{background:none;border:0;transform:none;box-shadow:none}.site-h a::before{display:none!important}.site-h a span,.site-h a b{font-size:inherit;color:inherit}" +
      ".site-in{max-width:var(--site-max);margin:0 auto;padding:0 var(--site-pad);height:var(--site-h);display:flex;align-items:center;gap:14px}" +
      ".site-h .site-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--fg,#13203B);font:800 1.05rem 'Archivo',system-ui,sans-serif;white-space:nowrap;flex:none}" +
      ".site-logo{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;display:grid;place-items:center;font-size:.78rem;letter-spacing:.02em;box-shadow:0 4px 12px -4px rgba(37,99,235,.6)}" +
      ".site-h .site-logo{color:#fff!important}" +
      ".site-logo{transition:transform .18s ease,box-shadow .18s ease}.site-h .site-brand .t{transition:color .18s ease}" +
      ".site-h .site-brand:hover .site-logo{transform:translateY(-2px) rotate(-6deg) scale(1.06);box-shadow:0 8px 18px -6px rgba(37,99,235,.7)}.site-h .site-brand:hover .t{color:var(--accent,#2563EB)}" +
      ".site-crumb{display:flex;gap:7px;align-items:center;color:var(--muted,#58668A);font-size:.92rem;min-width:0;white-space:nowrap;overflow:hidden}" +
      ".site-crumb .sep{opacity:.5}.site-crumb b{color:var(--fg,#13203B);font-weight:600;overflow:hidden;text-overflow:ellipsis}" +
      ".site-h .site-crumb .tag{font:inherit;display:inline-flex;align-items:center;gap:6px}.site-crumb .tag i{width:8px;height:8px;border-radius:50%}" +
      ".site-quick{display:none;gap:2px;margin-left:auto;align-items:center}" +
      ".site-h .site-quick a{padding:8px 12px;border-radius:9px;text-decoration:none;color:var(--muted,#58668A);font-weight:600;font-size:.88rem;white-space:nowrap}" +
      ".site-h .site-quick a:hover{background:var(--bg,#EEF3FC);color:var(--fg,#13203B)}" +
      ".site-h .site-quick a.on{color:#fff;background:var(--gc,#2563EB)}" +
      ".site-btn{margin-left:auto;flex:none;appearance:none;display:inline-flex;align-items:center;gap:8px;font:600 .9rem 'IBM Plex Sans',system-ui,sans-serif;color:var(--fg,#13203B);background:var(--surface,#fff);border:1px solid var(--line,#DDE4F2);border-radius:10px;padding:8px 14px;cursor:pointer}" +
      ".site-btn:hover,.site-btn[aria-expanded=true]{border-color:var(--accent,#2563EB);color:var(--accent,#2563EB)}" +
      ".site-btn svg{width:18px;height:18px}" +
      ".day.we,.legend i.we{background-image:repeating-linear-gradient(135deg,transparent 0 5px,rgba(120,135,170,.22) 5px 6.5px)!important}" +
      ".site-back{margin-left:0;padding:8px 12px 8px 8px}.site-back svg{width:18px;height:18px}" +
      "@media (max-width:560px){.site-back .t{display:inline!important}.site-crumb .tag,.site-crumb .sep:first-child{display:none}}" +
      ".site-drop{position:absolute;left:0;right:0;top:100%;background:var(--surface,#fff);border-bottom:1px solid var(--line,#DDE4F2);box-shadow:0 24px 48px -24px rgba(19,32,59,.45);max-height:calc(100dvh - var(--site-h));overflow:auto}" +
      ".site-drop-in{max-width:var(--site-max);margin:0 auto;padding:18px var(--site-pad) 24px;display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}" +
      ".site-drop h4{margin:0 0 6px;font:700 .72rem 'IBM Plex Sans',system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#58668A);display:flex;align-items:center;gap:8px}" +
      ".site-drop h4 i{width:9px;height:9px;border-radius:50%}" +
      ".site-h .site-drop a{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:9px;text-decoration:none;color:var(--fg,#13203B);font-size:.96rem}" +
      ".site-h .site-drop a:hover{background:var(--bg,#EEF3FC)}.site-h .site-drop a.on{background:var(--gc,#2563EB);color:#fff;font-weight:600}" +
      ".site-drop .home{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.site-h .site-drop .home a{border:1px solid var(--line,#DDE4F2);font-weight:600}" +
      "@media (min-width:1180px){.site-quick{display:flex}.site-quick~.site-btn{margin-left:6px}}" +
      "@media (max-width:560px){.site-brand .t{display:none}.site-btn .t{display:none}.site-btn{padding:8px 10px}}" +
      "@media (orientation:landscape) and (max-height:500px){:root{--site-h:48px;--stick:0px}.site-h{position:relative}}" +
      /* listas e cartões mais largos aproveitando a tela */
      "@media (min-width:900px){" +
        "html[data-page=index] .app{grid-template-columns:230px minmax(0,1fr)!important}" +
        "html[data-page=index] .side{top:calc(var(--stick) + 12px)!important}" +
        "html[data-page=index] .grid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))!important}" +
        "}" +
      "html[data-page^=manual] .tabs{top:var(--stick)!important}" +
      "html[data-page=index] .side{top:var(--stick)!important}" +
      "html[data-page^=checklist] .day{aspect-ratio:auto!important;height:40px}" +
      /* PC: páginas em colunas */
      "@media (min-width:1100px){" +
        "html[data-page] .wrap{grid-auto-flow:row dense}" +
        /* análise: nova análise à esquerda, conversa e salvas à direita */
        "html[data-page^=analise] .wrap{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)!important;grid-template-rows:auto auto auto auto auto 1fr}" + "html[data-page^=analise] .wrap>*{grid-column:1/-1}" +
        "html[data-page^=analise] #nova{grid-column:1;grid-row:3 / 7;align-self:start}" + "html[data-page^=analise] #chatBox{grid-column:2;grid-row:3}html[data-page^=analise] #cfgBox{grid-column:2;grid-row:4}html[data-page^=analise] .wrap>.panel:last-child{grid-column:2;grid-row:5}" +
        /* check-list: itens do dia à esquerda, calendário à direita */
        "html[data-page^=checklist] .wrap{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;align-items:start}" + "html[data-page^=checklist] .wrap>.top{grid-column:1/-1}" +
        "html[data-page^=checklist] .wrap>.panel:last-child{position:sticky;top:calc(var(--stick) + 12px)}" +
        /* diário: calendário grande à esquerda, resumos à direita */
        "html[data-page^=diario] .wrap{grid-template-columns:minmax(0,1.75fr) minmax(320px,1fr)!important;align-items:start}" + "html[data-page^=diario] .wrap>*{grid-column:1/-1}" +
        "html[data-page^=diario] .wrap>.two{grid-column:2;grid-template-columns:minmax(0,1fr)!important}" + "html[data-page^=diario] .wrap>.two~*{grid-column:1/-1}" +
        "html[data-page^=diario] .wrap>.panel:not(.cfg){grid-column:1}" +
        /* IR OB: importação e regras à esquerda, tabela dos meses à direita */
        "html[data-page=ir-ob] .wrap{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)!important;grid-template-rows:auto auto auto auto auto 1fr;align-items:start}" + "html[data-page=ir-ob] .wrap>*{grid-column:1/-1}" +
        "html[data-page=ir-ob] #imp{grid-column:1;grid-row:4}html[data-page=ir-ob] .wrap>.note{grid-column:1;grid-row:5}html[data-page=ir-ob] #imp~.panel:not(.note){grid-column:2;grid-row:4 / 7}" +
        /* IR B3: meses em grade */
        "html[data-page=ir-b3] #meses{grid-template-columns:repeat(auto-fill,minmax(480px,1fr));align-items:start}" +
        /* receitas: busca à esquerda, caderno à direita */
        "html[data-page=receitas] .wrap{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)!important;grid-template-rows:auto auto auto auto 1fr;align-items:start}" + "html[data-page=receitas] .wrap>*{grid-column:1}" +
        "html[data-page=receitas] .wrap>.top{grid-column:1/-1}" + "html[data-page=receitas] .wrap>.panel:last-child{grid-column:2;grid-row:2 / 6}" +
        /* manuais: índice fixo na lateral, conteúdo à direita */
        "html[data-page^=manual] .wrap{grid-template-columns:220px minmax(0,1fr)!important;align-items:start}" + "html[data-page^=manual] .wrap>*{grid-column:2}" +
        "html[data-page^=manual] .wrap>.top{grid-column:1/-1}" +
        "html[data-page^=manual] .wrap>.tabs{grid-column:1;grid-row:2 / span 12;position:sticky!important;top:calc(var(--stick) + 12px)!important;flex-direction:column;flex-wrap:nowrap!important;background:transparent!important;align-self:start}" +
        "html[data-page^=manual] .wrap>.tabs a{display:block;padding:9px 12px!important}" +
        /* limpeza: lotes em grade */
        "html[data-page=limpeza] #lotes{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px;align-items:start}" +
      "}" +
      /* oração: texto longo fica confortável de ler */
      "html[data-page=oracao] .wrap{max-width:1100px!important}";
    var st2 = document.createElement("style"); st2.textContent = css;
    (document.head || document.documentElement).appendChild(st2);

    function el(t, cls, html) { var e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function goTab(k) { try { localStorage.setItem("index.tab", k); } catch (e) {} }
    function build() {
      if (document.querySelector(".site-h")) return;
      var h = el("header", "site-h"); h.setAttribute("role", "banner");
      var inn = el("div", "site-in");
      if (file !== "index") {
        var back = el("button", "site-btn site-back", "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M15 18l-6-6 6-6'/></svg><span class='t'>Voltar</span>");
        back.type = "button"; back.setAttribute("aria-label", "Voltar");
        back.addEventListener("click", function () {
          var ref = document.referrer, same = false;
          try { same = !!ref && new URL(ref).origin === location.origin && ref.split("#")[0] !== location.href.split("#")[0]; } catch (e) {}
          if (same && history.length > 1) history.back(); else location.href = "index.html";
        });
        inn.appendChild(back);
      }
      inn.appendChild(el("a", "site-brand", "<span class='site-logo'>MC</span><span class='t'>Meus Controles</span>")).href = "index.html";
      var crumb = el("div", "site-crumb");
      if (cur) crumb.innerHTML = "<span class='sep'>/</span><a class='tag' href='index.html' data-k='" + cur.g.k + "' style='color:inherit;text-decoration:none'><i style='background:" + cur.g.c + "'></i>" + esc(cur.g.s) + "</a><span class='sep'>/</span><b>" + esc(cur.it[1]) + "</b>";
      inn.appendChild(crumb);
      if (cur) {
        var q = el("nav", "site-quick"); q.setAttribute("aria-label", cur.g.g); q.style.setProperty("--gc", cur.g.c);
        cur.g.items.forEach(function (it) { var a = el("a", it[0] === file ? "on" : "", esc(it[1])); a.href = it[0] + ".html"; if (it[0] === file) a.setAttribute("aria-current", "page"); q.appendChild(a); });
        inn.appendChild(q);
      }
      var btn = el("button", "site-btn", "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'><path d='M4 7h16M4 12h16M4 17h16'/></svg><span class='t'>Menu</span>");
      btn.type = "button"; btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", "Abrir menu");
      inn.appendChild(btn); h.appendChild(inn);
      var drop = el("div", "site-drop"); drop.hidden = true; var di = el("div", "site-drop-in");
      GROUPS.forEach(function (g) {
        var col = el("div"); col.style.setProperty("--gc", g.c);
        col.appendChild(el("h4", "", "<i style='background:" + g.c + "'></i>" + esc(g.g)));
        g.items.forEach(function (it) { var a = el("a", it[0] === file ? "on" : "", "<span>" + esc(it[1]) + "</span>"); a.href = it[0] + ".html"; col.appendChild(a); });
        di.appendChild(col);
      });
      var home = el("div", "home"); var ha = el("a", "", "← Início · Meus Controles"); ha.href = "index.html"; home.appendChild(ha); di.insertBefore(home, di.firstChild);
      drop.appendChild(di); h.appendChild(drop);
      function setOpen(o) { drop.hidden = !o; btn.setAttribute("aria-expanded", o ? "true" : "false"); }
      btn.addEventListener("click", function (e) { e.stopPropagation(); setOpen(drop.hidden); });
      document.addEventListener("click", function (e) { if (!drop.hidden && !h.contains(e.target)) setOpen(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
      var tag = crumb.querySelector("[data-k]"); if (tag) tag.addEventListener("click", function () { goTab(tag.dataset.k); });
      document.body.insertBefore(h, document.body.firstChild);
      document.querySelectorAll(".voltar").forEach(function (v) { v.remove(); });
    }
    if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
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
    while (ref && ref.classList && (ref.classList.contains("voltar") || ref.classList.contains("site-h"))) ref = ref.nextSibling;
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
