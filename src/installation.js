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
   l'animation qu'elle accompagne : 1 la barre du navigateur, 2 son menu,
   3 l'écran d'accueil). */

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

const E = (ic, texte, s) => ({ ic, texte, s });
const AJOUTER = E('ajouter', 'Fais défiler, choisis **Sur l’écran d’accueil**', 2);
const CONFIRMER = E('ok', 'Touche **Ajouter**', 2);

/* La dernière étape : ouvrir Mirandola par son icône. Sur iPhone, l'app de
   l'écran d'accueil n'a pas le stockage de Safari : on s'y connecte. Sur
   Android elle partage celui du navigateur : une session ouverte suit. */
const ouvrir = (ios, session) => E('folio', session && !ios ? 'Ouvre **Mirandola** sur ton écran d’accueil : ton compte t’y attend'
  : 'Ouvre **Mirandola** sur ton écran d’accueil et connecte-toi', 3);

/* Ce que la porte montre : `cas`, `titre`, les `etapes`, la `fleche`
   (bas, bas-droite, haut-droite ou rien : là où se trouve le bouton du
   navigateur), le `bouton` principal (installer : l'invite du navigateur ;
   chrome : ouvrir dans Chrome ; copier : copier le lien), le `secours`
   (ce qu'on propose à qui ne trouve pas) et `ligne`, le mot du menu que
   l'animation allume. Sur iOS, le secours est toujours Safari : un lien
   ouvert depuis Gmail ou une autre app s'affiche dans un Safari réduit,
   sans « Sur l'écran d'accueil », et sa signature est celle de Safari.
   `invite` : le navigateur a proposé d'installer en un geste
   (beforeinstallprompt : Chrome, Edge, Samsung Internet). */
export function guide(os, n, { invite = false, session = false } = {}) {
  if (n.nom === 'integre') return sortir(os === 'ios');
  return os === 'ios' ? guideIos(n, session) : guideAndroid(n, invite, session);
}

function sortir(ios) {
  const nav = ios ? 'Safari' : 'Chrome';
  return {
    cas: 'integre', titre: `Continue dans ${nav}`, fleche: 'haut-droite', ligne: `Ouvrir dans ${nav}`,
    bouton: ios ? 'copier' : 'chrome', secours: ios ? null : 'copier',
    etapes: [E('points', 'Touche **•••**, en haut à droite', 1),
      E('sortir', `Choisis **Ouvrir dans ${nav}** ou **dans le navigateur**`, 2),
      E('folio', 'Mirandola t’y montrera la suite', 3)]
  };
}

// le bouton Partager de chaque navigateur d'iOS, et où il est ; la suite est la même partout
function guideIos(n, session) {
  const [cas, fleche, premiere] = n.nom === 'safari'
    ? (n.tablette ? ['ipad', 'haut-droite', E('partager', 'Touche **Partager**, en haut à droite', 1)]
      : n.version >= 26 ? ['ios26', 'bas-droite', E('points', 'Touche **•••** en bas à droite, puis **Partager**', 1)]
        : ['ios', 'bas', E('partager', 'Touche **Partager**, en bas de l’écran', 1)])
    : n.nom === 'chrome' ? ['ios-chrome', 'haut-droite', E('partager', 'Touche **Partager**, dans la barre d’adresse', 1)]
      : n.nom === 'firefox' ? ['ios-firefox', 'bas-droite', E('menu3', 'Touche **≡** en bas à droite, puis **Partager**', 1)]
        : ['ios-autre', null, E('partager', 'Dans le menu de ton navigateur, touche **Partager**', 1)];
  return { cas, titre: 'Installe Mirandola', fleche, ligne: 'Sur l’écran d’accueil', bouton: null, secours: 'safari',
    etapes: [premiere, AJOUTER, CONFIRMER, ouvrir(true, session)] };
}

// Android : l'invite du navigateur installe en un geste ; sinon, son menu, dans ses mots
const ANDROID = {
  samsung: ['bas-droite', 'Écran d’accueil', [E('menu3', 'Touche **≡**, en bas à droite', 1),
    E('ajouter', 'Choisis **Ajouter la page à**, puis **Écran d’accueil**', 2)]],
  edge: ['bas', 'Ajouter au téléphone', [E('points', 'Touche **•••**, en bas de l’écran', 1),
    E('ajouter', 'Choisis **Ajouter au téléphone**', 2)]],
  firefox: [null, 'Ajouter à l’écran d’accueil', [E('menu', 'Touche le menu **⋮**', 1),
    E('ajouter', 'Choisis **Ajouter à l’écran d’accueil**', 2), E('ok', 'Confirme : **Ajouter**', 2)]],
  chrome: ['haut-droite', 'Installer l’application', [E('menu', 'Touche **⋮**, en haut à droite', 1),
    E('ajouter', 'Choisis **Installer l’application**', 2), E('ok', 'Confirme : **Installer**', 2)]],
  autre: [null, 'Installer l’application', [E('menu', 'Ouvre le menu de ton navigateur', 1),
    E('ajouter', 'Choisis **Installer l’application** ou **Ajouter à l’écran d’accueil**', 2)]]
};
function guideAndroid(n, invite, session) {
  const fin = ouvrir(false, session);
  if (invite) return { cas: 'invite', titre: 'Installe Mirandola', fleche: null, ligne: 'Installer', bouton: 'installer', secours: null,
    etapes: [E('installer', 'Touche **Installer Mirandola**', 1), E('ok', 'Confirme : **Installer**', 2), fin] };
  const cle = ANDROID[n.nom] ? n.nom : 'autre';
  const [fleche, ligne, etapes] = ANDROID[cle];
  return { cas: { chrome: 'android', autre: 'android-autre' }[cle] || cle, titre: 'Installe Mirandola', fleche, ligne, bouton: null,
    secours: cle === 'autre' ? 'chrome' : null, etapes: [...etapes, fin] };
}

/* Le texte d'une étape, ses mots d'écran en gras : `esc` échappe d'abord
   (le texte vient d'ici, mais la règle ne dépend pas de qui l'écrit). */
export const enGras = (texte, esc = t => t) => esc(texte).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
