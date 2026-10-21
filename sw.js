/* Service worker do Meus Controles.
   Sempre busca a versão nova no servidor (GitHub) primeiro; o cache só é usado sem internet.
   Assim, cada vez que você atualiza o git, o app no celular já abre com a versão nova. */
const CACHE = "meus-controles-v1";

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // login e banco de dados do Firebase: nunca passam pelo cache
  if (/googleapis\.com|firebaseio|identitytoolkit|securetoken|firebaseapp\.com/.test(url.hostname)) return;
  const mesmo = url.origin === self.location.origin;
  const lib = /gstatic\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname);
  if (!mesmo && !lib) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, mesmo ? { cache: "no-cache" } : undefined);
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") { const home = await cache.match("index.html"); if (home) return home; }
      throw err;
    }
  })());
});
