// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { auth, bip, setBip } from '../data/etat.js';
import { installer, plateforme } from '../plateformes.js';
import { enGras, guide, langueEcran, lienChrome, navigateur } from '../installation.js';
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
   les étapes dans les mots du navigateur et de la langue du téléphone
   (src/installation.js), un téléphone dessiné qui les rejoue une à une, et
   une flèche posée au bord de l'écran, vers le vrai bouton. Chaque étape
   s'allume avec sa scène.

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
const LANGUE = langueEcran(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
/* iOS 26 : Safari le dit (Version/26), Chrome et les autres non (leur
   signature reste « iPhone OS 18_6 »). Leur moteur est celui du système :
   le positionnement par ancre et les animations liées au défilement
   arrivent avec iOS 26, on le devine à ça (Safari, lui, a sa version). */
const IOS26 = ici.os === 'ios' && nav.nom !== 'safari' && !!(window.CSS && CSS.supports
  && (CSS.supports('anchor-name: --a') || CSS.supports('animation-timeline: scroll()')));

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
const CHEVRON = '<path d="M7 10l5 5 5-5"/>';
const GLYPHES = {
  partager: () => svg(I.share),
  points: () => '<span class="pw-txt">•••</span>',
  menu: () => '<span class="pw-txt">⋮</span>',
  menu3: () => '<span class="pw-txt">≡</span>',
  plus: () => svg(CHEVRON),
  ajouter: () => svg(CARRE_PLUS),
  ok: () => svg(I.check),
  installer: () => svg(I.down),
  sortir: () => svg(I.globe),
  folio: () => '<img src="/site/icone.svg" alt="" width="20" height="20">'
};
const glyphe = ic => (GLYPHES[ic] || GLYPHES.partager)();
// les mots de l'écran d'une étape, dans l'ordre : ce que la scène allume
const gras = e => (e.texte.match(/\*\*(.+?)\*\*/g) || []).map(t => t.slice(2, -2));

/* ---------- le téléphone qui rejoue le geste (2026-11-02) ----------
   Une scène par étape, dessinée comme l'écran du vrai téléphone : la barre
   du navigateur et son bouton, la feuille de partage d'iOS (et son « En
   voir plus » sur iOS 26), ses actions, l'écran qui confirme, l'écran
   d'accueil. Un anneau marque ce qu'on touche, au moment où on le touche ;
   l'étape de la liste s'allume avec sa scène. Avant, trois scènes pour
   quatre étapes, un menu de barres grises : on ne reconnaissait rien, et
   « En voir plus » d'iOS 26 n'y était pas. */
const T = s => `<em class="pw-t">${esc(s)}</em>`;               // un mot de l'écran, qui ne déborde jamais
const fond = () => '<div class="pw-page"><img src="/site/logo.svg" alt=""><b></b><b></b><b class="court"></b></div>';

// le navigateur, son bouton là où il est sur ce téléphone ; `pop` : le menu du bouton (••• puis Partager)
function barre(g, e) {
  const b = `<i class="pw-b cible">${glyphe(g.etapes[0].ic)}</i>`;
  const pts = '<i class="pw-p"></i>';
  const mots = gras(e);
  const pop = mots.length > 1 && g.cas !== 'integre'
    ? `<div class="pw-pop ${g.fleche === 'haut-droite' ? 'haut' : ''}"><span></span><span class="cible2">${svg(I.share)}${T(mots[1])}</span><span></span><span></span></div>` : '';
  const url = `<span class="pw-url">${T('mirandola.fr')}</span>`;
  let chrome;
  if (g.cas === 'ios26') chrome = `<div class="pw-bas pw-bas26"><i class="pw-p">‹</i>${url}${b}</div>`;
  else if (g.cas === 'ios-chrome') chrome = `<div class="pw-haut pw-haut-c"><span class="pw-url">${T('mirandola.fr')}${b}</span></div>
    <div class="pw-bas">${pts}${pts}${pts}${pts}${pts}</div>`;
  else if (g.fleche === 'bas') chrome = `<div class="pw-haut pw-haut-t">${url}</div><div class="pw-bas">${pts}${pts}${b}${pts}${pts}</div>`;
  else if (g.fleche === 'bas-droite') chrome = `<div class="pw-haut pw-haut-t">${url}</div><div class="pw-bas">${pts}${pts}${pts}${pts}${b}</div>`;
  else if (g.cas === 'integre') chrome = `<div class="pw-haut"><i class="pw-p">✕</i>${url}${b}</div>`;
  else chrome = `<div class="pw-haut">${url}${b}</div>`;
  return fond() + chrome + pop;
}

// le menu d'un navigateur d'Android (ou de l'app qui enferme) : sous le bouton s'il est en haut, en feuille s'il est en bas
function menu(g, e) {
  const bas = g.fleche === 'bas' || g.fleche === 'bas-droite';
  const ic = g.cas === 'integre' ? I.globe : CARRE_PLUS;
  return `${fond()}<div class="pw-voile"></div><div class="pw-menu ${bas ? 'bas' : ''}"><span></span><span></span>
    <span class="cible">${svg(ic)}${T(gras(e)[0] || g.ligne)}</span><span></span></div>`;
}

const ENTETE = '<div class="pw-fe"><img src="/site/icone.svg" alt=""><span><b>Mirandola</b><small>mirandola.fr</small></span></div>';

// la feuille de partage d'iOS 26 : contacts, apps, puis quatre actions rondes ; la dernière ouvre le reste
function feuille(g, e) {
  const ronds = (n, cls) => `<div class="pw-rang ${cls}">${'<i></i>'.repeat(n)}</div>`;
  return `${fond()}<div class="pw-voile"></div><div class="pw-partage">${ENTETE}${ronds(4, 'gens')}${ronds(4, 'apps')}
    <div class="pw-rang actions"><span><i>${svg(I.copy)}</i>${T(g.mots.copier)}</span><span><i></i></span><span><i></i></span>
    <span class="cible"><i>${svg(CHEVRON)}</i>${T(gras(e)[0])}</span></div></div>`;
}

// ses actions : la ligne à toucher, après un défilement quand elle est plus bas (avant iOS 26)
function liste(g, e) {
  const l = n => '<span></span>'.repeat(n);
  return `${fond()}<div class="pw-voile"></div><div class="pw-partage plein">${ENTETE}
    <div class="pw-defile ${g.ios26 ? '' : 'loin'}"><div class="pw-groupe">${l(4)}</div>
      <div class="pw-groupe"><span class="cible">${svg(CARRE_PLUS)}${T(gras(e)[0])}</span>${l(3)}</div></div></div>`;
}

// l'écran qui confirme : celui d'iOS (Ajouter en haut à droite), ou la boîte d'Android
function ajout(g, e) {
  const mot = gras(e).at(-1);
  if (g.cas.startsWith('ios') || g.cas === 'ipad') {
    return `<div class="pw-ios-ajout"><div class="pw-nav-ios">${T(g.mots.annuler)}<b class="cible">${T(mot)}</b></div>
      <div class="pw-fiche"><img src="/site/icone.svg" alt=""><span><b>Mirandola</b><small>mirandola.fr</small></span></div>
      ${g.ios26 ? `<div class="pw-fiche pw-bascule">${T(g.mots.webapp)}<i></i></div>` : ''}</div>`;
  }
  return `${fond()}<div class="pw-voile"></div><div class="pw-boite"><div class="pw-fe"><img src="/site/icone.svg" alt="">
    <span><b>Mirandola</b><small>mirandola.fr</small></span></div>
    <div class="pw-boutons">${T(g.mots.annuler)}<b class="cible">${T(mot)}</b></div></div>`;
}

const accueil = () => `<div class="pw-grille">${'<i></i>'.repeat(7)}<span class="pw-app cible"><img src="/site/icone.svg" alt=""><small>Mirandola</small></span><i></i></div>`;
const SCENES = {
  barre, menu, feuille, liste, ajout, accueil,
  page: () => `<div class="pw-page"><img src="/site/logo.svg" alt=""><b></b><b class="court"></b><span class="pw-pbouton cible">Installer Mirandola</span></div>`,
  nav: g => `<div class="pw-nav cible">${svg(I.globe)}<b>${esc(g.titre.replace('Continue dans ', ''))}</b></div>`
};
// le temps d'une scène : deux gestes, ou un défilement, en demandent plus
const duree = (g, e) => (gras(e).length > 1 && e.s === 'barre' && g.cas !== 'integre') || (e.s === 'liste' && !g.ios26) ? 3600 : 2700;

function scene(g) {
  return `<div class="pw-scene" data-fleche="${g.fleche || ''}" data-cas="${esc(g.cas)}" aria-hidden="true">
      <div class="pw-tel"><div class="pw-ecran">${g.etapes.map((e, i) => `<div class="pw-s pw-sc-${e.s}${i ? '' : ' on'}" data-i="${i}"
        data-d="${duree(g, e)}">${SCENES[e.s](g, e)}</div>`).join('')}</div></div>
    </div>`;
}

/* chaque étape commence par ce qu'on touche, dessiné ; elle s'allume avec sa
   scène, et la toucher la montre (l'horloge attend alors un peu) */
const etapesHtml = g => `<ol class="pw-etapes">${g.etapes.map((e, i) => `<li data-pw="pas" data-i="${i}"${i ? '' : ' class="on"'}>
      <i class="pw-g" aria-hidden="true">${glyphe(e.ic)}</i><span>${enGras(e.texte, esc)}</span></li>`).join('')}</ol>`;

/* ---------- l'horloge des scènes ----------
   Une seule, posée sur l'écran affiché : elle s'arrête d'elle-même quand il
   part. Mouvement réduit : rien ne défile, on touche les étapes. */
const REDUIT = matchMedia('(prefers-reduced-motion: reduce)').matches;
let horloge = 0, attendre = 0;
function montrer(duo, i) {
  duo.querySelectorAll('[data-i]').forEach(x => x.classList.toggle('on', +x.dataset.i === i));
}
function tourner() {
  clearTimeout(horloge);
  const duo = $.querySelector('.pw-duo');
  if (!duo || REDUIT) return;
  const pas = () => {
    if (!duo.isConnected) return;
    const s = duo.querySelector('.pw-s.on');
    const n = duo.querySelectorAll('.pw-s').length;
    const d = s ? +s.dataset.d : 2700;
    horloge = setTimeout(() => {
      if (!duo.isConnected) return;
      if (Date.now() < attendre) return pas();
      montrer(duo, ((s ? +s.dataset.i : -1) + 1) % n);
      pas();
    }, Math.max(d, attendre - Date.now()));
  };
  pas();
}

/* ---------- les boutons ---------- */
const adresse = () => new URL(location.pathname + location.search, SITE).href;
const versChrome = (t = 'Ouvrir dans Chrome') => `<a class="cta pw-cta" href="${esc(lienChrome(adresse()))}">${svg(I.out)}${t}</a>`;
const copier = (cls = 'cta pw-cta') => `<button class="${cls}" type="button" data-pw="copier">${svg(I.copy)}Copier le lien</button>`;

function bouton(g, attente) {
  if (g.bouton === 'installer') {
    return `<button class="cta pw-cta" type="button" data-pw="installer" ${attente ? 'disabled' : ''}>${svg(I.down)}Installer Mirandola</button>`;
  }
  if (g.bouton === 'chrome') return versChrome();
  if (g.bouton === 'copier') return copier();
  return '';
}

function secours(g) {
  if (!g.secours) return '';
  const corps = g.secours === 'safari' ? `<p>Copie le lien et colle-le dans Safari : c’est lui qui installe le mieux.</p>${copier('pw-lien')}`
    : g.secours === 'chrome' ? `<p>Ouvre Mirandola dans Chrome : il l’installe en un geste.</p>${versChrome()}`
      : `<p>Copie le lien et colle-le dans Chrome.</p>${copier('pw-lien')}`;
  return `<details class="pw-secours"><summary>Tu ne trouves pas&#8239;?</summary>${corps}</details>`;
}

/* ---------- les états ---------- */
function guideHtml(passe) {
  const attente = INVITE && !bip && performance.now() - DEBUT < PATIENCE;
  const g = guide(ici.os, nav, { invite: !!bip || attente, session: !!auth, langue: LANGUE, ios26: IOS26 });
  const sous = g.cas === 'integre' ? 'Ici, rien ne s’installe.' : 'Mirandola s’ouvre depuis ton écran d’accueil.';
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
      <h1 class="lt">${etat === 'deja' ? 'Mirandola est déjà là' : 'C’est installé'}</h1>
      <p class="lsub">Ouvre Mirandola depuis ton écran d’accueil${auth && android ? ' : ton compte t’y attend' : ', puis connecte-toi'}.</p>
      <div class="pw-scene pw-fige" aria-hidden="true"><div class="pw-tel"><div class="pw-ecran"><div class="pw-s pw-sc-accueil on">
        ${accueil()}</div></div></div></div>
      ${passe}`
  };
}

// l'app des magasins, le jour où elle y est (src/plateformes.js, MAGASINS)
function magasinHtml(i, passe) {
  return {
    cle: 'magasin', fleche: null,
    html: `<h1 class="lt">Mirandola est une app</h1><p class="lsub">Télécharge-la, connecte-toi : tout t’y attend.</p>
      ${passe}<a class="cta pw-cta" href="${esc(i.lien)}" rel="noopener">${svg(I.down)}Télécharger sur ${esc(i.nom)}</a>`
  };
}

const FLECHE = '<svg viewBox="0 0 24 24"><path d="M12 3.5v15M5.5 12.5 12 19l6.5-6.5"/></svg>';

export function pwaEcran() {
  /* Les codes de l'adresse (une classe, une partie, un club, Mirandola+)
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
  tourner();
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
  if (b.dataset.pw === 'pas') {
    const duo = b.closest('.pw-duo');
    attendre = Date.now() + 6000;
    if (duo) montrer(duo, +b.dataset.i);
  }
});
