const C = 'cartes-v1';
const SHELL = ['.', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // decks: réseau d'abord (pour recevoir les injections), cache en secours
  if (url.pathname.includes('/decks/')) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(C).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // app: cache d'abord, mise à jour en arrière-plan
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { const c = r.clone(); caches.open(C).then(x => x.put(req, c)); return r; }).catch(() => hit);
    return hit || net;
  }));
});
