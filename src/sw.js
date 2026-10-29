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

/* L'ancien domaine (2026-10-29 : « tout est mirandola.fr ») : Vercel y
   renvoie toute adresse vers mirandola.fr, sauf ce fichier — l'app installée
   là-bas tournait sur sa copie en cache, sans jamais redemander le réseau.
   Ce service worker-ci, le seul qu'elle reçoit encore, ne garde rien : il
   vide les caches, se désinscrit et mène chaque fenêtre ouverte à la même
   adresse sur mirandola.fr. On s'y reconnecte (le stockage local est propre
   à chaque domaine) — accepté. */
const ANCIEN = ['www.folioflashcard.online', 'folioflashcard.online', 'flashcard-roan-chi.vercel.app']
  .includes(self.location.hostname);

self.addEventListener('install', e => {
  if (ANCIEN) { self.skipWaiting(); return; }
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  if (ANCIEN) {
    e.waitUntil((async () => {
      for (const k of await caches.keys()) await caches.delete(k);
      await self.registration.unregister();
      for (const c of await self.clients.matchAll({ type: 'window' })) {
        const u = new URL(c.url);
        c.navigate('https://mirandola.fr' + u.pathname + u.search + u.hash).catch(() => { /* fenêtre déjà fermée */ });
      }
    })());
    return;
  }
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
/* Réseau d'abord (l'app se met à jour toute seule), cache en secours hors
   ligne. `ignoreVary` : le serveur répond « Vary: Origin », et un morceau
   chargé à la demande (journal, espace professeur, partie en direct) est
   demandé comme module, avec un en-tête Origin que la copie faite à
   l'installation n'avait pas — le cache la refusait, rendait index.html à
   la place, et le morceau ne s'ouvrait jamais hors ligne.
   Chaque écran de l'app a son adresse (src/routes.js) et toutes servent la
   même page, app.html : une navigation de l'app se range sous « app »,
   jamais sous son adresse — sinon chaque livre, chaque classe ouverte
   laisserait sa copie, et une adresse jamais visitée ne s'ouvrirait pas
   hors ligne. La racine est la page d'accueil du site (index.html) : elle
   garde sa copie à elle, « / ». Seule une réponse saine remplace une page
   gardée ; hors ligne, une navigation sans copie retombe sur l'app, et une
   autre requête échoue franchement au lieu de recevoir une page HTML à la
   place d'un script. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (ANCIEN || req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === 'navigate';
  const cle = !page ? req : new URL(req.url).pathname === BASE ? BASE : BASE + 'app';
  e.respondWith(
    fetch(req)
      .then(r => {
        if (!page || r.ok) { const c = r.clone(); caches.open(C).then(x => x.put(cle, c)); }
        return r;
      })
      .catch(async () => (await caches.match(cle, { ignoreVary: true }))
        || (page && await caches.match(BASE + 'app', { ignoreVary: true }))
        || Response.error())
  );
});
