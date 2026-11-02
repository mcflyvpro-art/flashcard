/* ══════════ poser Mirandola sur l'écran d'accueil d'un téléphone (2026-10-28) ══════════
   Module pur, sans dépendance, testé (test/installation.test.js) : lu par
   la porte d'installation (ui/pwa.js, chargée à la demande), jamais au
   démarrage.

   Sur un téléphone, Mirandola ne s'ouvre que depuis son icône (src/plateformes.js,
   `porte`). Le geste qui la pose n'est pas le même partout, et c'est là que
   tout se perd : l'élève cherche « Sur l'écran d'accueil » dans le mauvais
   menu, ne trouve pas, abandonne. Chaque navigateur a donc ses étapes, dans
   ses mots à lui, et l'endroit de l'écran où se trouve le bouton à toucher
   (`fleche`) — une flèche s'y pose, l'animation le rejoue.

   Le cas qui bloque vraiment n'est pas iOS : c'est le navigateur enfermé
   dans une autre app (Instagram, TikTok, Snapchat, l'app d'un ENT). Rien
   ne s'y installe ; on dit comment en sortir.

   Une étape : `ic` (ce qu'on touche, dessiné à l'écran), `texte` (les mots
   entre ** sont ceux de l'écran du téléphone, en gras), `s` (la scène de
   l'animation qui la rejoue, une par étape). */

const APPS = /FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|musical_ly|Bytedance|Line\/|LinkedInApp|Twitter|Pinterest|GSA\/|Discord|MicroMessenger/;

/* Le navigateur, d'après sa signature. Sur iOS, Safari 26 (et la suite)
   garde « iPhone OS 18_6 » dans sa signature : seule `Version/26` dit la
   vraie. */
export function navigateur(ua = '') {
  const ios = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const android = /Android/.test(ua);
  const v = ua.match(/Version\/(\d+)/);
  const integre = APPS.test(ua) || (android && /; wv\)/.test(ua)) || (ios && !/Safari\//.test(ua));
  return {
    nom: integre ? 'integre' : ios ? NAV_IOS(ua) : NAV_ANDROID(ua),
    version: v ? Number(v[1]) : 0,
    tablette: /iPad|Macintosh/.test(ua) || (android && !/Mobile/.test(ua))
  };
}

// le premier qui se reconnaît : chaque navigateur se dit aussi « Safari », et sur Android « Chrome »
const premier = (liste, ua, sinon) => (liste.find(([, re]) => re.test(ua)) || [sinon])[0];
const NAV_IOS = ua => premier([['chrome', /CriOS/], ['firefox', /FxiOS/], ['edge', /EdgiOS/],
  ['autre', /OPiOS|OPT\/|DuckDuckGo|Ddg\//]], ua, 'safari');
const NAV_ANDROID = ua => premier([['samsung', /SamsungBrowser/], ['edge', /EdgA\//], ['opera', /OPR\//], ['firefox', /Firefox\//],
  ['autre', /MiuiBrowser|HuaweiBrowser|HeyTap|YaBrowser|UCBrowser/], ['chrome', /Chrome\//]], ua, 'autre');

/* Ouvrir l'adresse dans Chrome depuis le navigateur d'une autre app
   (Android) : un lien `intent:` que ces navigateurs passent au système.
   Sans Chrome, on reste où l'on est. */
export function lienChrome(url) {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};`
    + `package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

/* Les mots de l'écran du téléphone, dans SA langue (2026-11-02) : un
   iPhone réglé en anglais dit « Add to Home Screen », pas « Sur l'écran
   d'accueil » — l'élève cherchait un mot qui n'était pas là. La phrase reste
   en français, les mots en gras sont ceux qu'il voit. Une autre langue :
   l'anglais, le plus souvent reconnu. Libellés relevés sur iOS 26 (feuille
   de partage : « En voir plus » / « View More »), Chrome et Samsung Internet. */
export const MOTS = {
  fr: { partager: 'Partager', plus: 'En voir plus', accueil: 'Sur l’écran d’accueil', ajouter: 'Ajouter', annuler: 'Annuler',
    webapp: 'Ouvrir comme app web', copier: 'Copier', installerApp: 'Installer l’application', installer: 'Installer',
    ajouterAccueil: 'Ajouter à l’écran d’accueil', pageA: 'Ajouter la page à', ecranAccueil: 'Écran d’accueil',
    telephone: 'Ajouter au téléphone', ouvrirDans: n => `Ouvrir dans ${n}`, navigateur: 'dans le navigateur' },
  en: { partager: 'Share', plus: 'View More', accueil: 'Add to Home Screen', ajouter: 'Add', annuler: 'Cancel',
    webapp: 'Open as Web App', copier: 'Copy', installerApp: 'Install app', installer: 'Install',
    ajouterAccueil: 'Add to Home screen', pageA: 'Add page to', ecranAccueil: 'Home screen',
    telephone: 'Add to phone', ouvrirDans: n => `Open in ${n}`, navigateur: 'in browser' }
};
export const langueEcran = (langues = []) => (String(langues[0] || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en');

/* Une étape : `ic` ce qu'on touche, `texte` (les mots de l'écran entre **),
   `s` la scène qui la rejoue (ui/pwa.js) : `barre` le navigateur et son
   bouton, `menu` son menu, `feuille` la feuille de partage d'iOS, `liste`
   ses actions, `ajout` l'écran qui confirme, `accueil` l'écran d'accueil,
   `page` le bouton de la page, `nav` le navigateur où l'on passe. */
const E = (ic, texte, s) => ({ ic, texte, s });

/* La dernière étape : ouvrir Mirandola par son icône. Sur iPhone, l'app de
   l'écran d'accueil n'a pas le stockage de Safari : on s'y connecte. Sur
   Android elle partage celui du navigateur : une session ouverte suit. */
const ouvrir = (ios, session) => E('folio', session && !ios ? 'Ouvre **Mirandola** par son icône : ton compte t’y attend'
  : 'Ouvre **Mirandola** par son icône et connecte-toi', 'accueil');

/* Ce que la porte montre : `cas`, `titre`, les `etapes`, la `fleche`
   (bas, bas-droite, haut-droite ou rien : là où se trouve le bouton du
   navigateur), le `bouton` principal (installer : l'invite du navigateur ;
   chrome : ouvrir dans Chrome ; copier : copier le lien), le `secours`
   (ce qu'on propose à qui ne trouve pas), `ligne` (le mot du menu que
   l'animation allume), `mots` (les libellés de l'écran, pour l'animation)
   et `ios26`. Sur iOS, le secours est toujours Safari : un lien ouvert
   depuis Gmail ou une autre app s'affiche dans un Safari réduit, sans
   « Sur l'écran d'accueil », et sa signature est celle de Safari.
   `invite` : le navigateur a proposé d'installer en un geste
   (beforeinstallprompt : Chrome, Edge, Samsung Internet). `ios26` : la
   feuille de partage d'iOS 26 range ses actions derrière « En voir plus »
   (vu sur l'iPhone de l'utilisateur, Chrome, le 2026-11-02) ; Safari le dit
   par `Version/26`, les autres navigateurs d'iOS non (leur signature reste
   « iPhone OS 18_6 ») : l'écran le devine à ce que son moteur sait faire. */
export function guide(os, n, { invite = false, session = false, langue = 'fr', ios26 = false } = {}) {
  const m = MOTS[langue] || MOTS.fr;
  const r = n.nom === 'integre' ? sortir(os === 'ios', m)
    : os === 'ios' ? guideIos(n, session, m, ios26 || (n.nom === 'safari' && n.version >= 26)) : guideAndroid(n, invite, session, m);
  return { ...r, mots: m };
}

function sortir(ios, m) {
  const nav = ios ? 'Safari' : 'Chrome';
  return {
    cas: 'integre', titre: `Continue dans ${nav}`, fleche: 'haut-droite', ligne: m.ouvrirDans(nav), ios26: false,
    bouton: ios ? 'copier' : 'chrome', secours: ios ? null : 'copier',
    etapes: [E('points', 'Touche **•••**, en haut à droite', 'barre'),
      E('sortir', `Choisis **${m.ouvrirDans(nav)}** ou **${m.navigateur}**`, 'menu'),
      E('folio', 'Mirandola t’y montrera la suite', 'nav')]
  };
}

// le bouton Partager de chaque navigateur d'iOS, et où il est ; la suite est la même partout
function guideIos(n, session, m, ios26) {
  const P = `**${m.partager}**`;
  const [cas, fleche, premiere] = n.nom === 'safari'
    ? (n.tablette ? ['ipad', 'haut-droite', E('partager', `Touche ${P}, en haut à droite`, 'barre')]
      : n.version >= 26 ? ['ios26', 'bas-droite', E('points', `Touche **•••** en bas à droite, puis ${P}`, 'barre')]
        : ['ios', 'bas', E('partager', `Touche ${P}, en bas de l’écran`, 'barre')])
    : n.nom === 'chrome' ? ['ios-chrome', 'haut-droite', E('partager', `Touche ${P}, en haut à droite`, 'barre')]
      : n.nom === 'firefox' ? ['ios-firefox', 'bas-droite', E('menu3', `Touche **≡** en bas à droite, puis ${P}`, 'barre')]
        : ['ios-autre', null, E('partager', `Dans le menu de ton navigateur, touche ${P}`, 'barre')];
  const etapes = ios26
    ? [premiere, E('plus', `Touche **${m.plus}**, au bout de la rangée`, 'feuille'),
      E('ajouter', `Touche **${m.accueil}**`, 'liste')]
    : [premiere, E('ajouter', `Fais défiler, choisis **${m.accueil}**`, 'liste')];
  return { cas, titre: 'Installe Mirandola', fleche, ligne: m.accueil, bouton: null, secours: 'safari', ios26,
    etapes: [...etapes, E('ok', `Touche **${m.ajouter}**, en haut à droite`, 'ajout'), ouvrir(true, session)] };
}

// Android : l'invite du navigateur installe en un geste ; sinon, son menu, dans ses mots
const ANDROID = {
  samsung: m => ['bas-droite', m.pageA, [E('menu3', 'Touche **≡**, en bas à droite', 'barre'),
    E('ajouter', `Choisis **${m.pageA}**, puis **${m.ecranAccueil}**`, 'menu')]],
  edge: m => ['bas', m.telephone, [E('points', 'Touche **•••**, en bas de l’écran', 'barre'),
    E('ajouter', `Choisis **${m.telephone}**`, 'menu')]],
  firefox: m => [null, m.ajouterAccueil, [E('menu', 'Touche le menu **⋮**', 'barre'),
    E('ajouter', `Choisis **${m.ajouterAccueil}**`, 'menu'), E('ok', `Confirme : **${m.ajouter}**`, 'ajout')]],
  chrome: m => ['haut-droite', m.installerApp, [E('menu', 'Touche **⋮**, en haut à droite', 'barre'),
    E('ajouter', `Choisis **${m.installerApp}**`, 'menu'), E('ok', `Confirme : **${m.installer}**`, 'ajout')]],
  autre: m => [null, m.installerApp, [E('menu', 'Ouvre le menu de ton navigateur', 'barre'),
    E('ajouter', `Choisis **${m.installerApp}** ou **${m.ajouterAccueil}**`, 'menu')]]
};
function guideAndroid(n, invite, session, m) {
  const fin = ouvrir(false, session);
  if (invite) return { cas: 'invite', titre: 'Installe Mirandola', fleche: null, ligne: m.installer, bouton: 'installer', secours: null, ios26: false,
    etapes: [E('installer', 'Touche **Installer Mirandola**', 'page'), E('ok', `Confirme : **${m.installer}**`, 'ajout'), fin] };
  const cle = ANDROID[n.nom] ? n.nom : 'autre';
  const [fleche, ligne, etapes] = ANDROID[cle](m);
  return { cas: { chrome: 'android', autre: 'android-autre' }[cle] || cle, titre: 'Installe Mirandola', fleche, ligne, bouton: null,
    secours: cle === 'autre' ? 'chrome' : null, ios26: false, etapes: [...etapes, fin] };
}

/* Le texte d'une étape, ses mots d'écran en gras : `esc` échappe d'abord
   (le texte vient d'ici, mais la règle ne dépend pas de qui l'écrit). */
export const enGras = (texte, esc = t => t) => esc(texte).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
