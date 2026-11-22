// PV Explorer service worker: makes the game installable (PWA) and lets it reopen without network.
// Network first for the game's own files (always the latest version when online), the cached copy otherwise.
// Cross-origin requests (IGN map tiles, Supabase, CDN) are left to the browser.
const CACHE = 'pvx-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) {
        // one copy per file: drop the copies of older versions (?v=…) before storing this one
        if (url.search) for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return (await c.match(req)) || (req.mode === 'navigate' && await c.match('index.html')) || Response.error();
    }
  })());
});
