// @ts-nocheck
/* ══════════ la barre du bas, vivante (2026-11-16) ══════════
   Demandé, captures d'Instagram à l'appui : « plus de vie ; quand tu restes
   appuyé elle grossit un peu, devient fluide et glissable, vraiment
   fluide ». À l'appui, la pastille grossit (une loupe, plus haute que la
   barre) et vient sous le doigt ; elle le suit si l'on glisse, s'étire quand
   elle va vite, et l'icône qu'elle couvre s'allume. Au lâcher, elle se pose
   sur l'onglet du dessous, en ressort, et l'app l'ouvre.

   Refait le même jour, pour la fluidité (« saccadé, lent, on dirait buggé ») :
   - UNE seule barre, qui ne quitte jamais la page : le rendu en dessine une
     neuve à chaque écran, on la remplace aussitôt par celle qu'on voyait
     (`fondre`, en microtâche, avant la peinture) et l'on n'en recopie que ce
     qui change — l'onglet allumé, une pastille de nombre. La glissière, ses
     animations, le geste en cours ne sont plus jamais coupés ni raccordés ;
   - collée au doigt : la pastille suit sa position presque sans retard
     (seule la loupe a un ressort), plus de poursuite qui traîne derrière ;
   - la pose est une animation du compositeur (`sl.animate`) : elle file même
     pendant que l'app redessine tout l'écran, et la navigation part à
     l'image suivante, une fois la pose lancée ;
   - une seule propriété bouge : `transform` (position, loupe, étirement),
     sur un calque à part (`will-change`).
   Sûreté, sur iPhone : Safari adresse la suite d'un appui au nœud touché,
   même s'il a quitté la page ; la fin de l'appui s'écoute donc sur la fenêtre
   ET sur ce nœud, un nouvel appui principal clôt l'ancien, la fenêtre qui
   perd la main ou six secondes sans signe du doigt l'abandonnent.
   Chargé au calme après l'ouverture (prechauffer de ui/synchro-ecran.js) :
   le démarrage n'en paie rien ; avant, un appui reste un simple appui. Ni
   pendant le tuto, ni sans mouvement. */
import { $ } from '../racine.js';
import { tuto } from '../data/etat.js';
import { sansMouvement } from './mouvement.js';
import './barre.css';

const PAS = 74, BORD = 5;                  // la largeur d'un onglet, la marge de la barre (app.css)
const LOUPE_X = 0.13, LOUPE_Y = 0.22;      // de combien la pastille grossit sous le doigt
// la pose au lâcher : un ressort (il dépasse un peu, revient), sur le compositeur
// (2026-11-17 : « moins virevoltant » — elle dépasse à peine, elle ne rebondit plus)
const POSE = { duration: 420, easing: 'cubic-bezier(.3,1.22,.45,1)' };
// un onglet changé d'ailleurs (le balayage, un lien) : un glissé simple
const GLISSE = { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' };
let jeu = null, avale = null, pose = null;

const borne = (v, a, b) => Math.max(a, Math.min(b, v));
const tr = (x, sx = 1, sy = 1) => `translateX(${x.toFixed(2)}px) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
const lire = sl => { const m = new DOMMatrixReadOnly(getComputedStyle(sl).transform); return { x: m.m41, sx: m.a, sy: m.d }; };
const allume = nav => [...nav.querySelectorAll('button')].findIndex(b => b.classList.contains('on'));
const viser = (nav, i) => nav.querySelectorAll('button').forEach((b, k) => b.classList.toggle('vise', k === i));

/* ---------- la pose : une animation du compositeur ---------- */
// une pose annulée (le balayage prend la pastille, ui/balayage-geste.js) n'est plus en route
const enRoute = () => (pose && pose.anim.playState !== 'running' ? (pose = null) : pose);

function figer(sl) {
  if (!enRoute() || pose.sl !== sl) return;
  const l = lire(sl), p = pose;
  pose = null;
  p.anim.cancel();
  sl.style.transform = tr(l.x, l.sx, l.sy);
}

function poser(sl, x, opts) {
  let de = sl.style.transform;
  if (pose || !de) { const l = lire(sl); de = tr(l.x, l.sx, l.sy); }
  figer(sl);
  // sous l'animation, la valeur au repos ; aucune transition CSS ne doit la
  // prendre (une transition passe devant une animation)
  sl.style.transition = 'none';
  sl.style.transform = `translateX(${x}px)`;
  const anim = sl.animate([{ transform: de }, { transform: tr(x) }], opts);
  pose = { sl, anim, x };
  anim.onfinish = () => {
    if (pose && pose.anim === anim) pose = null;
    sl.style.transition = '';
    const nav = sl.parentNode;
    if (!nav || (jeu && !jeu.fin)) return;
    viser(nav, -1);
    // la vérité est l'onglet ouvert : un appui qui n'a rien ouvert (refusé,
    // ou déjà là) ne laisse jamais la pastille ailleurs
    const on = allume(nav);
    if (on >= 0 && Math.abs(on * PAS - x) > 0.5) poser(sl, on * PAS, GLISSE);
  };
}

/* ---------- une seule barre ----------
   Le rendu remplace tout #app ; la barre qu'on voyait revient à sa place
   avant la peinture, et prend de la neuve ce qui a changé. */
function recopier(de, vers, sauf) {
  for (const a of de.getAttributeNames()) if (!sauf.includes(a) && vers.getAttribute(a) !== de.getAttribute(a)) vers.setAttribute(a, de.getAttribute(a));
}

function onglets(v, n) {
  const bv = [...v.querySelectorAll('button')], bn = [...n.querySelectorAll('button')];
  if (bv.length !== bn.length || bv.some((b, i) => b.dataset.act !== bn[i].dataset.act)) {
    bv.forEach(b => b.remove());
    v.append(...bn);
    return;
  }
  // les mêmes onglets : on garde les nœuds (celui sous le doigt reste dans la page)
  bv.forEach((b, i) => {
    const m = bn[i], vise = b.classList.contains('vise');
    if (b.className !== m.className) { b.className = m.className; b.classList.toggle('vise', vise); }
    recopier(m, b, ['class']);
    if (b.innerHTML !== m.innerHTML) b.innerHTML = m.innerHTML;
  });
}

function fondre(v, n) {
  v.className = n.className;
  v.classList.remove('neuf');
  // appuyée seulement si un doigt est vraiment là (jamais recopiée d'ailleurs)
  v.classList.toggle('presse', !!(jeu && !jeu.fin && jeu.sl.parentNode === v));
  recopier(n, v, ['class', 'style']);
  onglets(v, n);
  const sl = v.querySelector('.sl'), ns = n.querySelector('.sl');
  if (sl && ns) suivre(sl, parseFloat((ns.style.transform.match(/-?[\d.]+/) || ['0'])[0]));
}

// la glissière vers l'onglet que dit le rendu, sauf si le doigt décide
function suivre(sl, x) {
  if (jeu && !jeu.fin && jeu.sl === sl) return;
  enRoute();
  if (pose && pose.sl === sl && Math.abs(pose.x - x) < 0.5) return;   // déjà en route
  if (!pose && Math.abs(lire(sl).x - x) < 0.5) { sl.style.transform = `translateX(${x}px)`; return; }
  poser(sl, x, pose ? POSE : GLISSE);
}

const veilleur = new MutationObserver(recs => {
  if (tuto) return;
  let vieille = null, neuve = null;
  for (const r of recs) {
    for (const n of r.removedNodes) if (n.nodeType === 1 && n.classList.contains('tabs')) vieille = n;
    for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList.contains('tabs')) neuve = n;
  }
  if (!vieille || !neuve || vieille.isConnected || !neuve.isConnected) return;
  neuve.replaceWith(vieille);
  veilleur.takeRecords();                             // l'échange lui-même n'est pas un rendu
  fondre(vieille, neuve);
});
veilleur.observe($, { childList: true });
// la glissière d'un rendu n'est plus animée par ui/mouvement.js : c'est celle-ci qui reste
document.documentElement.classList.add('barre-vive');

/* ---------- le geste ---------- */
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
  // le clic natif d'un appui arrive toujours avant l'appui suivant
  avale = null;
  const sl = nav.querySelector('.sl'), boutons = [...nav.querySelectorAll('button')];
  if (!sl || boutons.length < 2) return;
  figer(sl);                                          // une pose en cours s'arrête là où on la voit
  const l = lire(sl), r = nav.getBoundingClientRect(), bouton = e.target.closest('button'), t = performance.now();
  jeu = { nav, sl, bouton, noeud: e.target, appuye: boutons.indexOf(bouton), x0: e.clientX,
    gauche: r.left + BORD + PAS / 2, max: (boutons.length - 1) * PAS, p: l.x, v: 0,
    g: borne((l.sx - 1) / LOUPE_X, 0, 1), vg: 0, glisse: false, fin: false, vise: -1, t, vu: t, id: e.pointerId };
  jeu.cible = borne(e.clientX - jeu.gauche, 0, jeu.max);
  sl.style.transition = 'none';
  nav.classList.add('presse');
  ecouter(jeu, true);
  const j = jeu;
  requestAnimationFrame(t2 => image(t2, j));
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

/* La fin d'un appui : lâché (on ouvre l'onglet du dessous) ou abandonné (la
   pastille revient sur l'onglet ouvert). */
function finir(j, lache) {
  ecouter(j, false);
  j.fin = true;
  const nav = j.sl.parentNode || $.querySelector('.tabs');
  const ici = nav ? allume(nav) : -1;
  const i = arrivee(j, lache, nav ? nav.querySelectorAll('button').length : 0, ici);
  for (const n of [...$.querySelectorAll('.tabs.presse'), j.nav, nav]) n?.classList.remove('presse');
  if (nav) viser(nav, lache ? i : -1);               // l'icône d'arrivée allumée jusqu'à l'écran neuf
  if (j.sl.isConnected) poser(j.sl, i * PAS, POSE);
  if (lache) ouvrir(j, i, ici);
}

// abandonné : l'onglet ouvert ; glissé : celui du dessous ; touché : celui touché
function arrivee(j, lache, n, ici) {
  if (!lache || (!j.glisse && j.appuye < 0)) return Math.max(0, ici);
  return borne(j.glisse ? Math.round(j.cible / PAS) : j.appuye, 0, n - 1);
}

/* L'onglet s'ouvre à l'image suivante, une fois la pose lancée ; le clic
   natif du bouton touché, s'il vient, est avalé (le nôtre le remplace). */
function ouvrir(j, i, ici) {
  avale = j.bouton;
  addEventListener('click', avaler, true);
  setTimeout(() => { avale = null; removeEventListener('click', avaler, true); }, 500);
  if (j.glisse ? i === ici : j.appuye < 0) return;
  requestAnimationFrame(() => { const b = $.querySelectorAll('.tabs button')[i]; if (b) b.click(); });
}

function avaler(e) {
  // le clavier (detail 0) n'est jamais avalé, ni un autre bouton que celui touché
  if (!avale || !e.isTrusted || !e.detail || e.target.closest?.('button') !== avale) return;
  e.stopPropagation(); e.preventDefault();
  avale = null;
  removeEventListener('click', avaler, true);
}

// la fenêtre perd la main (une autre app, un appel) : le doigt ne reviendra pas
const abandon = () => { if (jeu && !jeu.fin) finir(jeu, false); };
addEventListener('blur', abandon);
document.addEventListener('visibilitychange', () => { if (document.hidden) abandon(); });

/* Tant que le doigt est là : la position colle au doigt (à peine lissée), la
   loupe gonfle sur un ressort, la vitesse étire. Une seule écriture par
   image, `transform`. */
function image(t, j) {
  if (jeu !== j || j.fin) return;
  if (!j.sl.isConnected) { finir(j, false); return; }
  if (t - j.vu > 6000) { finir(j, false); return; }   // garde-fou : six secondes sans signe du doigt
  const dt = Math.min(2, Math.max(0.25, (t - j.t) / 16.67)); j.t = t;
  const avant = j.p;
  j.p += (j.cible - j.p) * (1 - Math.pow(0.35, dt));
  j.v = (j.p - avant) / dt;
  j.vg = (j.vg + (1 - j.g) * 0.3 * dt) * Math.pow(0.6, dt);
  j.g += j.vg * dt;
  const e = Math.min(0.16, Math.abs(j.v) / 70);
  j.sl.style.transform = tr(j.p, 1 + LOUPE_X * j.g + e, 1 + LOUPE_Y * j.g - e * 0.6);
  const vise = Math.round(j.p / PAS);
  if (vise !== j.vise) { viser(j.sl.parentNode, vise); j.vise = vise; }
  requestAnimationFrame(t2 => image(t2, j));
}

document.addEventListener('pointerdown', demarrer);
