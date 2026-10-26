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
   la place, et le morceau ne s'ouvrait jamais hors ligne.
   Sans copie, une navigation retombe sur l'app (servie à « app » depuis
   que la racine est la page d'accueil du site : une adresse avec ses
   paramètres, « /app?go=study » ou « /?rejoindre=… », n'a pas de copie à
   elle) ; une autre requête échoue franchement, au lieu de recevoir une
   page HTML à la place d'un script. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(r => { const c = r.clone(); caches.open(C).then(x => x.put(req, c)); return r; })
      .catch(async () => (await caches.match(req, { ignoreVary: true }))
        || (req.mode === 'navigate' && await caches.match(BASE + 'app', { ignoreVary: true }))
        || Response.error())
  );
});
