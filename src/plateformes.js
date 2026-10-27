/* ══════════ Folio sur chaque appareil (2026-10-27) ══════════
   Module pur, sans dépendance, testé (test/abonnement.test.js) : lu par
   l'écran Folio+ (vendre, gérer, « Folio partout ») et par l'écran qui
   envoie un téléphone vers son magasin (ui/magasin.js).

   Décidé le 2026-10-27 : sur un téléphone ou une tablette, Folio est l'app
   des magasins (Capacitor, docs/CAPACITOR.md), jamais le site — ni la
   version web, ni l'app installée depuis le navigateur. Sur un ordinateur,
   la version web, installable en un clic (Chrome, Edge ; Safari l'ajoute
   au Dock) ; sur un Mac à puce Apple, l'app de l'iPad aussi, par le Mac App
   Store, avec le même abonnement. Les fiches des magasins se renseignent
   ici, dans MAGASINS, le jour où elles existent : les boutons apparaissent
   seuls, et un téléphone connecté dans son navigateur est alors envoyé vers
   la sienne (docs/VENTE.md). */

export const MAGASINS = { ios: '', android: '', windows: '', mac: '' };

export const NOMS = { ios: 'App Store', android: 'Google Play', windows: 'Microsoft Store', mac: 'Mac App Store' };
export const APPAREILS = { ios: 'iPhone et iPad', android: 'Android', mac: 'Mac', windows: 'Windows' };

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

/* Par où passe Folio+ : dans l'app des magasins, l'achat intégré d'Apple ou
   de Google (leurs règles : 3.1.1 de l'App Store, paiements de Google Play),
   par RevenueCat ; partout ailleurs, Stripe. Jamais de lien vers l'un dans
   l'app de l'autre. */
export const vente = p => (p.natif ? 'magasin' : 'stripe');

/* Un téléphone ou une tablette dans un navigateur, une fois l'app de son
   magasin publiée : on l'y envoie (ui/magasin.js), plus de version web. */
export const versLeMagasin = (p, magasins = MAGASINS) => mobile(p) && !p.natif && !!magasins[p.os];

/* Le geste pour avoir Folio sur CET appareil : la fiche du magasin si l'app
   y est ; sur un ordinateur, l'installation par le navigateur ; sur un
   téléphone sans app publiée, rien encore. */
export function installer(p, magasins = MAGASINS) {
  if (p.natif) return { type: 'deja' };
  const lien = magasins[p.os];
  if (lien) return { type: 'magasin', os: p.os, lien, nom: NOMS[p.os] };
  return mobile(p) ? { type: 'bientot', os: p.os, nom: NOMS[p.os] } : { type: 'navigateur', os: p.os };
}

/* Comment installer depuis le navigateur, sur un ordinateur ; un téléphone
   attend son magasin. */
export const GESTES = {
  ios: 'Bientôt sur l’App Store',
  android: 'Bientôt sur Google Play',
  mac: 'Dans Chrome ou Edge : l’icône d’installation de la barre d’adresse. Dans Safari : Fichier, puis « Ajouter au Dock »',
  windows: 'Dans Edge ou Chrome : l’icône d’installation de la barre d’adresse',
  chromeos: 'Dans Chrome : l’icône d’installation de la barre d’adresse',
  linux: 'Dans Chrome ou Edge : l’icône d’installation de la barre d’adresse',
  autre: 'Depuis le menu de ton navigateur : « Installer l’application »'
};

/* Les quatre familles d'appareils, dans l'ordre où on les montre : celui
   qu'on tient d'abord. Chacune avec son magasin s'il existe. */
export function partout(p, magasins = MAGASINS) {
  const ordre = ['ios', 'android', 'mac', 'windows'];
  const premier = ordre.includes(p.os) ? [p.os] : [];
  return [...premier, ...ordre.filter(o => o !== p.os)].map(os => ({
    os, appareil: APPAREILS[os], lien: magasins[os] || '', magasin: magasins[os] ? NOMS[os] : '', geste: GESTES[os], ici: os === p.os
  }));
}
