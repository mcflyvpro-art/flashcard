/* Remplace le service worker de l'ancienne app publiée sur GitHub Pages.
   Un téléphone qui l'avait gardée en cache la rouvrirait hors du réseau
   indéfiniment : celui-ci vide les caches et se désinscrit. Il ne recharge
   pas la page ouverte — l'ancienne app finit d'envoyer ce qu'elle avait en
   attente ; c'est au lancement suivant que la redirection prend le relais. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
})()));
