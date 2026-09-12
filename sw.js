const C = 'folio-v50';
const SHELL = ['.', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'icons/icon-maskable.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
// réseau d'abord (l'app se met à jour toute seule), cache en secours hors ligne
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(r => { const c = r.clone(); caches.open(C).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
