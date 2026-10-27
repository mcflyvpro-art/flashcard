// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { auth, comp, compte, db, demoEtab, eleve, me, menu, myRole, prefs, prof, ref, setTuto, study, tuto, view } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { refPull } from '../core/classement.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { rangerClasses } from '../classe.js';
import { aideSelon, debutDe, etapes, exemple, finDe, quelRole } from '../tuto.js';
import { aUneClasse, allerClasses, go, monIdent, render } from './bibliotheque.js';
import { atSchool, isPupil } from './classement.js';
import { commuPull } from './cercle.js';
import { avatar } from './jeton.js';
import { beep, savePrefs, toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';
import { allerAccueil } from './prof-porte.js';
import './tuto.css';

/* ══════════ le tuto : le moteur (2026-10-27) ══════════
   Il joue un scénario de src/tuto.js sur le vrai écran : un voile, un trou
   sur ce qu'il faut toucher, un anneau qui pulse autour, une bulle courte.
   Pendant un geste, seul le trou répond ; l'étape finit quand ce qu'elle
   attend arrive (un écran, une page retournée, une feuille ouverte) — c'est
   la personne qui avance, le tuto la suit. Il se joue sur le vrai compte :
   le livre qu'on y crée est le sien, la page lue compte pour de vrai.

   Au téléphone la bulle se pose sous ou sur ce qu'on montre, de toute la
   largeur ; sur ordinateur, à côté. Rien ne coince : une étape dont l'écran
   n'est plus là passe, un geste qui ne mène à rien laisse paraître
   « Suivant », et le tuto se quitte à tout moment. Chargé à la demande par
   sa porte, ui/tuto-porte.js. */

let t = null;                 // le tuto en cours : { role, liste, i, demo, souris, lecture… }
let racine = null, minuteur = 0;

const attendre = ms => new Promise(r => setTimeout(r, ms));
const FEUILLE = ['.menu:not(.sort)'];

/* ---------- ce qu'on sait du compte au départ ---------- */
function drapeaux() {
  const classes = rangerClasses(prof.classes).actives;
  return {
    livres: db.decks.some(d => !d.hidden && d.cards.length),
    classe: aUneClasse(),
    surClasses: view.name === 'classes',
    devoir: (eleve.devoirs || []).some(d => d.etat !== 'rendu'),
    classes: classes.length > 0,
    etab: atSchool(),
    bande: !atSchool() || classes.length > 0,
    pc: matchMedia('(min-width: 900px)').matches
  };
}

/* Les devoirs, les classes d'un professeur, les codes du référent arrivent
   du réseau : le scénario se choisit une fois qu'ils sont là (3 s au plus). */
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
  return !!(study && l && (study.log.length > l.n0 || study.queue !== l.q0 || study.i !== l.i0));
};
const ATTEND = {
  vue: v => view.name === v,
  pages: n => comp.cards.length >= n,
  feuille: k => menu === k,
  onglet: k => view.name === 'profclasse' && prof.tab === k,
  ref: k => view.name === 'ref' && ref.tab === k,
  retournee: () => !!study && (study.flip || note()),
  notee: () => note(),
  fini: () => view.name !== 'study' || !study || study.i >= study.queue.length
};
const tient = a => Object.entries(a).every(([k, v]) => ATTEND[k](v));

/* La feuille ouverte, et laquelle : quand celle d'une étape fait place à une
   autre (« Nouvelle classe », puis « Ajouter des élèves »), l'étape est finie. */
const cleFeuille = () => `${menu}:${menu === 'pf' ? prof.feuille : ''}`;

/* ce qui doit tenir pendant l'étape : sinon elle passe */
const TANT = {
  bilan: () => view.name === 'study' && !!study && study.i >= study.queue.length,
  feuille: () => !!menu && !!document.querySelector('.menu:not(.sort)') && (!t.feuille || cleFeuille() === t.feuille),
  aLire: () => view.name === 'deck' && !!document.querySelector('.cta.read b')
};

/* Les écrans où le tuto sait mener ; un livre, une lecture, une classe
   ouverte : il suit la personne, il ne l'y ramène pas. */
const ALLER = {
  home: () => go('home'),
  classes: () => allerClasses(),
  commu: () => { commuPull(); go('commu'); },
  prof: () => allerAccueil(),
  ref: () => { refPull(); go('ref'); }
};

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
  t = { role, demo: !!demoEtab, d: drapeaux(), i: -1, souris: matchMedia('(hover: hover) and (pointer: fine)').matches };
  t.liste = etapes(role, t.d);
  t.debut = debutDe(role, { demo: t.demo, prenom: prenomDe(), classe: classeDe() });
  setTuto(t);
  // vu dès qu'il commence : un rechargement au milieu ne le relance pas, les Réglages le rejouent
  if (!prefs.tuto && !o.rejoue) { prefs.tuto = 1; savePrefs(); }
  monter();
  suivante();
}

export function arreter() {
  clearInterval(minuteur); minuteur = 0;
  if (racine) { racine.remove(); racine = null; }
  document.documentElement.classList.remove('tu-actif');
  document.removeEventListener('click', surToucheCible, true);
  document.removeEventListener('keydown', surTouche);
  document.body.removeEventListener('scroll', placer);
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
  document.addEventListener('click', surToucheCible, true);
  document.addEventListener('keydown', surTouche);
  document.body.addEventListener('scroll', placer, { passive: true });
  if (window.visualViewport) visualViewport.addEventListener('resize', placer);
  minuteur = setInterval(tic, 120);
}

const bulle = () => racine && racine.querySelector('.tu-bulle');

/* ---------- d'une étape à l'autre ---------- */
function suivante() {
  if (!t) return;
  t.i++;
  const e = t.liste[t.i];
  if (!e) return arreter();
  Object.assign(t, { depuis: Date.now(), navigue: 0, touche: 0, trouve: 0, pause: 0, defile: 0, feuille: '' });
  if (e.carte) return carte(e.carte);
  if (e.tant && !TANT[e.tant]()) return suivante();
  if (e.tant === 'feuille') t.feuille = cleFeuille();
  if (e.ecran && view.name !== e.ecran) {
    if (!ALLER[e.ecran]) return suivante();
    closeMenu(); ALLER[e.ecran](); t.navigue = Date.now();
  }
  if (e.attend && tient(e.attend)) return suivante();     // déjà fait : on n'y revient pas
  peindre(e);
}

/* Le geste a porté : on laisse voir ce qu'il a fait, puis on enchaîne. */
function reussi() {
  t.pause = 1;
  beep(true);
  racine.dataset.mode = 'pause';
  setTimeout(() => { if (t) { t.pause = 0; suivante(); } }, 320);
}

function tic() {
  if (!t || t.pause) return;
  const e = t.liste[t.i];
  if (!e || e.carte) return;
  if (view.name === 'study' && study && !t.lecture) t.lecture = { i0: study.i, q0: study.queue, n0: study.log.length };
  if (e.attend && tient(e.attend)) return e.geste || e.libre ? reussi() : suivante();
  if (perdue(e)) return suivante();
  placer();
  secours(e);
}

/* l'état qu'elle suppose n'est plus là (la feuille fermée), ou son écran
   n'est pas venu (on est parti ailleurs, il ne se charge pas) */
const perdue = e => !!((e.tant && !TANT[e.tant]())
  || (e.ecran && view.name !== e.ecran && Date.now() - (t.navigue || 0) > 4000));

function secours(e) {
  const b = bulle(), s = b && b.querySelector('.tu-secours');
  if (s && s.hidden && Date.now() - t.depuis > 12000) s.hidden = false;
  // touché, mais rien ne vient (rien à lire, hors ligne) : on n'attend pas indéfiniment
  if (e.geste && !e.saisie && t.touche && Date.now() - t.touche > 3500) suivante();
}

/* ---------- la bulle ---------- */
function points() {
  const l = t.liste.filter(e => !e.carte), k = t.liste.slice(0, t.i).filter(e => !e.carte).length;
  return l.map((_, i) => `<i class="${i < k ? 'fait' : i === k ? 'ici' : ''}"></i>`).join('');
}

function bulleHtml(e) {
  const aide = aideSelon(e.aide, t.souris);
  return `<div class="tu-haut"><span class="tu-pas" aria-hidden="true">${points()}</span>
      <button class="tu-x" data-tu="passer" aria-label="Quitter le tuto" title="Quitter le tuto">${svg(I.x)}</button></div>
    <b class="tu-t" id="tut">${esc(e.titre)}</b>
    ${e.texte ? `<p class="tu-p">${esc(e.texte)}</p>` : ''}
    ${e.geste && aide ? `<p class="tu-geste">${svg(I.pick)}<span>${esc(aide)}</span></p>` : ''}
    ${e.bouton || !e.geste ? `<div class="tu-b">
      ${e.bouton === 'exemple' ? `<button class="tu-btn" data-tu="exemple">${svg(I.spark)}Remplir pour moi</button>` : ''}
      ${!e.geste ? `<button class="tu-btn pri" data-tu="suivant">${e.libre ? 'Passer à la suite' : 'Suivant'}${svg(I.arrow)}</button>` : ''}
    </div>` : ''}
    ${e.geste ? `<div class="tu-b"><button class="tu-btn tu-secours" data-tu="suivant" hidden>Suivant${svg(I.arrow)}</button></div>` : ''}`;
}

/* Les modes : un geste (le trou ouvert sur la cible, l'anneau qui pulse),
   une feuille où l'on travaille (« ouvert » : le trou ouvert, sans anneau),
   un mot à lire (« info » : le trou fermé), une lecture libre (ni voile ni
   trou). */
function peindre(e) {
  racine.dataset.mode = e.libre ? 'libre' : e.geste ? 'geste' : e.tant === 'feuille' ? 'ouvert' : 'info';
  racine.dataset.voile = e.voile || '';
  racine.querySelector('.tu-carte').innerHTML = '';
  const b = bulle();
  b.innerHTML = bulleHtml(e);
  b.classList.remove('vue');
  placer();
}

/* ---------- viser ---------- */
function cible(e) {
  for (const s of e.cible || (e.tant === 'feuille' ? FEUILLE : [])) {
    for (const n of document.querySelectorAll(s)) {
      const r = n.getBoundingClientRect();
      if (r.width > 2 && r.height > 2 && !n.closest('#tu')) return n;
    }
  }
  return null;
}

const posEl = (n, x, y, w, h) => {
  n.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  n.style.width = Math.max(0, Math.round(w)) + 'px'; n.style.height = Math.max(0, Math.round(h)) + 'px';
};

/* La place de chacun : le trou et l'anneau sur la cible, les volets
   autour (ils prennent les appuis hors du trou), la bulle à côté. */
function placer() {
  if (!t || !racine || t.pause) return;
  const e = t.liste[t.i];
  if (!e || e.carte) return;
  const b = bulle();
  if (e.libre) return montrer(b, null, e);      // une lecture libre : ni trou ni cible, la bulle seule
  const el = cible(e);
  if (!el) return attendreCible(e, b);
  t.el = el;
  const box = cadre(el, e);
  poser(box);
  montrer(b, box, e);
}

const montrer = (b, box, e) => { placerBulle(b, box, innerWidth, innerHeight, e); b.classList.add('vue'); };

/* pas encore là (un écran qui se charge) ; un mot sans cible n'attend pas longtemps */
function attendreCible(e, b) {
  if (Date.now() - t.depuis > (e.geste ? 3000 : 1200) && Date.now() - (t.navigue || 0) > 1500) return suivante();
  b.classList.remove('vue');
}

/* Le cadre de la cible, amenée à l'écran une fois si elle n'y est pas
   (c'est <body> qui défile) ; une feuille, au ras de ses bords. */
function cadre(el, e) {
  const W = innerWidth, H = innerHeight;
  let r = el.getBoundingClientRect();
  if (!t.defile && !e.libre && (r.top < 64 || r.bottom > H - 64) && r.height < H * .7) {
    t.defile = 1; el.scrollIntoView({ block: 'center' }); r = el.getBoundingClientRect();
  }
  const m = e.tant === 'feuille' ? 0 : 6;
  const x = Math.max(4, r.left - m), y = Math.max(4, r.top - m);
  return { x, y, w: Math.min(W - 4, r.right + m) - x, h: Math.min(H - 4, r.bottom + m) - y };
}

function poser(box) {
  const W = innerWidth, H = innerHeight;
  for (const k of ['.tu-spot', '.tu-anneau']) posEl(racine.querySelector(k), box.x, box.y, box.w, box.h);
  const v = (k, X, Y, w, h) => posEl(racine.querySelector(`[data-c="${k}"]`), X, Y, w, h);
  v('h', 0, 0, W, box.y); v('b', 0, box.y + box.h, W, H - box.y - box.h);
  v('g', 0, box.y, box.x, box.h); v('d', box.x + box.w, box.y, W - box.x - box.w, box.h);
  v('trou', box.x, box.y, box.w, box.h);
}

/* Au téléphone : toute la largeur, juste sous la cible ou juste dessus,
   sinon du côté où il reste le plus de place. Sur ordinateur : 340 px, à
   côté de la cible. Une lecture libre : en haut, sous la barre. */
function placerBulle(b, box, W, H, e) {
  const bw = Math.min(W - 24, W < 900 ? W : 340), bh = b.offsetHeight || 150, g = 12;
  let x, y;
  if (e.libre) {
    const barre = document.querySelector('#app > .bar');
    x = W < 900 ? g : W - bw - 24;
    y = Math.max(g, barre ? barre.getBoundingClientRect().bottom + 8 : g);
  } else if (W < 900) {
    x = g;
    const bas = box.y + box.h + g, haut = box.y - bh - g;
    y = bas + bh < H - g ? bas : haut > g ? haut : (H - box.y - box.h > box.y ? H - bh - g - 8 : g + 6);
  } else {
    const centre = Math.min(Math.max(g, box.x + box.w / 2 - bw / 2), W - bw - g);
    const essais = [
      [centre, box.y + box.h + 14], [centre, box.y - bh - 14],
      [box.x + box.w + 16, Math.min(Math.max(g, box.y), H - bh - g)], [box.x - bw - 16, Math.min(Math.max(g, box.y), H - bh - g)]
    ];
    [x, y] = essais.find(([X, Y]) => X >= g && Y >= g && X + bw <= W - g && Y + bh <= H - g) || [W - bw - 24, H - bh - 24];
  }
  b.style.width = bw + 'px';
  b.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
}

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

const titreFin = f => (f.cle === 'plus' ? '<h2 id="tuct" class="tu-marque">Folio<span class="tu-plus">+</span></h2>'
  : f.cle === 'campus' ? `<span class="tu-campus"><img src="/site/logo.svg" alt="" width="34" height="36"><i>${svg(I.school)}</i></span>
      <h2 id="tuct">Folio Campus</h2>`
  : `<span class="tu-ok">${svg(I.check)}</span><h2 id="tuct">${esc(f.titre)}</h2>`);

/* « tarifs » : la page des tarifs du site, dans un autre onglet — l'app
   reste ouverte derrière (?site : l'aiguillage du site garde la page
   d'accueil même avec une session). */
function actionHtml(a) {
  const c = `tu-a${a.pri ? ' pri' : ''}`;
  if (a.fin) return `<button class="${c}" data-tu="fin">${esc(a.t)}</button>`;
  const href = a.href === 'tarifs' ? `${SITE}?site#tarifs` : a.href;
  const dehors = a.href === 'tarifs' ? ' target="_blank" rel="noopener"' : '';
  return `<a class="${c}" href="${esc(href)}" data-tu="fin"${a.partir ? ' data-dm="partir"' : ''}${dehors}>${esc(a.t)}${a.pri ? svg(I.arrow) : ''}</a>`;
}

function carteFin() {
  const f = finDe(t.role, { demo: t.demo });
  return `<div class="tu-c tu-fin ${f.cle}" role="dialog" aria-modal="true" aria-labelledby="tuct">
      ${titreFin(f)}
      <p class="tu-sous">${esc(f.sous)}</p>
      <ul class="tu-points">${f.points.map(([ic, x]) => `<li>${svg(I[ic] || I.check)}<span>${esc(x)}</span></li>`).join('')}</ul>
      <div class="tu-actions">${f.actions.map(actionHtml).join('')}</div>
      ${f.note ? `<p class="tu-note">${esc(f.note)}</p>` : ''}
    </div>`;
}

function carte(k) {
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

/* ---------- les gestes ---------- */
const avancer = e => { if (e && e.ferme && menu) closeMenu(); suivante(); };
const GESTES = { oui: avancer, suivant: avancer, non: passer, passer, fin: arreter, exemple: remplir };

function surClic(ev) {
  const b = ev.target.closest('[data-tu]');
  if (!b) return rappel(ev);
  if (b.dataset.tu === 'fin' && b.tagName === 'A') return arreter();     // le lien part de lui-même
  ev.preventDefault();
  const f = GESTES[b.dataset.tu];
  if (f) f(t && t.liste[t.i]);
}

/* un appui hors du trou : l'anneau et la bulle le rappellent */
function rappel(ev) {
  if (!racine || !ev.target.closest('.tu-blk')) return;
  racine.classList.remove('rappel'); void racine.offsetWidth; racine.classList.add('rappel');
}

/* un appui sur la cible : si rien n'en sort, tic() n'attend pas pour rien */
function surToucheCible(ev) {
  if (!t || !t.el || ev.target.closest('#tu')) return;
  if (t.el.contains(ev.target)) t.touche = Date.now();
}

function surTouche(ev) {
  if (!t) return;
  if (ev.key === 'Escape' && !menu) { ev.preventDefault(); passer(); return; }
  if (ev.key !== 'Enter' || (ev.target.closest && ev.target.closest('input,textarea,select,[contenteditable]'))) return;
  const e = t.liste[t.i];
  if (e && e.carte) {
    const p = racine.querySelector('.tu-go'); if (p) { ev.preventDefault(); p.click(); }
  } else if (e && !e.geste && !e.libre) { ev.preventDefault(); suivante(); }
}
