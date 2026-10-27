/* ══════════ Folio sur chaque appareil (2026-10-27) ══════════
   Module pur, sans dépendance, testé (test/plateformes.test.js) : lu par
   l'écran Folio+ de l'app (après le paiement, « Folio partout ») et par la
   page d'accueil (section « Télécharger »).

   Une seule app, partout : sur un téléphone, l'app des magasins quand elle
   y sera (Capacitor, docs/CAPACITOR.md), sinon la même installée depuis le
   navigateur ; sur un ordinateur, l'app installée depuis le navigateur
   (Chrome et Edge l'installent en un clic, Safari l'ajoute au Dock) ou,
   plus tard, le Microsoft Store et le Mac App Store. Les fiches des
   magasins se renseignent ici, dans MAGASINS, le jour où elles existent :
   les boutons apparaissent seuls (docs/VENTE.md). */

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

/* Dans une app des magasins, on ne vend pas : Apple et Google y imposent
   leur propre paiement (règles 3.1.1 et 3.1.3 de l'App Store, paiements de
   Google Play). L'abonnement pris sur le site s'y ouvre, sans plus. */
export const peutVendre = p => !p.natif;

/* Le geste pour avoir Folio sur CET appareil : la fiche du magasin si l'app
   y est, sinon l'installation par le navigateur. */
export function installer(p, magasins = MAGASINS) {
  if (p.natif) return { type: 'deja' };
  const lien = magasins[p.os];
  if (lien) return { type: 'magasin', os: p.os, lien, nom: NOMS[p.os] };
  return { type: 'navigateur', os: p.os };
}

/* Comment installer depuis le navigateur, appareil par appareil. */
export const GESTES = {
  ios: 'Dans Safari : Partager, puis « Sur l’écran d’accueil »',
  android: 'Dans Chrome : le menu ⋮, puis « Installer l’application »',
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
