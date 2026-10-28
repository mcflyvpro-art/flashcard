/* ══════════ Mirandola sur chaque appareil (2026-10-27, 2026-10-28) ══════════
   Module pur, sans dépendance, testé (test/abonnement.test.js) : lu par
   l'écran Mirandola+ (vendre, gérer, l'installer ailleurs) et par la porte
   d'installation (ui/pwa-porte.js).

   Décidé le 2026-10-28 (et non plus « l'app des magasins », décidé la
   veille) : sur un téléphone ou une tablette, Mirandola est l'app posée sur
   l'écran d'accueil depuis le navigateur — sans magasin, sans attendre une
   validation, le même code partout. Tant qu'elle n'y est pas, l'app ne
   s'ouvre pas : la porte d'installation montre le geste, et l'on se
   connecte dans l'app installée. Sur un ordinateur, la version web,
   installable en un clic (Chrome, Edge ; Safari l'ajoute au Dock).

   Les magasins restent possibles (Capacitor, docs/CAPACITOR.md) : une
   fiche renseignée dans MAGASINS, et la porte mène à elle au lieu de
   l'écran d'accueil. */

export const MAGASINS = { ios: '', android: '', windows: '', mac: '' };

export const NOMS = { ios: 'App Store', android: 'Google Play', windows: 'Microsoft Store', mac: 'Mac App Store' };

/* L'appareil, d'après le navigateur. `capacitor` : la plateforme que
   rapporte Capacitor (« ios », « android ») quand l'app tourne dans son
   enveloppe native. Un iPad récent se dit « Macintosh » : ses points de
   contact le trahissent. */
export function plateforme({ ua = '', touches = 0, capacitor = null } = {}) {
  if (capacitor === 'ios' || capacitor === 'android') return { os: capacitor, natif: true };
  const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touches > 1) ? 'ios'
    : /Android/.test(ua) ? 'android'
      : /Windows/.test(ua) ? 'windows'
        : /Macintosh|Mac OS X/.test(ua) ? 'mac'
          : /CrOS/.test(ua) ? 'chromeos'
            : /Linux/.test(ua) ? 'linux' : 'autre';
  return { os, natif: false };
}

export const mobile = p => p.os === 'ios' || p.os === 'android';

/* Par où passe Mirandola+ : dans l'app des magasins, l'achat intégré d'Apple ou
   de Google (leurs règles : 3.1.1 de l'App Store, paiements de Google Play),
   par RevenueCat ; partout ailleurs, Stripe. Jamais de lien vers l'un dans
   l'app de l'autre. */
export const vente = p => (p.natif ? 'magasin' : 'stripe');

/* Ce qui reste ouvert dans un navigateur de téléphone : ce qui se lit ou
   s'essaie sans compte (la démo, les textes du cadre, la demande de démo
   d'un établissement). Tout le reste passe par l'app installée. */
export const SANS_PORTE = /^\/(essayer|demande-demo)(\/|$)|^\/(demo|mentions)\//;

/* La porte d'installation : un téléphone ou une tablette dans son
   navigateur n'entre pas dans l'app. `installee` : l'app tourne depuis son
   icône (display-mode standalone, navigator.standalone). */
export const porte = (p, { installee = false, chemin = '/' } = {}) =>
  mobile(p) && !p.natif && !installee && !SANS_PORTE.test(chemin);

/* Le geste pour avoir Mirandola sur CET appareil : la fiche du magasin si l'app
   y est ; un téléphone, l'écran d'accueil ; un ordinateur, l'installation
   par le navigateur. */
export function installer(p, magasins = MAGASINS) {
  if (p.natif) return { type: 'deja' };
  const lien = magasins[p.os];
  if (lien) return { type: 'magasin', os: p.os, lien, nom: NOMS[p.os] };
  return { type: mobile(p) ? 'ecran' : 'navigateur', os: p.os };
}
