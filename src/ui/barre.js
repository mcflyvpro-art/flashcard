// @ts-nocheck
/* ══════════ la barre du bas, vivante (2026-11-16) ══════════
   Demandé, captures d'Instagram à l'appui : « plus de vie ; quand tu restes
   appuyé elle grossit un peu, devient fluide et glissable, vraiment
   fluide ». À l'appui, la pastille de l'onglet allumé grossit et part
   sous le doigt ; elle le suit si l'on glisse, sur un ressort (elle
   dépasse un peu et revient, et s'étire quand elle va vite) ; l'icône
   qu'elle couvre s'allume. Au lâcher, elle se pose sur l'onglet du
   dessous, et l'app l'ouvre.
   Le rendu redessine la barre à chaque écran : la glissière neuve part
   de là où l'on voyait l'ancienne (glisserOnglet de ui/mouvement.js lit sa
   position), et sa détente reprend au même point (`.relache`, son
   décalage négatif) — rien ne saute.
   Chargé au calme après l'ouverture (prechauffer de ui/synchro-ecran.js) :
   le démarrage n'en paie rien ; avant, un appui reste un simple appui.
   Ni pendant le tuto (un onglet qu'il ne montre pas ne s'ouvre pas en
   glissant), ni sans mouvement. */
import { $ } from '../racine.js';
import { tuto } from '../data/etat.js';
import { sansMouvement } from './mouvement.js';
import './barre.css';

const PAS = 74, BORD = 5;          // la largeur d'un onglet, la marge de la barre (app.css)
const DETENTE = 420;               // la durée de `.relache` (barre.css)
const RESSORT = 'scale .32s cubic-bezier(.34,1.32,.5,1)';
let jeu = null, lache = -1e9, avale = null;

const borne = (v, a, b) => Math.max(a, Math.min(b, v));

/* Le geste ne doit JAMAIS rester coincé (2026-11-16, « quand je harcèle le
   bouton, ça part en vrille ») : sur iPhone, Safari adresse toute la suite
   d'un appui au nœud touché, même quand la barre a été redessinée entre-temps
   et que ce nœud a quitté la page — le lâcher ne remontait plus jusqu'à la
   fenêtre, la pastille restait grossie et plus aucun appui ne répondait. On
   écoute donc la fin de l'appui à la fois sur la fenêtre et sur le nœud
   touché ; un nouvel appui principal veut dire que l'ancien doigt est parti
   (il n'y en a qu'un à la fois) ; la fenêtre qui perd la main, ou six secondes
   sans signe du doigt, l'abandonnent. */
const FIN = ['pointerup', 'pointercancel'];
function ecouter(j, oui) {
  const f = oui ? 'addEventListener' : 'removeEventListener';
  for (const c of [window, j.noeud]) {
    if (!c) continue;
    c[f]('pointermove', bouger, { passive: true });
    for (const t of FIN) c[f](t, lacher);
  }
}

function demarrer(e) {
  const nav = e.target.closest('.tabs');
  if (!nav || e.button > 0 || !e.isPrimary || tuto || sansMouvement()) return;
  if (jeu && !jeu.fin) {
    if (e.pointerId === jeu.id) return;
    finir(jeu, false);                                // l'ancien doigt est parti sans qu'on l'ait vu
  }
  // le clic natif d'un appui arrive toujours avant l'appui suivant : un nouvel
  // appui n'a plus rien à avaler (sinon son propre clic l'était)
  avale = null;
  const sl = nav.querySelector('.sl'), boutons = [...nav.querySelectorAll('button')];
  if (!sl || boutons.length < 2) return;
  const r = nav.getBoundingClientRect(), bouton = e.target.closest('button');
  const p = new DOMMatrixReadOnly(getComputedStyle(sl).transform).m41, maintenant = performance.now();
  jeu = { nav, sl, boutons, bouton, noeud: e.target, appuye: boutons.indexOf(bouton), x0: e.clientX,
    gauche: r.left + BORD + PAS / 2, max: (boutons.length - 1) * PAS, p, v: 0, glisse: false, fin: false, vise: -1,
    t: maintenant, vu: maintenant, id: e.pointerId };
  jeu.cible = borne(e.clientX - jeu.gauche, 0, jeu.max);
  for (const x of [nav, sl]) { x.classList.remove('relache'); x.style.animationDelay = ''; }
  sl.style.transform = `translateX(${p}px)`;          // là où on la voit, avant de couper sa transition
  sl.style.transition = RESSORT;
  nav.classList.add('presse');
  ecouter(jeu, true);
  const j = jeu;
  requestAnimationFrame(t => image(t, j));
}

function bouger(e) {
  const j = jeu;
  if (!j || e.pointerId !== j.id || j.fin) return;
  j.vu = performance.now();
  if (Math.abs(e.clientX - j.x0) > 8) j.glisse = true;
  j.cible = borne(e.clientX - j.gauche, 0, j.max);
}

function lacher(e) {
  const j = jeu;
  if (!j || e.pointerId !== j.id || j.fin) return;
  finir(j, e.type === 'pointerup');
}

/* La barre redessinée pendant l'appui : le geste passe sur la neuve. */
function actualiser(j) {
  if (j.sl.isConnected) return true;
  const nav = $.querySelector('.tabs'), sl = nav && nav.querySelector('.sl');
  if (!sl) return false;
  Object.assign(j, { nav, sl, boutons: [...nav.querySelectorAll('button')], vise: -1 });
  if (!j.fin) { nav.classList.add('presse'); sl.style.transition = RESSORT; }
  return true;
}

/* La fin d'un appui : lâché (on ouvre l'onglet du dessous) ou abandonné (la
   pastille revient sur l'onglet ouvert). */
function finir(j, lache_) {
  ecouter(j, false);
  actualiser(j);
  const ici = j.boutons.findIndex(b => b.classList.contains('on'));
  const i = !lache_ ? Math.max(0, ici)
    : j.glisse ? Math.round(j.cible / PAS) : borne(j.appuye < 0 ? Math.max(0, ici) : j.appuye, 0, j.boutons.length - 1);
  j.cible = i * PAS; j.fin = true;
  lache = performance.now();
  for (const n of $.querySelectorAll('.tabs.presse')) n.classList.remove('presse');
  for (const b of $.querySelectorAll('.tabs button.vise')) b.classList.remove('vise');
  j.sl.classList.add('relache');
  j.nav.classList.add('relache-vu');                 // la barre qui reste se détend par sa transition
  suivreRendu();
  if (!lache_) return;
  // glissé : on ouvre l'onglet du dessous ; touché, mais le bouton touché a
  // quitté la page (redessinée sous le doigt) : son clic natif ne viendra pas,
  // on l'ouvre aussi. Le clic natif qui viserait encore le bouton du départ
  // est avalé — lui seul (un appui rapide qui suit, sur un autre onglet, passe).
  const perdu = !j.bouton || !j.bouton.isConnected;
  if (j.glisse ? i !== ici : perdu) j.boutons[i].click();
  if (j.glisse || perdu) {
    avale = { bouton: j.bouton, perdu, jusqua: lache + 400 };
    addEventListener('click', avaler, true);
    setTimeout(() => { avale = null; removeEventListener('click', avaler, true); }, 400);
  }
}

function avaler(e) {
  const a = avale;
  if (!a || !e.isTrusted || performance.now() > a.jusqua || !e.detail) return;     // le clavier (detail 0) passe toujours
  const b = e.target.closest?.('button');
  if (a.bouton && a.bouton.isConnected ? b !== a.bouton : !(a.perdu && e.target.closest?.('.tabs'))) return;
  e.stopPropagation(); e.preventDefault();
  avale = null;
  removeEventListener('click', avaler, true);
}

// la fenêtre perd la main (une autre app, un appel) : le doigt ne reviendra pas
const abandon = () => { if (jeu && !jeu.fin) finir(jeu, false); };
addEventListener('blur', abandon);
document.addEventListener('visibilitychange', () => { if (document.hidden) abandon(); });

/* La barre redessinée pendant la détente : sa glissière et sa barre
   reprennent l'animation au point où en étaient les anciennes. L'observateur
   passe en microtâche, avant que la page ne soit peinte. */
let veille = null;
function suivreRendu() {
  if (veille) return;
  veille = new MutationObserver(() => {
    const reste = DETENTE - (performance.now() - lache);
    if (reste <= 0) { veille.disconnect(); veille = null; return; }
    for (const n of $.querySelectorAll('.tabs:not(.relache-vu)')) {
      n.classList.add('relache-vu');
      const sl = n.querySelector('.sl');
      for (const x of [n, sl]) if (x) { x.style.animationDelay = `${reste - DETENTE}ms`; x.classList.add('relache'); }
    }
  });
  veille.observe($, { childList: true, subtree: true });
  setTimeout(() => { if (veille) { veille.disconnect(); veille = null; } }, DETENTE + 50);
}

/* Un ressort amorti : la pastille rattrape sa cible, la dépasse un peu,
   revient ; sa vitesse l'étire. Elle s'arrête quand elle est posée, ou quand
   la barre a été redessinée après le lâcher (la glissière neuve glisse
   d'elle-même, de la bonne place). Chaque geste a sa boucle : celle d'un
   geste remplacé s'arrête. */
const allume = j => j.boutons.findIndex(b => b.classList.contains('on'));
function image(t, j) {
  if (jeu !== j) return;
  // redessinée : pendant l'appui le geste passe sur la neuve ; après le lâcher,
  // c'est une navigation, la glissière neuve glisse d'elle-même
  if (!j.sl.isConnected && (j.fin || !actualiser(j))) { jeu = null; return; }
  if (!j.fin && t - j.vu > 6000) finir(j, false);     // garde-fou : six secondes sans signe du doigt
  const dt = Math.min(2, (t - j.t) / 16.67); j.t = t;
  // la vérité est l'onglet ouvert : un appui qui n'a rien ouvert (un clic
  // refusé, l'onglet où l'on est) ne laisse jamais la pastille ailleurs
  if (j.fin && t - lache > 180) { const on = allume(j); if (on >= 0) j.cible = on * PAS; }
  j.v = (j.v + (j.cible - j.p) * 0.2 * dt) * Math.pow(0.7, dt);
  j.p += j.v * dt;
  j.sl.style.transform = `translateX(${j.p.toFixed(2)}px)`;
  j.sl.style.setProperty('--etire', Math.min(0.2, Math.abs(j.v) / 70).toFixed(3));
  const vise = j.fin ? -1 : Math.round(j.p / PAS);
  if (vise !== j.vise) {
    j.boutons.forEach((b, k) => b.classList.toggle('vise', k === vise));
    j.vise = vise;
  }
  if (j.fin && Math.abs(j.cible - j.p) < 0.4 && Math.abs(j.v) < 0.06) {
    j.sl.style.transform = `translateX(${j.cible}px)`;
    j.sl.style.removeProperty('--etire');
    j.sl.style.transition = '';
    jeu = null;
    return;
  }
  requestAnimationFrame(t2 => image(t2, j));
}

document.addEventListener('pointerdown', demarrer);
