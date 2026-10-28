// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { auth, bip, setBip } from '../data/etat.js';
import { installer, plateforme } from '../plateformes.js';
import { enGras, guide, lienChrome, navigateur } from '../installation.js';
import { esc } from '../core/coeur-sync.js';
import { render } from './bibliotheque.js';
import { LEGAL_TITRES, pubTete } from './connexion.js';
import { toast } from './import-cartes.js';
import { rangerLiens } from './liens-entrants.js';
import { cartePassage, confierPassage, lierPassage } from './passage.js';
import { aInstaller } from './pwa-porte.js';
import './pwa.css';

/* ══════════ la porte d'installation : l'écran (2026-10-28) ══════════
   Chargé à la demande par ui/pwa-porte.js (préfixe pw-), seulement dans le
   navigateur d'un téléphone. Une seule chose à faire, montrée trois fois :
   les étapes dans les mots du navigateur (src/installation.js), un
   téléphone dessiné qui les rejoue en boucle — la barre du navigateur et
   son bouton, le menu et sa ligne, l'écran d'accueil où Folio apparaît —,
   et une flèche posée au bord de l'écran, vers le vrai bouton. Les étapes
   s'allument au rythme de l'animation.

   Sur Android, Chrome, Edge et Samsung Internet proposent d'installer en
   un geste (beforeinstallprompt, rangé par ui/onboarding.js) : un seul
   bouton, puis le système demande de confirmer. Une fois installée
   (appinstalled), ou déjà là (getInstalledRelatedApps, que le manifeste
   rend possible par related_applications), l'écran le dit et montre où
   l'ouvrir. */

const ua = navigator.userAgent || '';
const ici = plateforme({ ua, touches: navigator.maxTouchPoints || 0, capacitor: null });
const nav = navigateur(ua);
const DEBUT = performance.now();
// ces navigateurs proposent d'installer en un geste, d'ordinaire dans la seconde
const INVITE = ici.os === 'android' && ['chrome', 'edge', 'samsung', 'opera'].includes(nav.nom);
const PATIENCE = 2000;

let etat = 'guide';          // 'installe' : vient d'être installée ; 'deja' : déjà sur ce téléphone
let range = false;

const repeindre = () => { if (aInstaller()) render(); };

window.addEventListener('beforeinstallprompt', repeindre);     // ui/onboarding.js vient de la ranger dans `bip`
window.addEventListener('appinstalled', () => { etat = 'installe'; repeindre(); });
if (navigator.getInstalledRelatedApps) {
  navigator.getInstalledRelatedApps()
    .then(l => { if (l && l.length && etat === 'guide') { etat = 'deja'; repeindre(); } })
    .catch(() => { /* le navigateur refuse de le dire : le guide reste, il marche aussi pour qui l'a déjà */ });
}
if (INVITE && !bip) setTimeout(repeindre, PATIENCE);

/* ---------- ce qu'on touche, dessiné ---------- */
const CARRE_PLUS = '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8.6v6.8M8.6 12h6.8"/>';
const GLYPHES = {
  partager: () => svg(I.share),
  points: () => '<span class="pw-txt">•••</span>',
  menu: () => '<span class="pw-txt">⋮</span>',
  menu3: () => '<span class="pw-txt">≡</span>',
  ajouter: () => svg(CARRE_PLUS),
  ok: () => svg(I.check),
  installer: () => svg(I.down),
  sortir: () => svg(I.globe),
  folio: () => '<img src="/site/icone.svg" alt="" width="20" height="20">'
};
// le bouton du navigateur, dessiné dans sa barre : celui de la première étape
const touche = g => (GLYPHES[g.etapes[0].ic] || GLYPHES.partager)();

/* ---------- le téléphone qui rejoue le geste ----------
   Trois scènes en boucle (pw.css) : 1 la page dans le navigateur et le
   bouton qu'on touche, 2 le menu et sa ligne, 3 l'écran d'accueil où
   Folio arrive — ou, pour sortir d'une autre app, le navigateur. Le doigt
   va de l'un à l'autre ; `data-fleche` dit où est le bouton. */
function scene(g) {
  const b = touche(g);
  const fin = g.cas === 'integre'
    ? `<div class="pw-nav">${svg(I.globe)}<b>${g.titre.replace('Ouvre Folio dans ', '')}</b></div>`
    : `<div class="pw-grille">${'<i></i>'.repeat(7)}<span class="pw-app"><img src="/site/icone.svg" alt=""><small>Folio</small></span><i></i></div>`;
  const page = g.cas === 'invite'
    ? '<span class="pw-pbouton">Installer Folio</span>' : '<b></b><b></b><b class="court"></b>';
  return `<div class="pw-scene" data-fleche="${g.cas === 'invite' ? 'invite' : g.fleche || 'bas'}" aria-hidden="true">
      <div class="pw-tel"><div class="pw-ecran">
        <div class="pw-s pw-s1">
          <div class="pw-haut"><span class="pw-url">folioflashcard.online</span><i class="pw-b">${b}</i></div>
          <div class="pw-page"><img src="/site/logo.svg" alt="">${page}</div>
          <div class="pw-bas"><i></i><i></i><i class="pw-b pw-bc">${b}</i><i></i><i class="pw-b pw-bd">${b}</i></div>
        </div>
        <div class="pw-s pw-s2"><div class="pw-feuille"><span></span><span></span>
          <span class="on">${svg(g.cas === 'integre' ? I.globe : CARRE_PLUS)}${esc(g.ligne)}</span><span></span></div></div>
        <div class="pw-s pw-s3">${fin}</div>
      </div></div>
    </div>`;
}

// chaque étape commence par ce qu'on touche, dessiné ; l'ordre se lit de haut en bas, et s'allume avec l'animation
const etapesHtml = g => `<ol class="pw-etapes">${g.etapes.map(e => `<li data-s="${e.s}">
      <i class="pw-g" aria-hidden="true">${GLYPHES[e.ic] ? GLYPHES[e.ic]() : ''}</i><span>${enGras(e.texte, esc)}</span></li>`).join('')}</ol>`;

/* ---------- les boutons ---------- */
const adresse = () => new URL(location.pathname + location.search, SITE).href;
const versChrome = (t = 'Ouvrir dans Chrome') => `<a class="cta pw-cta" href="${esc(lienChrome(adresse()))}">${svg(I.out)}${t}</a>`;
const copier = (cls = 'cta pw-cta') => `<button class="${cls}" type="button" data-pw="copier">${svg(I.copy)}Copier le lien</button>`;

function bouton(g, attente) {
  if (g.bouton === 'installer') {
    return `<button class="cta pw-cta" type="button" data-pw="installer" ${attente ? 'disabled' : ''}>${svg(I.down)}Installer Folio</button>`;
  }
  if (g.bouton === 'chrome') return versChrome();
  if (g.bouton === 'copier') return copier();
  return '';
}

function secours(g) {
  if (!g.secours) return '';
  const corps = g.secours === 'safari' ? `<p>Copie le lien et colle-le dans Safari : c’est lui qui installe le mieux.</p>${copier('pw-lien')}`
    : g.secours === 'chrome' ? `<p>Ouvre Folio dans Chrome : il l’installe en un geste.</p>${versChrome()}`
      : `<p>Copie le lien et colle-le dans Chrome.</p>${copier('pw-lien')}`;
  return `<details class="pw-secours"><summary>Tu ne trouves pas&#8239;?</summary>${corps}</details>`;
}

/* ---------- les états ---------- */
function guideHtml(passe) {
  const attente = INVITE && !bip && performance.now() - DEBUT < PATIENCE;
  const g = guide(ici.os, nav, { invite: !!bip || attente, session: !!auth });
  const sous = g.cas === 'integre' ? 'Ici, rien ne s’installe.' : 'Folio s’ouvre depuis ton écran d’accueil.';
  return {
    cle: g.cas + (attente ? '…' : ''), fleche: g.cas === 'invite' ? null : g.fleche,
    html: `<h1 class="lt">${esc(g.titre)}</h1><p class="lsub">${sous}</p>
      <div class="pw-duo">${scene(g)}${etapesHtml(g)}</div>${bouton(g, attente)}${passe}${secours(g)}`
  };
}

function installeHtml(passe) {
  const android = ici.os === 'android';
  return {
    cle: etat, fleche: null,
    html: `<i class="pw-ok">${svg(I.check)}</i>
      <h1 class="lt">${etat === 'deja' ? 'Folio est déjà là' : 'C’est installé'}</h1>
      <p class="lsub">Ouvre Folio depuis ton écran d’accueil${auth && android ? ' : ton compte t’y attend' : ', puis connecte-toi'}.</p>
      <div class="pw-scene pw-fige" aria-hidden="true"><div class="pw-tel"><div class="pw-ecran"><div class="pw-s pw-s3">
        <div class="pw-grille">${'<i></i>'.repeat(7)}<span class="pw-app"><img src="/site/icone.svg" alt=""><small>Folio</small></span><i></i></div>
      </div></div></div></div>
      ${passe}`
  };
}

// l'app des magasins, le jour où elle y est (src/plateformes.js, MAGASINS)
function magasinHtml(i, passe) {
  return {
    cle: 'magasin', fleche: null,
    html: `<h1 class="lt">Folio est une app</h1><p class="lsub">Télécharge-la, connecte-toi : tout t’y attend.</p>
      ${passe}<a class="cta pw-cta" href="${esc(i.lien)}" rel="noopener">${svg(I.down)}Télécharger sur ${esc(i.nom)}</a>`
  };
}

const FLECHE = '<svg viewBox="0 0 24 24"><path d="M12 3.5v15M5.5 12.5 12 19l6.5-6.5"/></svg>';

export function pwaEcran() {
  /* Les codes de l'adresse (une classe, une partie, un club, Folio+)
     attendent l'app installée : rangés, confiés à son stockage (Android),
     montrés à recopier (iPhone) */
  if (!range) {
    range = true;
    rangerLiens().then(() => { confierPassage(); repeindre(); }, () => { /* adresse illisible : rien à garder */ });
  }
  const passe = cartePassage();
  const i = installer(ici);
  const e = i.type === 'magasin' ? magasinHtml(i, passe) : etat === 'guide' ? guideHtml(passe) : installeHtml(passe);
  const cle = [e.cle, passe, auth ? 1 : 0].join('|');
  const el = $.querySelector('.pw');
  if (el && el.dataset.cle === cle) return;          // rien n'a changé : l'animation continue sans repartir
  $.innerHTML = `<div class="pub pw${e.fleche ? ' pw-avec-' + e.fleche : ''}" data-cle="${esc(cle)}">
    ${pubTete(false)}
    <div class="pw-centre"><div class="login pw-carte" data-k="pw">${e.html}</div></div>
    ${auth ? '' : `<div class="ldemos"><button class="lnk ldemo" data-act="decouvrir" type="button">${svg(I.play)}Essayer sans compte</button></div>`}
    <div class="lleg">${Object.entries(LEGAL_TITRES).map(([k, t]) => `<button data-legal="${k}">${esc(t)}</button>`).join('<i>·</i>')}</div>
    ${e.fleche ? `<span class="pw-fleche ${e.fleche}" aria-hidden="true">${FLECHE}</span>` : ''}
  </div>`;
  lierPassage();
}

/* ---------- les gestes ---------- */
async function installerFolio(b) {
  const e = bip;
  if (!e) return;
  setBip(null);
  b.disabled = true;
  try {
    e.prompt();
    const r = await e.userChoice;
    if (r && r.outcome === 'accepted') etat = 'installe';
  } catch (x) { /* invite déjà consommée par le navigateur : le chemin de son menu prend le relais */ }
  repeindre();
}

async function copierLien() {
  const url = new URL(location.pathname, SITE).href;
  try { await navigator.clipboard.writeText(url); toast(I.check, 'Lien copié'); }
  catch (e) { toast(I.link, url); }                // presse-papiers refusé : l'adresse s'affiche, à recopier
}

document.addEventListener('click', ev => {
  const b = ev.target.closest('.pw [data-pw]');
  if (!b) return;
  if (b.dataset.pw === 'installer') installerFolio(b);
  if (b.dataset.pw === 'copier') copierLien();
});
