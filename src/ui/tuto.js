// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import {
  auth, comp, compte, db, demoEtab, eleve, me, menu, myRole, offre, prefs, prof, ref, setTuto, study, tuto, view
} from '../data/etat.js';
import { deck, esc } from '../core/coeur-sync.js';
import { refPull } from '../core/classement.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { statsPull } from '../core/ecran-groupe.js';
import { mailPull } from '../core/reglages-corbeille.js';
import { rangerClasses } from '../classe.js';
import { aideSelon, debutDe, ecransDe, etapes, finDe, pageAuto, quelRole } from '../tuto.js';
import { chemin, doux, forme, mix, placePc, placeTel, resserre } from '../tuto-trou.js';
import { allerClasses, aUneClasse, go, monIdent } from './bibliotheque.js';
import { atSchool, eleveDeClasse } from './classement.js';
import { commuPull } from './cercle.js';
import { refAller } from './etablissement.js';
import { avatar } from './jeton.js';
import { beep, savePrefs, toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';
import { poserMatiere, poserPage } from './creation.js';
import { allerAccueil, allerClasse } from './prof-porte.js';
import { ouvrirPlus, sansFolioPlus } from './plus-porte.js';
import { VENTE_OUVERTE } from '../abonnement.js';
import './tuto.css';

/* ══════════ le tuto : le moteur (2026-10-27) ══════════
   Il joue un scénario de src/tuto.js sur le vrai écran : un voile, un trou
   sur ce qu'il faut toucher, un anneau qui pulse autour, une bulle courte.
   C'est la personne qui avance, le tuto la suit : l'étape finit quand ce
   qu'elle attend arrive (un écran, une page retournée, un devoir donné). Il
   se joue sur le vrai compte : le livre qu'on y crée est le sien.

   Rien ne le contourne, sauf la croix, « Passer » et Échap : une garde,
   posée sur la fenêtre avant l'app, ne laisse passer que ce que l'étape
   permet — un appui, une touche, une frappe, un glissé. Tout le reste est
   retenu (« Créer un nouveau livre » pendant qu'on choisit le livre d'un
   devoir, la croix d'une feuille, le balayage entre onglets…), et la
   bulle le rappelle. Le retour du navigateur ne fait pas sauter d'étape :
   le tuto ramène à l'écran de l'étape, ou à l'étape d'où l'on y entre.
   Une étape ne passe d'elle-même que si elle ne peut pas se jouer (rien à
   lire aujourd'hui, pas de classe) — jamais parce qu'on a attendu.

   Au téléphone la bulle se pose sous ou sur ce qu'on montre, de toute la
   largeur ; sur ordinateur, à côté. Chargé à la demande par sa porte,
   ui/tuto-porte.js. */

let t = null;                 // le tuto en cours : { role, liste, i, demo, souris, pc, lecture… }
let racine = null, minuteur = 0;

const attendre = ms => new Promise(r => setTimeout(r, ms));
const FEUILLE = '.menu:not(.sort)';
const CHAMP = 'input,textarea,select,[contenteditable]';
/* combien de temps on laisse à ce qui se charge, ou à ce qui se referme, avant de trancher */
const GRACE_TANT = 700, GRACE_INCONNU = 5000, GRACE_CIBLE = 6000, GRACE_MOT = 2500, GRACE_ECRAN = 4000, GRACE_PERTE = 1200;

/* ---------- ce qu'on sait du compte au départ ---------- */
function drapeaux() {
  const classes = rangerClasses(prof.classes).actives.length > 0;
  return {
    livres: db.decks.some(d => !d.hidden && d.cards.length),
    classe: aUneClasse(),
    classes,
    etab: atSchool(),
    bande: !atSchool() || classes,
    pc: matchMedia('(min-width: 900px)').matches
  };
}

/* Les classes d'un professeur, les codes du référent, les devoirs d'un
   élève arrivent du réseau : le scénario se choisit une fois qu'ils sont
   là (3 s au plus). */
async function pretPour(role) {
  if (role === 'classe' && !eleve.devoirs) eleveClassesPull();
  if (role === 'prof' && view.name !== 'prof') allerAccueil();
  if (role === 'ref' && view.name !== 'ref') { refPull(); go('ref'); }
  const ok = {
    classe: () => !!eleve.devoirs,
    prof: () => !!prof.classes && !!document.querySelector('.pf-main'),
    ref: () => view.name === 'ref' && ref.codes !== null
  }[role];
  for (let n = 0; ok && n < 30 && !ok(); n++) await attendre(100);
}

/* ---------- ce qui finit une étape ---------- */
const note = () => {
  const l = t.lecture;
  return !!(study && l && l.s === study && (study.log.length > l.n0 || study.queue !== l.q0 || study.i !== l.i0));
};
const aDesClasses = () => !!prof.classes && rangerClasses(prof.classes).actives.length > 0;
const ATTEND = {
  vue: v => view.name === v,
  feuille: k => menu === k,
  /* la première page, écrite par le tuto (ecrireSeul) */
  ecrite: () => !!t.ecrite,
  sansFeuille: () => !menu,
  onglet: k => view.name === 'profclasse' && prof.tab === k,
  ref: k => view.name === 'ref' && ref.tab === k,
  retournee: () => view.name === 'study' && !!study && (study.flip || note()),
  notee: () => note(),
  classes: aDesClasses,
  /* le livre d'un devoir choisi : la feuille passe à la classe et à la date */
  details: () => menu === 'pf' && !!(prof.comp && prof.comp.cartes),
  /* donné pour de vrai : donnerGo vide prof.comp et ferme la feuille (une feuille refermée autrement le garde) */
  donne: () => !prof.comp && menu !== 'pf'
};
const atteint = a => Object.entries(a).every(([k, v]) => ATTEND[k](v));

/* La feuille ouverte, et laquelle : quand celle d'une étape fait place à une
   autre (« Nouvelle classe », puis « Ajouter des élèves »), l'étape est perdue. */
const cleFeuille = () => `${menu}:${menu === 'pf' ? prof.feuille : ''}`;

/* Ce qui doit tenir pendant l'étape : vrai, faux, ou `null` tant qu'on ne
   sait pas encore (une liste qui se charge). */
const TANT = {
  aLire: () => view.name === 'deck' && !!document.querySelector('.cta.read b'),
  /* dans la démo d'un élève, Mirandola gratuit garde 5 livres : au-delà, « Nouveau livre » ouvre une fenêtre (ui/demo.js) */
  creable: () => !document.documentElement.classList.contains('livres-plein'),
  feuille: () => !!menu && !!document.querySelector(FEUILLE) && (!t.feuille || cleFeuille() === t.feuille),
  classes: () => (prof.classes ? aDesClasses() : null),
  eleves: () => (view.name !== 'profclasse' ? false : prof.roster == null ? null : prof.roster.length > 0)
};
function tantOk(c) {
  if (!c) return true;
  const non = c.startsWith('!'), v = TANT[non ? c.slice(1) : c]();
  return v == null ? null : non ? !v : v;
}

/* ---------- les écrans ---------- */
/* « ref:accueil » : la console du référent, sur son accueil */
function surEcran(k) {
  const [v, s] = k.split(':');
  return view.name === v && (!s || (v === 'ref' ? (ref.tab || 'accueil') === s : true));
}
const surUnDe = l => !l || l.some(surEcran);

/* Les écrans où le tuto sait mener (`false` : pas cette fois) ; une lecture,
   la création d'un livre, une feuille ne se rouvrent pas : on revient à
   l'étape d'où l'on y entre. */
const ALLER = {
  home: () => go('home'),
  classes: () => allerClasses(),
  commu: () => { commuPull(); go('commu'); },
  stats: () => { statsPull(); go('stats'); },
  mail: () => { mailPull(); go('mail'); },
  deck: () => { if (!t.deck || !deck(t.deck)) return false; go('deck', t.deck); },
  prof: () => allerAccueil(),
  profclasse: () => { if (!t.classe) return false; allerClasse(t.classe); },
  'ref:accueil': () => refAller('accueil')
};
const mener = k => !!ALLER[k] && ALLER[k]() !== false;

/* ---------- le départ ---------- */
const prenomDe = () => (compte && compte.nom) || prefs.name || (me && me.name) || '';
const classeDe = () => ((eleve.classes || []).find(c => c.statut === 'inscrit') || {}).nom || '';

export async function lancer(o = {}) {
  arreter(false);
  const role = quelRole({ role: myRole, eleveDeClasse: eleveDeClasse(), prof: myRole === 'prof', referent: myRole === 'ref' && atSchool() });
  if (!role) return;
  setTuto({ role, attente: true });     // en route : la porte ne relance rien entre-temps
  closeMenu();
  await pretPour(role);
  if (!tuto || !tuto.attente) return;   // arrêté pendant qu'on attendait
  const pc = matchMedia('(min-width: 900px)').matches;
  t = { role, demo: !!demoEtab, d: drapeaux(), i: -1, pc, souris: matchMedia('(hover: hover) and (pointer: fine)').matches };
  t.liste = etapes(role, t.d);
  t.debut = debutDe(role, { demo: t.demo, prenom: prenomDe(), classe: classeDe() });
  setTuto(t);
  // vu dès qu'il commence : un rechargement au milieu ne le relance pas, les Réglages le rejouent
  if (!prefs.tuto && !o.rejoue) { prefs.tuto = 1; savePrefs(); }
  monter();
  entrer(0);
}

/* Le tuto s'en va en fondu (le voile ne disparaît pas d'un coup) ; ses
   gardes, elles, partent tout de suite : l'app répond dès cet instant. */
/* `fini` : le tuto s'en va pour de bon (pas relancé) — les codes qui
   attendaient la fin des premiers pas (une partie, un club tapés sur le
   site avant d'avoir un compte) peuvent passer (ui/liens-entrants.js). */
export function arreter(fini = true) {
  const etait = !!(t || tuto);
  clearInterval(minuteur); minuteur = 0;
  cancelAnimationFrame(boucle); boucle = 0;
  if (racine) {
    const r = racine;
    r.id = '';                                // un tuto relancé aussitôt a le sien ; celui-ci ne prend plus rien
    r.classList.add('part');
    setTimeout(() => r.remove(), reduit() ? 0 : 240);
    racine = null;
  }
  document.documentElement.classList.remove('tu-actif');
  for (const [type, f] of GARDES) window.removeEventListener(type, f, true);
  t = null; setTuto(null);
  if (fini && etait) document.dispatchEvent(new Event('premiers-pas-finis'));
}

function passer() {
  const m = t && t.debut && t.debut.passe;
  arreter();
  if (m) toast(I.bulb, m);
}

/* ---------- l'habillage ----------
   Le voile est un SVG de la taille de l'écran : un rectangle plein percé
   d'un rectangle arrondi (evenodd), redessiné par une seule boucle
   (requestAnimationFrame). Jusqu'au 2026-10-29, c'était l'ombre démesurée
   d'un élément (200vmax) poussée par des transitions CSS : au téléphone une
   couche immense repeinte à chaque image (des saccades), un trou qui
   restait un instant sur l'écran d'après (un rectangle clair là où était le
   bouton) puis le traversait, et qui suivait le défilement avec 0,45 s de
   retard. Maintenant le trou suit ce qu'il montre sans retard ; d'une
   étape à l'autre sur le même écran, il glisse ; vers un autre écran, il
   se ferme aussitôt et s'ouvre sur la nouvelle cible. Il épouse la forme
   de ce qu'il montre (ses coins), sans marge : plus de liseré clair du
   fond de page autour, plus de liseré blanc à l'anneau. */
const SVG = 'http://www.w3.org/2000/svg';

function monter() {
  racine = document.createElement('div');
  racine.id = 'tu'; racine.className = 'tu';
  if (t) racine.dataset.role = t.role;          // le scénario : perso, classe, prof, ref
  racine.innerHTML = `<svg class="tu-ombre" aria-hidden="true" xmlns="${SVG}"><path fill-rule="evenodd"/></svg>`
    + '<i class="tu-flou"></i><i class="tu-anneau"></i>'
    + ['h', 'b', 'g', 'd', 'trou'].map(k => `<i class="tu-blk" data-c="${k}"></i>`).join('')
    + '<div class="tu-bulle" role="dialog" aria-live="polite" aria-labelledby="tut"></div><div class="tu-carte"></div>';
  document.body.appendChild(racine);
  document.documentElement.classList.add('tu-actif');
  racine.addEventListener('click', surClic);
  for (const [type, f] of GARDES) window.addEventListener(type, f, true);
  geo.trou = geo.anim = null; geo.d = geo.an = '';
  minuteur = setInterval(tic, 120);
  boucle = requestAnimationFrame(image);
}

const bulle = () => racine && racine.querySelector('.tu-bulle');
const etape = () => t && t.liste[t.i];

/* L'écran qu'on voit : quand il change sous le trou, le trou se ferme (il
   montrerait un bout de l'écran d'après, qui n'a rien à voir). */
const cleEcran = () => `${view.name}:${view.id || ''}:${menu || ''}`;

/* ---------- d'une étape à l'autre ---------- */
function entrer(i) {
  if (!t || !racine) return;
  t.i = i;
  const e = t.liste[i];
  if (!e) return arreter();
  Object.assign(t, { depuis: Date.now(), navigue: 0, pause: 0, pret: 0, feuille: '', els: null, perdu: 0, retours: 0,
    ecrite: 0, vise: '', glisser: 0, cote: '' });
  if (e.carte) return carte(e.carte);
  if (e.attend && atteint(e.attend)) return entrer(i + 1);     // déjà fait : on n'y revient pas
  const ec = ecransDe(e, t.pc);
  if (!surUnDe(ec)) {
    if (!mener(ec[0])) return entrer(i + 1);                  // un écran où l'on ne sait pas mener : l'étape ne se joue pas
    t.navigue = Date.now();
  }
  attente();
}

/* Le geste a porté : on laisse voir ce qu'il a fait, puis on enchaîne. */
function reussi() {
  t.pause = 1;
  beep(true);
  racine.dataset.mode = 'pause';
  bulle().classList.remove('vue');
  if (cleEcran() !== t.ecran) fermer();
  setTimeout(() => { if (t) { t.pause = 0; entrer(t.i + 1); } }, 320);
}

function tic() {
  if (!t || t.pause) return;
  const e = etape();
  if (!e || e.carte) return;
  observer();
  if (e.attend && atteint(e.attend)) return t.pret ? reussi() : entrer(t.i + 1);
  if (!t.pret) return preparer(e);
  perdue(e);
}

/* Ce que le tuto retient en chemin : la lecture commencée (pour savoir
   qu'une page a été notée), le livre et la classe ouverts (pour y ramener). */
function observer() {
  if (view.name === 'study' && study && (!t.lecture || t.lecture.s !== study)) {
    t.lecture = { s: study, i0: study.i, q0: study.queue, n0: study.log.length };
  }
  if (view.name === 'deck' && view.id) t.deck = view.id;
  if (view.name === 'profclasse' && prof.open) t.classe = prof.open;
}

/* L'étape commence : son écran, ce qu'elle suppose, sa cible. Ce qui ne
   vient pas (un écran qui ne se charge pas, une liste vide) la fait passer :
   elle ne peut pas se jouer. Ce qu'on sait faux passe aussitôt (pas de
   classe, rien à lire) ; une feuille qui s'ouvre, une liste qui se charge,
   une cible qui se dessine ont un instant pour venir. */
function preparer(e) {
  const age = Date.now() - t.depuis;
  if (!surUnDe(ecransDe(e, t.pc))) { if (age > GRACE_ECRAN) entrer(t.i + 1); return; }
  const ok = tantOk(e.tant);
  if (ok === false && (e.tant !== 'feuille' || age > GRACE_TANT)) return entrer(t.i + 1);
  if (ok !== true) { if (age > GRACE_INCONNU) entrer(t.i + 1); return; }
  const els = e.centre ? null : trouver(e);
  if (!e.centre && !els) { if (age > (e.geste ? GRACE_CIBLE : GRACE_MOT)) entrer(t.i + 1); return; }
  if (els) amener(els);
  t.pret = 1;
  if (e.tant === 'feuille') t.feuille = cleFeuille();
  peindre(e);
}

/* L'écran ou la feuille de l'étape se sont perdus (le retour du
   navigateur, une feuille refermée) : un instant de grâce (ce qui se
   referme pour de bon, ce qui se charge), puis on y ramène, ou l'on revient
   à l'étape d'où l'on y entre. */
function perdue(e) {
  const ec = ecransDe(e, t.pc), ecranOk = surUnDe(ec), tient = tantOk(e.tant) !== false;
  if (ecranOk && tient) { if (t.perdu) { t.perdu = 0; peindre(e); } return false; }
  if (!t.perdu) { t.perdu = Date.now(); attente(); return true; }
  if (Date.now() - t.perdu < GRACE_PERTE) return true;
  if (!ecranOk && tient && t.retours < 3 && mener(ec[0])) { t.retours++; t.perdu = Date.now(); return true; }
  const k = e.reprise ? t.liste.findIndex(x => x.id === e.reprise) : -1;
  entrer(k >= 0 && k < t.i ? k : t.i + 1);
  return true;
}

/* ---------- la bulle ---------- */
function points() {
  const l = t.liste.filter(e => !e.carte), k = t.liste.slice(0, t.i).filter(e => !e.carte).length;
  return l.map((_, i) => `<i class="${i < k ? 'fait' : i === k ? 'ici' : ''}"></i>`).join('');
}

function boutonsHtml(e) {
  const l = [];
  if (e.passable && !t.demo) l.push(`<button class="tu-btn" data-tu="plustard">Plus tard</button>`);
  if (!e.geste && !e.ecrit) l.push(`<button class="tu-btn pri" data-tu="suivant">Suivant${svg(I.arrow)}</button>`);
  return l.length ? `<div class="tu-b">${l.join('')}</div>` : '';
}

function bulleHtml(e) {
  const aide = aideSelon(e.aide, t.souris, t.pc);
  return `<div class="tu-haut"><span class="tu-pas" aria-hidden="true">${points()}</span>
      <button class="tu-x" data-tu="passer" aria-label="Quitter le tuto" title="Quitter le tuto">${svg(I.x)}</button></div>
    <b class="tu-t" id="tut">${esc(e.titre)}</b>
    ${e.texte ? `<p class="tu-p">${esc(e.texte)}</p>` : ''}
    ${e.geste && aide ? `<p class="tu-geste">${svg(I.pick)}<span>${esc(aide)}</span></p>` : ''}
    ${boutonsHtml(e)}`;
}

/* Les modes : un geste (le trou ouvert, l'anneau qui pulse), un mot à lire
   (« info » : le trou fermé aux appuis), ce que le tuto écrit lui-même
   (« auto » : on regarde), un mot au centre ; « attente » quand l'étape se
   prépare ou se cherche : rien ne se touche. La bulle se pose d'un coup à
   sa place, cachée, puis paraît : elle ne traverse plus l'écran. */
function peindre(e) {
  t.peint = Date.now();
  racine.dataset.mode = e.centre ? 'centre' : e.geste ? 'geste' : e.ecrit ? 'auto' : 'info';
  racine.dataset.voile = e.voile || '';
  racine.querySelector('.tu-carte').innerHTML = '';
  if (e.centre || cleEcran() !== t.ecran) fermer();
  t.ecran = cleEcran();
  t.glisser = 1;                        // la première image de l'étape : le trou s'ouvre, ou glisse depuis l'étape d'avant
  const b = bulle();
  b.classList.remove('vue');
  b.innerHTML = bulleHtml(e);
  t.bulle = 1;                          // à mesurer, puis à montrer
  calmerClavier();
  if (e.ecrit) ecrireSeul(e);
}

function attente() {
  racine.dataset.mode = 'attente';
  const b = bulle();
  if (b) b.classList.remove('vue');
  if (t && cleEcran() !== t.ecran) fermer();
}

/* Un champ qui n'est pas à remplir ne garde pas le focus : le clavier du
   téléphone ne surgit pas pendant qu'on lit (la création d'un livre donne
   le focus à son titre dès qu'elle s'ouvre). */
function calmerClavier() {
  const a = document.activeElement;
  if (a && a !== document.body && !a.closest('#tu') && a.matches(CHAMP) && !permis(a)) a.blur();
}

/* ---------- viser ---------- */
const visible = n => { const r = n.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !n.closest('#tu'); };

/* La cible : le premier sélecteur qui a quelque chose de visible ; avec
   `union`, tout ce qu'il désigne (les deux codes d'un référent, au
   téléphone) ; pendant que le tuto écrit, le champ où il écrit. */
function trouver(e) {
  if (t.vise) { const n = [...document.querySelectorAll(t.vise)].find(visible); if (n) return [n]; }
  for (const s of e.cible || []) {
    const l = [...document.querySelectorAll(s)].filter(visible);
    if (l.length) return e.union ? l : [l[0]];
  }
  return null;
}

/* Ce qui reste éclairé, s'il est plus large que la cible : tout ce que
   désignent ses sélecteurs (la page qu'on écrit et la liste des pages). */
function trouDe(e) {
  const l = (e.trou || []).map(s => [...document.querySelectorAll(s)].find(visible)).filter(Boolean);
  return l.length ? l : null;
}

function boite(els) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of els) {
    const r = n.getBoundingClientRect();
    x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom);
  }
  return { top: y1, left: x1, bottom: y2, right: x2, height: y2 - y1 };
}

const hauteur = () => (window.visualViewport ? Math.min(innerHeight, visualViewport.height) : innerHeight);

/* Ce qu'on montre est amené à l'écran, une fois, avant que le trou ne s'y
   pose (c'est <body> qui défile) : loin du bas où se posent les onglets et
   le bandeau de la démo ; dans une feuille, seulement s'il en sort. Ce qui
   est fixé à l'écran (les onglets, le bouton rond) n'a pas à y venir. */
const fixe = n => { for (; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true; return false; };
function amener(els) {
  const H = hauteur(), r = boite(els);
  const [haut, bas] = els[0].closest('.menu, #rail') ? [8, 8] : [64, 150];
  if ((r.top < haut || r.bottom > H - bas) && r.height < H * .7 && !fixe(els[0])) {
    els[0].scrollIntoView({ block: 'center', behavior: geo.trou && !reduit() ? 'smooth' : 'auto' });
  }
}

/* Les coins de ce qu'on montre, pour que le trou en ait la forme (lus une
   fois par élément : un pourcentage s'écrit négatif, src/tuto-trou.js). */
const COINS = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
const coins = new WeakMap();
function coinsDe(n) {
  if (!coins.has(n)) {
    const cs = getComputedStyle(n);
    coins.set(n, COINS.map(k => { const v = cs[k] || '0', x = parseFloat(v) || 0; return v.includes('%') ? -x : x; }));
  }
  return coins.get(n);
}
const formeDe = (els, W, H) => forme(boite(els), W, H, coinsDe(els[0]));

/* ---------- la géométrie, image par image ----------
   `geo.trou` : la forme du trou à l'écran (`null` : fermé, tout est
   voilé) ; `geo.anim` : un glissement en cours, de `de` vers `vers`, que
   la cible qui bouge (un défilement, l'entrée de l'écran) fait suivre. */
const geo = { trou: null, anneau: null, anim: null, d: '', an: '' };
let boucle = 0;
const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function fermer() { geo.trou = geo.anneau = geo.anim = null; }

/* Où va le trou : il s'ouvre (fermé), glisse (une autre étape sur le même
   écran), ou suit sa cible (la même étape). */
function viser(trou, anneau, glisser) {
  const now = performance.now();
  if (reduit()) { geo.anim = null; geo.trou = trou; geo.anneau = anneau; return; }
  if (!geo.trou) geo.anim = { de: { trou: resserre(trou), anneau: resserre(anneau) }, t0: now, duree: 300 };
  else if (glisser) geo.anim = { de: { trou: geo.trou, anneau: geo.anneau || anneau }, t0: now, duree: 340 };
  if (geo.anim) {
    const p = doux(Math.min(1, (now - geo.anim.t0) / geo.anim.duree));
    geo.trou = mix(geo.anim.de.trou, trou, p); geo.anneau = mix(geo.anim.de.anneau, anneau, p);
    if (p >= 1) geo.anim = null;
  } else { geo.trou = trou; geo.anneau = anneau; }
}

const posEl = (n, x, y, w, h) => {
  n.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  n.style.width = Math.max(0, Math.round(w)) + 'px'; n.style.height = Math.max(0, Math.round(h)) + 'px';
};

/* Chaque image : ce que l'étape montre, puis le trou, l'anneau, les volets
   (ils prennent les appuis hors du trou) et la bulle. Rien ne s'écrit si
   rien n'a bougé. */
function image() {
  boucle = requestAnimationFrame(image);
  if (!t || !racine) return;
  const W = racine.clientWidth, H = racine.clientHeight, e = etape();
  const montre = e && !e.carte && t.pret && !t.pause && !t.perdu;
  if (montre && !e.centre) {
    const els = trouver(e);
    if (els) {
      const anneau = formeDe(els, W, H), tr = trouDe(e);
      t.els = els; t.vers = { trou: tr ? formeDe(tr, W, H) : anneau, anneau };
      viser(t.vers.trou, anneau, t.glisser);
      t.glisser = 0;
    } else { t.els = null; bulle().classList.remove('vue'); }   // un instant ailleurs (un redessin) : on la retrouvera
  } else geo.anim = null;
  dessiner(W, H);
  if (montre && (e.centre || t.els)) placerBulle(e);
}

function dessiner(W, H) {
  const d = chemin(W, H, geo.trou);
  if (d !== geo.d) {
    geo.d = d;
    const svgEl = racine.querySelector('.tu-ombre');
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.firstChild.setAttribute('d', d);
  }
  const f = geo.trou || { x: 0, y: 0, w: 0, h: 0 }, a = geo.anneau;
  const an = a ? `${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.w)},${Math.round(a.h)},${a.r.map(Math.round)}` : '';
  if (an !== geo.an) {
    geo.an = an;
    const n = racine.querySelector('.tu-anneau');
    n.classList.toggle('sans', !a);
    if (a) { posEl(n, a.x, a.y, a.w, a.h); n.style.borderRadius = a.r.map(v => Math.round(v) + 'px').join(' '); }
  }
  const v = (k, X, Y, w, h) => posEl(racine.querySelector(`[data-c="${k}"]`), X, Y, w, h);
  v('h', 0, 0, W, f.y); v('b', 0, f.y + f.h, W, H - f.y - f.h);
  v('g', 0, f.y, f.x, f.h); v('d', f.x + f.w, f.y, W - f.x - f.w, f.h);
  v('trou', f.x, f.y, f.w, f.h);
}

/* La bulle : au téléphone toute la largeur, sous le trou ou dessus ; sur
   ordinateur 340 px, à côté ; un mot au centre, au centre (src/tuto-trou.js).
   Elle se place sur la forme d'arrivée du trou, pas sur celle qui glisse :
   elle ne le suit pas en chemin. Mesurée une fois par étape. */
function placerBulle(e) {
  const b = bulle(), W = innerWidth, H = hauteur(), tel = W < 900;
  const bw = Math.min(W - 24, tel ? W : 340);
  if (t.bulle || t.bw !== bw) { b.style.width = bw + 'px'; t.bw = bw; t.bh = b.offsetHeight || 150; }
  let x = 12, y;
  if (e.centre) { x = (W - bw) / 2; y = Math.max(12, (H - t.bh) / 2); }
  else if (tel) ({ y, cote: t.cote } = placeTel(t.vers.trou, t.vers.anneau, t.bh, H, t.cote));
  else [x, y] = placePc(t.vers.trou, bw, t.bh, W, H);
  const tr = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  if (b.style.transform !== tr) b.style.transform = tr;
  if (t.bulle) { t.bulle = 0; void b.offsetWidth; }       // posée cachée, puis elle paraît sur place
  if (!b.classList.contains('vue')) b.classList.add('vue');
}

/* ---------- la garde ----------
   Posée sur la fenêtre, en capture : elle passe avant l'app. Ce qui vient du
   tuto passe ; ailleurs, seul ce que l'étape permet (sa cible, ses champs,
   sa feuille) ; le reste est retenu, et la bulle le rappelle. */
function permis(n) {
  const e = etape();
  if (!n || !n.closest || !e || e.carte || e.centre || !t.pret || t.pause || t.perdu) return false;
  if (e.sauf && e.sauf.some(s => n.closest(s))) return false;
  if (e.permis) return e.permis.some(s => n.closest(s));
  return !!(e.geste && t.els && t.els.some(x => x.contains(n)));
}
const duTuto = n => !!(n && n.closest && n.closest('#tu'));

function retenir(ev) {
  ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
}

function gardeClic(ev) {
  if (!t || duTuto(ev.target) || permis(ev.target)) return;
  retenir(ev);
  if (ev.type === 'click') rappel();
}

/* Un appui qui commence : aucun écouteur de l'app ne le voit (le balayage
   entre onglets, la feuille qu'on tire vers le bas, l'appui long sur un
   livre, le glisser-déposer), sauf ce qui se glisse à cette étape (la page
   d'une lecture). Le clic qui suit, lui, passe par gardeClic. */
function gardeAppui(ev) {
  if (!t || duTuto(ev.target)) return;
  const e = etape();
  if (e && e.glisse && permis(ev.target) && e.glisse.some(s => ev.target.closest(s))) return;
  ev.stopPropagation(); ev.stopImmediatePropagation();
  if (!permis(ev.target)) ev.preventDefault();      // ni focus ni sélection sur ce qui n'est pas permis
}

/* Le clavier : Échap quitte ; on tape dans ce qu'on remplit ; une lecture
   garde ses raccourcis ; Entrée fait « Suivant » sur un mot. Le reste ne
   parvient pas à l'app (aucun raccourci, aucun « annuler »). */
function gardeTouche(ev) {
  if (!t) return;
  const e = etape();
  if (ev.key === 'Escape') { retenir(ev); return e && e.carte === 'fin' ? arreter() : passer(); }
  if (duTuto(ev.target) || toucheLibre(ev, e)) return;    // les boutons du tuto, au clavier ; ce que l'étape permet
  const champ = champDe(ev.target);
  if (ev.key === 'Enter' && !champ) { if (e) entree(e); return retenir(ev); }
  ev.stopPropagation(); ev.stopImmediatePropagation();
  if (champ) ev.preventDefault();                   // pas de frappe dans un champ qui n'est pas à remplir
}

const champDe = n => (n && n.closest ? n.closest(CHAMP) : null);

/* Ce qui passe : la frappe dans ce qu'on remplit, Tab (le focus va où il
   veut : un appui n'y fera rien), Entrée sur la cible atteinte au clavier,
   les raccourcis d'une lecture. */
function toucheLibre(ev, e) {
  const champ = champDe(ev.target);
  if (champ) return permis(champ);
  if (ev.key === 'Tab') return true;
  if (ev.key === 'Enter') return permis(ev.target);
  const nu = !ev.ctrlKey && !ev.metaKey && !ev.altKey;
  return !!(e && nu && e.clavier && e.clavier.includes(ev.key) && pret());
}

/* Entrée ailleurs : le bouton principal d'une carte, « Suivant » sur un mot. */
function entree(e) {
  const p = e.carte ? racine.querySelector('.tu-go, .tu-a.pri') : (!e.geste && pret())
    ? racine.querySelector('[data-tu="suivant"]') : null;
  if (p) p.click();
}

function gardeSaisie(ev) {
  if (t && !duTuto(ev.target) && !permis(ev.target)) retenir(ev);
}

/* Un champ qui prend le focus sans être à remplir le rend aussitôt, même
   pendant qu'une étape se prépare : l'écran de création donne le focus à
   son titre en s'ouvrant, et le clavier du téléphone s'ouvrait puis se
   refermait (l'écran sautait deux fois). */
function gardeFocus(ev) {
  const n = ev.target;
  if (!t || duTuto(n) || !n.matches || !n.matches(CHAMP) || permis(n)) return;
  setTimeout(() => { if (t && document.activeElement === n) n.blur(); }, 0);
}

const GARDES = [['click', gardeClic], ['dblclick', gardeClic], ['auxclick', gardeClic], ['contextmenu', gardeClic],
  ['submit', gardeClic], ['pointerdown', gardeAppui], ['mousedown', gardeAppui], ['keydown', gardeTouche],
  ['beforeinput', gardeSaisie], ['focusin', gardeFocus]];

/* ---------- les cartes du début et de la fin ----------
   Un titre, un visage, deux boutons : pas de phrase dessous (« Deux minutes
   pour faire le tour… », partie le 2026-10-29). */
function carteDebut() {
  const d = t.debut;
  return `<div class="tu-c tu-debut" role="dialog" aria-modal="true" aria-labelledby="tuct">
      <span class="tu-moi">${avatar(auth.uid, monIdent(), 'xl')}</span>
      <h2 id="tuct">${esc(d.titre)}</h2>
      <button class="tu-go" data-tu="oui">${esc(d.oui)}${svg(I.arrow)}</button>
      <button class="tu-lien" data-tu="non">${esc(d.non)}</button>
    </div>`;
}

/* Mirandola+ et Mirandola Campus portent la marque du site : le « + » dans la
   lumière de la marque ; le logo sur son carré de papier, l'école en
   écusson dégradé, « Campus » en italique dégradée. */
const titreFin = f => (f.cle === 'plus' ? '<h2 id="tuct" class="tu-marque">Mirandola<span class="tu-plus">+</span></h2>'
  : f.cle === 'campus' ? `<h2 id="tuct" class="tu-campus"><span class="tu-campus-ic" aria-hidden="true">
        <img src="/site/logo.svg" alt="" width="30" height="33"><i>${svg(I.school)}</i></span><span>Mirandola <em>Campus</em></span></h2>`
  : `<span class="tu-ok">${svg(I.check)}</span><h2 id="tuct">${esc(f.titre)}</h2>`);

/* « tarifs » : la page des tarifs du site, dans un autre onglet — l'app
   reste ouverte derrière (?site : l'aiguillage du site garde la page
   d'accueil même avec une session) ; une fois la vente ouverte
   (VENTE_OUVERTE, src/abonnement.js), l'écran Mirandola+ de l'app, où l'on
   s'abonne. */
function actionHtml(a) {
  const c = `tu-a${a.pri ? ' pri' : ''}`;
  if (a.fin) return `<button class="${c}" data-tu="fin">${esc(a.t)}</button>`;
  if (a.href === 'tarifs' && VENTE_OUVERTE && !sansFolioPlus()) {
    return `<button class="${c}" data-tu="plus">${esc(a.t)}${a.pri ? svg(I.arrow) : ''}</button>`;
  }
  const href = a.href === 'tarifs' ? `${SITE}?site#tarifs` : a.href;
  const dehors = a.href === 'tarifs' ? ' target="_blank" rel="noopener"' : '';
  return `<a class="${c}" href="${esc(href)}" data-tu="fin"${a.partir ? ' data-dm="partir"' : ''}${dehors}>${esc(a.t)}${a.pri ? svg(I.arrow) : ''}</a>`;
}

function carteFin() {
  const f = finDe(t.role, { demo: t.demo, aPlus: !!offre && offre.offre !== 'gratuit' });
  return `<div class="tu-c tu-fin ${f.cle}" role="dialog" aria-modal="true" aria-labelledby="tuct">
      ${titreFin(f)}
      <ul class="tu-points">${f.points.map(([ic, x]) => `<li>${svg(I[ic] || I.check)}<span>${esc(x)}</span></li>`).join('')}</ul>
      <div class="tu-actions">${f.actions.map(actionHtml).join('')}</div>
    </div>`;
}

/* La fin se lit sur l'écran où l'on arrive d'habitude, pas sur le dernier
   visité : un élève sur ses livres (« Mes livres »), un professeur sur son
   tableau de bord, un référent sur l'accueil de sa console — « OK » finissait
   dans le Courrier (corrigé le 2026-10-29). */
function versArrivee() {
  if (t.role === 'prof') { if (view.name !== 'prof') allerAccueil(); }
  else if (t.role === 'ref') { if (!surEcran('ref:accueil')) refAller('accueil'); }
  else if (view.name !== 'home') go('home');
}

function carte(k) {
  if (k === 'fin') { if (menu) closeMenu(); versArrivee(); }
  racine.dataset.mode = 'carte';
  fermer();
  bulle().classList.remove('vue');
  const c = racine.querySelector('.tu-carte');
  c.innerHTML = k === 'debut' ? carteDebut() : carteFin();
  setTimeout(() => { const p = c.querySelector('.tu-go, .tu-a.pri'); if (p) p.focus({ preventScroll: true }); }, 60);
}

/* ---------- la première page, écrite par le tuto ----------
   Au téléphone, écrire soi-même sa première page ouvrait le clavier, qui
   cachait la page, la bulle et le bouton : on ne voyait plus rien
   (2026-10-29). Le tuto l'écrit donc sous les yeux, lettre à lettre, sans
   jamais donner le focus à un champ : la matière, le titre, le recto
   (« 1789 »), le verso (« Prise de la Bastille »), « Ajouter la page » ;
   puis deux autres pages arrivent dans la liste. L'anneau suit le champ où
   il écrit. Quitter le tuto en route arrête l'écriture. */
async function ecrireSeul(e) {
  const moi = t, encore = () => t === moi && etape() === e && t.pret && !t.perdu && view.name === 'import';
  if (comp.cards.length) { t.ecrite = 1; return; }          // déjà écrites (on revient à l'étape)
  const { matiere, titre, pages: [p, ...reste] } = pageAuto(db.subjects);
  const pointer = async (s, ms) => { t.vise = s; await attendre(reduit() ? 60 : ms); return encore(); };
  const taper = async (id, texte, garder) => {
    if (!(await pointer('#' + id, 420))) return false;
    for (let i = 1; i <= texte.length; i++) {
      const n = document.getElementById(id), v = texte.slice(0, i);
      if (n) n.value = v;
      garder(v);
      await attendre(reduit() ? 0 : 48);
      if (!encore()) return false;
    }
    return true;
  };
  const ajouter = () => {
    const add = document.getElementById('cadd');
    if (add) { add.classList.add('tu-appui'); setTimeout(() => add.classList.remove('tu-appui'), 180); }
    poserPage(p.f, p.b);
    t.vise = '#dlist';
    return true;
  };
  const pas = [
    () => attendre(650).then(encore),
    () => !matiere || comp.subject === matiere || pointer(`[data-nsubj="${matiere}"]`, 420).then(ok => ok && (poserMatiere(matiere), true)),
    () => !!String(comp.name || '').trim() || taper('nm', titre, v => { comp.name = v; }),
    () => taper('cf', p.f, v => { comp.f = v; }),
    () => taper('cb', p.b, v => { comp.b = v; }),
    () => pointer('#cadd', 420).then(ok => ok && ajouter()),
    ...reste.map(q => () => attendre(380).then(() => encore() && (poserPage(q.f, q.b), true))),
    () => attendre(700).then(encore)
  ];
  for (const f of pas) if (!(await f())) return;            // quitté, ou l'étape s'est perdue : on n'écrit plus
  t.ecrite = 1;                                             // l'anneau reste sur les pages : l'étape suivante l'en fera glisser
}

/* ---------- les boutons du tuto ----------
   Une bulle qui vient de se poser ne prend pas encore d'appui : un double
   appui sur « Suivant » ne saute pas l'étape d'après sans l'avoir lue. */
const pret = () => t && t.pret && !t.pause && !t.perdu;
const posee = () => pret() && Date.now() - (t.peint || 0) > 300;
const GESTES = {
  oui: () => entrer(t.i + 1),
  suivant: e => { if (!posee()) return; if (e && e.ferme && menu) closeMenu(); entrer(t.i + 1); },
  /* « Plus tard » : la feuille se referme, la suite du tuto continue sans ce geste */
  plustard: () => { if (!posee()) return; if (menu) closeMenu(); entrer(t.i + 1); },
  non: passer,
  passer,
  fin: arreter,
  plus: () => { arreter(); ouvrirPlus(); }
};

function surClic(ev) {
  const b = ev.target.closest('[data-tu]');
  if (!b) { if (ev.target.classList.contains('tu-blk')) rappel(); return; }
  if (b.dataset.tu === 'fin' && b.tagName === 'A') return arreter();     // le lien part de lui-même
  ev.preventDefault();
  const f = GESTES[b.dataset.tu];
  if (f && t) f(etape());
}

/* Un appui à côté de ce qu'il faut toucher : l'anneau s'éclaire une fois,
   rien ne bouge. La bulle qui tremblait à chaque appui (on le prenait pour
   une vibration) est partie le 2026-10-29 ; et seulement pendant un geste,
   au plus une fois par seconde et demie — jamais pendant qu'une étape
   s'en va ou arrive, jamais sur la bulle elle-même. */
function rappel() {
  if (!t || !racine || racine.dataset.mode !== 'geste' || !pret()) return;
  const now = Date.now();
  if (now - (t.rappel || 0) < 1500) return;
  t.rappel = now;
  const r = racine;
  r.classList.remove('rappel'); void r.offsetWidth; r.classList.add('rappel');
  setTimeout(() => r.classList.remove('rappel'), 900);
}
