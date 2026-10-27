// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import {
  auth, comp, compte, db, demoEtab, eleve, mailbox, me, menu, myRole, offre, prefs, prof, ref, setTuto, study, tuto, view
} from '../data/etat.js';
import { deck, esc } from '../core/coeur-sync.js';
import { refPull } from '../core/classement.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { statsPull } from '../core/ecran-groupe.js';
import { mailPull } from '../core/reglages-corbeille.js';
import { rangerClasses } from '../classe.js';
import { aideSelon, debutDe, ecransDe, etapes, exemple, finDe, quelRole } from '../tuto.js';
import { allerClasses, aUneClasse, go, monIdent, render } from './bibliotheque.js';
import { atSchool, isPupil } from './classement.js';
import { commuPull } from './cercle.js';
import { refAller } from './etablissement.js';
import { avatar } from './jeton.js';
import { beep, savePrefs, toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';
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
  pages: n => comp.cards.length >= n,
  feuille: k => menu === k,
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
  /* dans la démo d'un élève, Folio gratuit garde 5 livres : au-delà, « Nouveau livre » ouvre une fenêtre (ui/demo.js) */
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
  mail: () => { mailbox.list = null; mailPull(); go('mail'); },
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
  arreter();
  const role = quelRole({ role: myRole, eleveDeClasse: isPupil(), prof: myRole === 'prof', referent: myRole === 'ref' && atSchool() });
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

export function arreter() {
  clearInterval(minuteur); minuteur = 0;
  if (racine) { racine.remove(); racine = null; }
  document.documentElement.classList.remove('tu-actif');
  for (const [type, f] of GARDES) window.removeEventListener(type, f, true);
  document.body.removeEventListener('scroll', placer);
  removeEventListener('resize', placer);
  if (window.visualViewport) visualViewport.removeEventListener('resize', placer);
  t = null; setTuto(null);
}

function passer() {
  const m = t && t.debut && t.debut.passe;
  arreter();
  if (m) toast(I.bulb, m);
}

/* ---------- l'habillage ---------- */
function monter() {
  racine = document.createElement('div');
  racine.id = 'tu'; racine.className = 'tu';
  racine.innerHTML = '<i class="tu-voile"></i><i class="tu-spot"></i><i class="tu-anneau"></i>'
    + ['h', 'b', 'g', 'd', 'trou'].map(k => `<i class="tu-blk" data-c="${k}"></i>`).join('')
    + '<div class="tu-bulle" role="dialog" aria-live="polite" aria-labelledby="tut"></div><div class="tu-carte"></div>';
  document.body.appendChild(racine);
  document.documentElement.classList.add('tu-actif');
  racine.addEventListener('click', surClic);
  for (const [type, f] of GARDES) window.addEventListener(type, f, true);
  document.body.addEventListener('scroll', placer, { passive: true });
  addEventListener('resize', placer);
  if (window.visualViewport) visualViewport.addEventListener('resize', placer);
  minuteur = setInterval(tic, 120);
}

const bulle = () => racine && racine.querySelector('.tu-bulle');
const etape = () => t && t.liste[t.i];

/* ---------- d'une étape à l'autre ---------- */
function entrer(i) {
  if (!t || !racine) return;
  t.i = i;
  const e = t.liste[i];
  if (!e) return arreter();
  Object.assign(t, { depuis: Date.now(), navigue: 0, pause: 0, pret: 0, defile: 0, feuille: '', els: null, perdu: 0, retours: 0 });
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
  setTimeout(() => { if (t) { t.pause = 0; entrer(t.i + 1); } }, 320);
}

function tic() {
  if (!t || t.pause) return;
  const e = etape();
  if (!e || e.carte) return;
  observer();
  if (e.attend && atteint(e.attend)) return t.pret ? reussi() : entrer(t.i + 1);
  if (!t.pret) return preparer(e);
  if (perdue(e)) return;
  placer();
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
  if (!e.centre && !trouver(e)) { if (age > (e.geste ? GRACE_CIBLE : GRACE_MOT)) entrer(t.i + 1); return; }
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
  if (e.bouton === 'exemple') l.push(`<button class="tu-btn" data-tu="exemple">${svg(I.spark)}Remplir pour moi</button>`);
  if (!e.geste) l.push(`<button class="tu-btn pri" data-tu="suivant">Suivant${svg(I.arrow)}</button>`);
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
   (« info » : le trou fermé), un mot au centre ; « attente » quand l'étape
   se prépare ou se cherche : rien ne se touche. */
function peindre(e) {
  t.peint = Date.now();
  racine.dataset.mode = e.centre ? 'centre' : e.geste ? 'geste' : 'info';
  racine.dataset.voile = e.voile || '';
  racine.querySelector('.tu-carte').innerHTML = '';
  const b = bulle();
  b.innerHTML = bulleHtml(e);
  b.classList.remove('vue');
  calmerClavier();
  placer();
}

function attente() {
  racine.dataset.mode = 'attente';
  const b = bulle();
  if (b) b.classList.remove('vue');
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
   `union`, tout ce qu'il désigne (les deux codes d'un référent, au téléphone). */
function trouver(e) {
  for (const s of e.cible || []) {
    const l = [...document.querySelectorAll(s)].filter(visible);
    if (l.length) return e.union ? l : [l[0]];
  }
  return null;
}

function trouDe(e) {
  for (const s of e.trou || []) { const n = [...document.querySelectorAll(s)].find(visible); if (n) return [n]; }
  return null;
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

/* Le cadre de ce qu'on montre, amené à l'écran une fois s'il n'y est pas
   (c'est <body> qui défile) : sur la page, loin du bas où se posent les
   onglets et le bandeau de la démo ; dans une feuille, seulement s'il en
   sort (son pied, collé en bas, y est toujours). Une feuille, au ras de ses bords. */
function cadre(els, m, defiler) {
  const W = innerWidth, H = hauteur();
  let r = boite(els);
  const [haut, bas] = els[0].closest('.menu, #rail') ? [8, 8] : [64, 150];
  if (defiler && !t.defile && (r.top < haut || r.bottom > H - bas) && r.height < H * .7) {
    t.defile = 1; els[0].scrollIntoView({ block: 'center' }); r = boite(els);
  }
  const x = Math.max(4, r.left - m), y = Math.max(4, r.top - m);
  return { x, y, w: Math.min(W - 4, r.right + m) - x, h: Math.min(H - 4, r.bottom + m) - y };
}

const posEl = (n, x, y, w, h) => {
  n.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  n.style.width = Math.max(0, Math.round(w)) + 'px'; n.style.height = Math.max(0, Math.round(h)) + 'px';
};

/* La place de chacun : le trou sur ce qui reste éclairé, l'anneau sur la
   cible, les volets autour du trou (ils prennent les appuis), la bulle à côté. */
function placer() {
  if (!t || !racine || t.pause || !t.pret || t.perdu) return;
  const e = etape();
  if (!e || e.carte) return;
  const b = bulle();
  if (e.centre) return montrer(b, null, null, e);
  const els = trouver(e);
  if (!els) { t.els = null; b.classList.remove('vue'); return; }   // un instant ailleurs (un redessin) : on la retrouvera
  t.els = els;
  const anneau = cadre(els, 6, true), trou = trouDe(e);
  const box = trou ? cadre(trou, 0, false) : anneau;
  poser(box, anneau);
  montrer(b, box, anneau, e);
}

const montrer = (b, box, anneau, e) => { placerBulle(b, box, anneau, e); b.classList.add('vue'); };

function poser(box, anneau) {
  const W = innerWidth, H = innerHeight;
  posEl(racine.querySelector('.tu-spot'), box.x, box.y, box.w, box.h);
  posEl(racine.querySelector('.tu-anneau'), anneau.x, anneau.y, anneau.w, anneau.h);
  const v = (k, X, Y, w, h) => posEl(racine.querySelector(`[data-c="${k}"]`), X, Y, w, h);
  v('h', 0, 0, W, box.y); v('b', 0, box.y + box.h, W, H - box.y - box.h);
  v('g', 0, box.y, box.x, box.h); v('d', box.x + box.w, box.y, W - box.x - box.w, box.h);
  v('trou', box.x, box.y, box.w, box.h);
}

/* Au téléphone : toute la largeur, juste sous le trou ou juste dessus ;
   s'il prend tout l'écran (une feuille), en haut ou en bas, loin de
   l'anneau. Sur ordinateur : 340 px, à côté. Un mot au centre : au centre. */
function placerBulle(b, box, anneau, e) {
  const W = innerWidth, H = hauteur(), tel = W < 900, g = 12;
  const bw = Math.min(W - 24, tel ? W : 340);
  b.style.width = bw + 'px';
  const bh = b.offsetHeight || 150;
  let x, y;
  if (!box) { x = (W - bw) / 2; y = Math.max(g, (H - bh) / 2); }
  else if (tel) {
    x = g;
    const bas = box.y + box.h + g, haut = box.y - bh - g;
    y = bas + bh <= H - g ? bas : haut >= g ? haut : (anneau.y + anneau.h / 2 > H / 2 ? g + 6 : H - bh - g - 8);
  } else {
    const centre = Math.min(Math.max(g, box.x + box.w / 2 - bw / 2), W - bw - g);
    const essais = [
      [centre, box.y + box.h + 14], [centre, box.y - bh - 14],
      [box.x + box.w + 16, Math.min(Math.max(g, box.y), H - bh - g)], [box.x - bw - 16, Math.min(Math.max(g, box.y), H - bh - g)]
    ];
    [x, y] = essais.find(([X, Y]) => X >= g && Y >= g && X + bw <= W - g && Y + bh <= H - g) || [W - bw - 24, H - bh - 24];
  }
  b.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
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

function gardeFocus(ev) {
  const n = ev.target;
  if (!t || duTuto(n) || !n.matches || !n.matches(CHAMP) || !t.pret || t.pause || permis(n)) return;
  setTimeout(() => { if (t && document.activeElement === n) n.blur(); }, 0);
}

const GARDES = [['click', gardeClic], ['dblclick', gardeClic], ['auxclick', gardeClic], ['contextmenu', gardeClic],
  ['submit', gardeClic], ['pointerdown', gardeAppui], ['mousedown', gardeAppui], ['keydown', gardeTouche],
  ['beforeinput', gardeSaisie], ['focusin', gardeFocus]];

/* ---------- les cartes du début et de la fin ---------- */
function carteDebut() {
  const d = t.debut;
  return `<div class="tu-c tu-debut" role="dialog" aria-modal="true" aria-labelledby="tuct">
      <span class="tu-moi">${avatar(auth.uid, monIdent(), 'xl')}</span>
      <h2 id="tuct">${esc(d.titre)}</h2><p>${esc(d.texte)}</p>
      <button class="tu-go" data-tu="oui">${esc(d.oui)}${svg(I.arrow)}</button>
      <button class="tu-lien" data-tu="non">${esc(d.non)}</button>
    </div>`;
}

/* Folio+ et Folio Campus portent la marque du site : le « + » dans la
   lumière de la marque ; le logo sur son carré de papier, l'école en
   écusson dégradé, « Campus » en italique dégradée. */
const titreFin = f => (f.cle === 'plus' ? '<h2 id="tuct" class="tu-marque">Folio<span class="tu-plus">+</span></h2>'
  : f.cle === 'campus' ? `<h2 id="tuct" class="tu-campus"><span class="tu-campus-ic" aria-hidden="true">
        <img src="/site/logo.svg" alt="" width="30" height="33"><i>${svg(I.school)}</i></span><span>Folio <em>Campus</em></span></h2>`
  : `<span class="tu-ok">${svg(I.check)}</span><h2 id="tuct">${esc(f.titre)}</h2>`);

/* « tarifs » : la page des tarifs du site, dans un autre onglet — l'app
   reste ouverte derrière (?site : l'aiguillage du site garde la page
   d'accueil même avec une session) ; une fois la vente ouverte
   (VENTE_OUVERTE, src/abonnement.js), l'écran Folio+ de l'app, où l'on
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
      <p class="tu-sous">${esc(f.sous)}</p>
      <ul class="tu-points">${f.points.map(([ic, x]) => `<li>${svg(I[ic] || I.check)}<span>${esc(x)}</span></li>`).join('')}</ul>
      <div class="tu-actions">${f.actions.map(actionHtml).join('')}</div>
      ${f.note ? `<p class="tu-note">${esc(f.note)}</p>` : ''}
    </div>`;
}

function carte(k) {
  if (k === 'fin' && menu) closeMenu();
  racine.dataset.mode = 'carte';
  bulle().classList.remove('vue');
  const c = racine.querySelector('.tu-carte');
  c.innerHTML = k === 'debut' ? carteDebut() : carteFin();
  setTimeout(() => { const p = c.querySelector('.tu-go, .tu-a.pri'); if (p) p.focus({ preventScroll: true }); }, 60);
}

/* ---------- « Remplir pour moi » ----------
   Trois pages tirées de la matière choisie (ou de la première matière du
   compte, celle de l'accueil), et le titre qui va avec s'il n'y en a pas. */
function remplir() {
  const choisie = db.subjects.find(s => s.id === comp.subject) || db.subjects[0];
  if (!comp.subject && choisie) comp.subject = choisie.id;
  const ex = exemple(choisie ? choisie.name : '');
  if (!String(comp.name || '').trim()) comp.name = ex.titre;
  comp.cards.push(...ex.pages);
  render();
  // les pages sont là : pas de clavier qui surgit sur le champ du recto
  setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'INPUT') a.blur(); }, 90);
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
  plus: () => { arreter(); ouvrirPlus(); },
  exemple: () => { if (posee() && !comp.cards.length) remplir(); }
};

function surClic(ev) {
  const b = ev.target.closest('[data-tu]');
  if (!b) return rappel();
  if (b.dataset.tu === 'fin' && b.tagName === 'A') return arreter();     // le lien part de lui-même
  ev.preventDefault();
  const f = GESTES[b.dataset.tu];
  if (f && t) f(etape());
}

/* un appui à côté : l'anneau et la bulle le rappellent */
function rappel() {
  if (!racine) return;
  racine.classList.remove('rappel'); void racine.offsetWidth; racine.classList.add('rappel');
}
