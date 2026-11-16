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
let jeu = null, lache = -1e9;

const borne = (v, a, b) => Math.max(a, Math.min(b, v));

function demarrer(e) {
  const nav = e.target.closest('.tabs');
  if (!nav || jeu || e.button > 0 || !e.isPrimary || tuto || sansMouvement()) return;
  const sl = nav.querySelector('.sl'), boutons = [...nav.querySelectorAll('button')];
  if (!sl || boutons.length < 2) return;
  const r = nav.getBoundingClientRect();
  const appuye = boutons.indexOf(e.target.closest('button'));
  const p = new DOMMatrixReadOnly(getComputedStyle(sl).transform).m41;
  jeu = { nav, sl, boutons, x0: e.clientX, gauche: r.left + BORD + PAS / 2, max: (boutons.length - 1) * PAS,
    appuye, p, v: 0, cible: p, glisse: false, fin: false, vise: -1, t: performance.now(), id: e.pointerId };
  jeu.cible = borne(e.clientX - jeu.gauche, 0, jeu.max);
  for (const x of [nav, sl]) { x.classList.remove('relache'); x.style.animationDelay = ''; }
  sl.style.transition = RESSORT;
  nav.classList.add('presse');
  addEventListener('pointermove', bouger, { passive: true });
  addEventListener('pointerup', lacher);
  addEventListener('pointercancel', lacher);
  requestAnimationFrame(image);
}

function bouger(e) {
  const j = jeu;
  if (!j || e.pointerId !== j.id || j.fin) return;
  if (Math.abs(e.clientX - j.x0) > 8) j.glisse = true;
  j.cible = borne(e.clientX - j.gauche, 0, j.max);
}

function lacher(e) {
  const j = jeu;
  if (!j || e.pointerId !== j.id || j.fin) return;
  removeEventListener('pointermove', bouger);
  removeEventListener('pointerup', lacher);
  removeEventListener('pointercancel', lacher);
  const ici = j.boutons.findIndex(b => b.classList.contains('on'));
  const i = e.type === 'pointercancel' ? Math.max(0, ici)
    : j.glisse ? Math.round(j.cible / PAS) : (j.appuye < 0 ? Math.max(0, ici) : j.appuye);
  j.cible = i * PAS; j.fin = true;
  lache = performance.now();
  j.nav.classList.remove('presse');
  j.sl.classList.add('relache');
  j.nav.classList.add('relache-vu');                 // la barre qui reste se détend par sa transition
  suivreRendu();
  // glissé : on ouvre l'onglet du dessous, et le clic natif, qui viserait
  // le bouton du départ, est avalé (seulement lui : dans la barre, de suite)
  if (j.glisse && e.type === 'pointerup') {
    if (i !== ici) j.boutons[i].click();
    addEventListener('click', avaler, true);
    setTimeout(() => removeEventListener('click', avaler, true), 400);
  }
}

function avaler(e) {
  if (!e.isTrusted || performance.now() - lache > 400 || !e.target.closest?.('.tabs')) return;
  e.stopPropagation(); e.preventDefault();
  removeEventListener('click', avaler, true);
}

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
   la barre a été redessinée (la glissière neuve glisse d'elle-même). */
function image(t) {
  const j = jeu;
  if (!j) return;
  const dt = Math.min(2, (t - j.t) / 16.67); j.t = t;
  j.v = (j.v + (j.cible - j.p) * 0.2 * dt) * Math.pow(0.7, dt);
  j.p += j.v * dt;
  if (!j.sl.isConnected) { jeu = null; return; }
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
  requestAnimationFrame(image);
}

document.addEventListener('pointerdown', demarrer);
