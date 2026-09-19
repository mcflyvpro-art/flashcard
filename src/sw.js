/* Modèle du service worker. Il n'est pas servi tel quel : au build, le
   plugin `serviceWorker` de vite.config.js remplace les deux marqueurs par
   l'empreinte du build et la liste exacte des fichiers produits.

   Le numéro de cache s'écrivait avant à la main (folio-v69) : un oubli, ou
   un merge qui le faisait redescendre (v66 → v47, c'est arrivé), et les
   téléphones gardaient l'ancienne app. Il se calcule maintenant sur le
   contenu : un fichier change, le cache change. */
const C = 'folio-__BUILD__';
const BASE = '__BASE__';
const SHELL = __SHELL__;
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
      .catch(() => caches.match(req).then(hit => hit || caches.match(BASE + 'index.html')))
  );
});
