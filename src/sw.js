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
/* Réseau d'abord (l'app se met à jour toute seule), cache en secours hors
   ligne. `ignoreVary` : le serveur répond « Vary: Origin », et un morceau
   chargé à la demande (journal, espace professeur, partie en direct) est
   demandé comme module, avec un en-tête Origin que la copie faite à
   l'installation n'avait pas — le cache la refusait, rendait index.html à
   la place, et le morceau ne s'ouvrait jamais hors ligne. */
/* Chaque écran a son adresse (src/routes.js) et toutes servent la même
   page : une navigation se range sous index.html, jamais sous son adresse
   — sinon chaque livre, chaque classe ouverte laisserait sa copie, et une
   adresse jamais visitée ne s'ouvrirait pas hors ligne. Seule une réponse
   saine remplace la page gardée. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === 'navigate', cle = page ? BASE + 'index.html' : req;
  e.respondWith(
    fetch(req)
      .then(r => {
        if (!page || r.ok) { const c = r.clone(); caches.open(C).then(x => x.put(cle, c)); }
        return r;
      })
      .catch(() => caches.match(cle, { ignoreVary: true })
        .then(hit => hit || caches.match(BASE + 'index.html', { ignoreVary: true })))
  );
});
