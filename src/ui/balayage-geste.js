// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { auth, cercle, comp, menu, reorder, setView, tuto, view } from '../data/etat.js';
import { allerOnglet, defilementDe, ordreOnglets, retourLivre, vueOnglet } from './bibliotheque.js';
import { paintMedia } from './carte-media.js';
import { entreeEcran } from './mouvement.js';
import './balayage.css';

/* ══════════ le balayage entre onglets, au doigt (téléphone) ══════════
   Paquets ↔ Classe ↔ Mes amis, comme d'un écran à l'autre dans une app
   native : la page suit le doigt, la voisine entre par le bord, déjà
   dessinée, à sa position de défilement. On la lâche passé un peu moins de
   la moitié de l'écran, ou plus tôt d'un geste vif ; sinon tout revient.
   Sur ordinateur (souris, ou fenêtre de 900 px et plus) rien ne glisse.

   Refait le 2026-11-17 (demandé : « quand je swipe très vite, la barre
   bugue ; ce n'est pas vraiment deux écrans, c'est rafistolé, latent ; à
   la Instagram, TikTok, un vrai swipe propre et fluide ») :
   - rien ne se dessine sous le doigt. Les deux voisines sont prêtes
     d'avance, au calme, en nœuds détachés du document (`preparer`) ; le
     geste n'a plus qu'à les poser. Avant, la voisine se rendait en entier
     au premier mouvement : une image figée au départ de chaque geste ;
   - la page qu'on quitte devient la voisine de la nouvelle, telle quelle
     (`recycler`) : revenir aussitôt ne dessine rien non plus ;
   - un geste fait pendant que la page finit sa course la rattrape où elle
     est (`rattraper`) au lieu d'être perdu : huit balayages rapides, huit
     changements — avant, un sur deux tombait dans le vide et l'on finissait
     sur le mauvais onglet ;
   - la pastille de la barre suit la page, et jamais sous une animation de
     la barre (ui/barre.js), qui la figeait sous le doigt ;
   - la page ne dépasse jamais sa voisine, et rien ne bouge au bout.
   Chargé à la première page à onglets par sa porte (ui/balayage.js). */

const LARGE = matchMedia('(min-width: 900px)');
const PAS = 74;                         // largeur d'un bouton d'onglet (.tabs button)
const COURBE = 'cubic-bezier(.22,.8,.26,1)';
const auCalme = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 120));

let fantome = false;                    // une vue s'écrit pour l'aperçu : elle ne rebranche pas le geste
let g = null;                           // le geste en cours, ou la page qui finit sa course
const prets = new Map();                // onglet → sa voisine prête (nœuds détachés)
let attente = 0;
const moi = () => auth && auth.uid;

/* ---------- les voisines ---------- */
function rendre(k) {
  let html = '';
  const avant = view;
  fantome = true; setView({ name: k, id: null });
  Object.defineProperty($, 'innerHTML', { configurable: true, get: () => html, set: v => { html = v; } });
  try { vueOnglet(k)(); }
  catch (e) { html = ''; console.warn('aperçu', k, e); }   // sans aperçu, la page reste où elle est
  finally { delete $.innerHTML; fantome = false; setView(avant); }
  return html;
}

/* Une voisine : une couche fixe qui ne déborde jamais de l'écran, la page
   dedans, sans identifiants (ceux de la vraie page). Sa barre du bas ne se
   montre que sous un retour au doigt (`.avec-barre`) : entre onglets, la
   vraie barre reste en place. */
function couche(k, html, noeuds) {
  const clip = document.createElement('div');
  clip.className = 'balai';
  clip.setAttribute('aria-hidden', 'true');
  clip.innerHTML = `<div class="balai-v"><div class="balai-app" data-view="${k}">${html || ''}</div></div>`;
  const app = clip.querySelector('.balai-app');
  if (noeuds) app.append(...noeuds);
  app.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  if (html) paintMedia(app);
  return { k, html, qui: moi(), clip, v: clip.firstElementChild, app, c: 0 };
}

const voisins = () => {
  const o = ordreOnglets(), i = o.indexOf(view.name);
  return i < 0 ? [destRetour()].filter(Boolean) : [o[i + 1], o[i - 1]].filter(Boolean);
};

/* Au calme, une voisine à la fois : rendue, comparée à celle qu'on a, et
   refaite seulement si elle a changé. Jamais pendant un geste. */
function preparer() {
  attente = 0;
  if (g || document.hidden || LARGE.matches) return;
  for (const k of voisins()) {
    const n = prets.get(k), sien = n && n.qui === moi();
    if (sien && (n.html || n.neuve) && !n.vieux) continue;
    const html = rendre(k);
    if (!html) continue;
    if (sien && n.html === html) { n.vieux = false; continue; }
    prets.set(k, couche(k, html));
    planifier();                        // la suivante au prochain moment calme
    return;
  }
}

function planifier(vieillir) {
  if (vieillir) for (const n of prets.values()) n.vieux = true;
  if (attente) return;
  attente = setTimeout(() => auCalme(preparer), 260);
}
// des données arrivées pour un autre onglet (core/memoire-ecrans.js) : sa voisine se refera
document.addEventListener('folio:donnees', () => planifier(true));

/* La voisine posée à côté de la page, à la hauteur où elle reprendra
   (render() → placerDefilement()). */
function montrer(k, c) {
  let n = prets.get(k);
  if (!n || n.qui !== moi()) { n = couche(k, rendre(k)); if (!n.html) return null; prets.set(k, n); }
  const r = $.getBoundingClientRect(), cs = getComputedStyle($);
  const haut = r.top + document.body.scrollTop;
  Object.assign(n.app.style, { left: r.left + 'px', width: r.width + 'px', padding: cs.padding });
  n.v.style.transition = 'none';
  document.body.appendChild(n.clip);
  const max = Math.max(0, haut + n.app.offsetHeight - innerHeight);
  n.app.style.top = (haut - Math.min(defilementDe(k), max)) + 'px';
  n.c = c;
  return n;
}

function cacher(n) {
  if (!n) return;
  n.clip.remove();
  n.clip.classList.remove('avec-barre');
  for (const x of [n.clip, n.v]) { x.style.transform = ''; x.style.transition = ''; }
  if (n.voile) { n.voile.remove(); n.voile = null; }
}

/* La page qu'on quitte devient la voisine de la nouvelle : ses nœuds
   détachés par le rendu, remis à zéro. */
function recycler(k, noeuds) {
  for (const n of noeuds) { n.style.transform = ''; n.style.transition = ''; n.style.willChange = ''; }
  const n = couche(k, '', noeuds);
  n.app.querySelectorAll('[data-k].neuf').forEach(x => x.classList.remove('neuf'));   // seulement la marque d'une entrée (ui/mouvement.js)
  n.neuve = true;                       // la vraie page à l'instant : rien à refaire au calme, sauf si les données bougent
  prets.set(k, n);
}

/* Quand un onglet laisse la place à un autre écran — un onglet voisin, un
   paquet, les réglages —, ses nœuds, ôtés par le rendu, sont la page exacte
   qu'on vient de voir, à sa position de défilement : ils deviennent sa
   couche prête, pour le balayage comme pour le retour au doigt. */
new MutationObserver(recs => {
  if (g || r || fantome) return;
  const a = recs.find(x => x.type === 'attributes');
  if (!a || a.oldValue === $.dataset.view || !ordreOnglets().includes(a.oldValue)) return;
  const partis = [];
  for (const x of recs) for (const n of x.removedNodes) if (n.nodeType === 1 && !n.isConnected) partis.push(n);
  if (partis.length) recycler(a.oldValue, partis);
}).observe($, { childList: true, attributes: true, attributeFilter: ['data-view'], attributeOldValue: true });

/* ---------- ce qui bouge ---------- */
const bouge = () => [...$.children].filter(n => !n.classList.contains('tabs'));
const glissiere = () => $.querySelector('.tabs .sl');
const W = () => innerWidth;

function transition(t) {
  for (const n of bouge()) n.style.transition = t;
  if (g.voisin) g.voisin.v.style.transition = t;
  const sl = glissiere(); if (sl) sl.style.transition = t;
}

/* l'onglet allumé bascule à mi-course, comme la page qu'il nomme */
function allumer(i) {
  if (i === g.allume) return;
  g.allume = i;
  $.querySelectorAll('.tabs button').forEach((b, j) => b.classList.toggle('on', j === i));
}

function placer() {
  const t = `translate3d(${g.x.toFixed(1)}px,0,0)`;
  for (const n of bouge()) n.style.transform = t;
  const v = g.voisin, p = v ? -g.x / W() : 0;
  if (v) v.v.style.transform = `translate3d(${(g.x + v.c * W()).toFixed(1)}px,0,0)`;
  const sl = glissiere(); if (sl) sl.style.transform = `translateX(${((g.ici + p) * PAS).toFixed(1)}px)`;
  allumer(g.ici + Math.round(p));
}

/* La pastille est à nous pendant le geste : une pose de la barre en cours
   (ui/barre.js, sur le compositeur) passerait devant et la figerait. */
function prendreGlissiere() {
  const sl = glissiere();
  // la pose ou une transition, jamais la matière des abonnés (CSSAnimation : la lave)
  if (sl) for (const a of sl.getAnimations()) if (!(window.CSSAnimation && a instanceof CSSAnimation)) a.cancel();
  $.querySelectorAll('.tabs .vise').forEach(b => b.classList.remove('vise'));   // l'icône que visait la pose arrêtée
}

const xActuel = () => {
  const n = bouge()[0];
  return n ? new DOMMatrixReadOnly(getComputedStyle(n).transform).m41 : 0;
};

/* ---------- le geste ---------- */
function dessiner() {
  g.raf = 0;
  if (g.phase !== 'doigt') return;
  const c = g.dx < 0 ? 1 : -1, k = g.ordre[g.ici + c];
  if (!k) g.x = 0;                                    // au bout : rien ne bouge
  else {
    if (!g.voisin || g.voisin.k !== k) {
      cacher(g.voisin); g.voisin = montrer(k, c);
      if (g.voisin) g.voisin.v.style.willChange = 'transform';
    }
    g.x = g.voisin ? Math.max(-W(), Math.min(W(), g.dx)) : 0;   // jamais au-delà de la voisine
  }
  placer();
}

function vitesse() {
  const a = g.traces[0], b = g.traces[g.traces.length - 1];
  return a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
}

/* La fenêtre ET le nœud touché : Safari adresse toute la suite d'un appui
   au nœud touché, même quand le rendu l'a ôté de la page (après un geste
   rattrapé qui fait passer la page) ; un événement vu deux fois ne compte
   qu'une. */
let vu = null;
function ecoute(oui) {
  const f = oui ? 'addEventListener' : 'removeEventListener';
  for (const c of [window, g && g.noeud]) {
    if (!c) continue;
    c[f]('pointermove', bouger, { passive: true });
    c[f]('pointerup', lacher);
    c[f]('pointercancel', lacher);
  }
}
const deja = e => { if (e === vu) return true; vu = e; return false; };

/* Une bande de pastilles défile toute seule : tant qu'elle a de quoi
   défiler du côté où va le doigt, c'est elle qui prend le geste. */
function bouger(e) {
  if (!g || g.phase !== 'doigt' || e.pointerId !== g.pid || deja(e)) return;
  if (!g.lock && !verrouiller(e)) return;
  g.dx = g.base + e.clientX - g.x0;
  g.traces.push({ t: e.timeStamp, x: e.clientX });
  while (g.traces.length > 2 && e.timeStamp - g.traces[0].t > 90) g.traces.shift();
  if (!g.raf) g.raf = requestAnimationFrame(dessiner);
}

/* Le geste se décide aux premiers pixels : de côté, il est à nous ; en
   hauteur, il est au défilement. */
function verrouiller(e) {
  const ax = e.clientX - g.x0, ay = e.clientY - g.y0;
  if (Math.abs(ax) < 9 && Math.abs(ay) < 9) return false;
  const st = g.strip, room = !st ? 0 : ax > 0 ? st.scrollLeft : st.scrollWidth - st.clientWidth - st.scrollLeft;
  if (Math.abs(ax) <= Math.abs(ay) * 1.3 || room > 1) { abandonner(); return false; }
  g.lock = 1;
  debuter();
  g.x0 = e.clientX;                                   // pas de saut : la page part d'où est le doigt
  return true;
}

function debuter() {
  prendreGlissiere();
  transition('none');
  for (const n of bouge()) n.style.willChange = 'transform';
}

/* On projette la course : un geste vif qui n'a parcouru qu'un quart de
   l'écran passe quand même, un retour du doigt annule même au-delà de la
   moitié. La durée suit la vitesse du doigt, sans jamais traîner. */
function lacher(e) {
  if (!g || g.phase !== 'doigt' || e.pointerId !== g.pid || deja(e)) return;
  ecoute(false);
  if (!g.lock) { g = null; return; }
  if (g.raf) { cancelAnimationFrame(g.raf); g.raf = 0; }
  dessiner();
  const v = vitesse(), c = g.voisin && g.voisin.c;
  const passe = !!g.voisin && -(g.x + v * 180) * c > W() * .38;
  const cible = passe ? -c * W() : 0;
  const dur = Math.round(Math.min(340, Math.max(180, Math.abs(cible - g.x) / Math.max(Math.abs(v), 1.2))));
  g.phase = passe ? 'aller' : 'retour';
  transition(`transform ${dur}ms ${COURBE}`);
  g.x = cible;
  placer();
  if (!passe) allumer(g.ici);
  g.fin = setTimeout(terminer, dur + 24);
}

function terminer() {
  const fini = g;
  if (!fini) return;
  clearTimeout(fini.fin);
  g = null;
  if (fini.phase === 'aller') return passer(fini);
  cacher(fini.voisin);
  nettoyer(fini.ici);
}

/* La voisine devient la page : le vrai écran se rend dessous, puis la
   couche s'en va dans la même image — rien ne saute. */
function passer(fini) {
  prets.delete(fini.voisin.k);
  try { allerOnglet(fini.voisin.k); }       // la page quittée est recyclée par l'observateur plus bas
  finally { cacher(fini.voisin); }          // quoi qu'il arrive au rendu, la couche s'en va
}

function nettoyer(ici) {
  for (const n of bouge()) { n.style.transform = ''; n.style.transition = ''; n.style.willChange = ''; }
  const sl = glissiere(); if (sl) { sl.style.transform = `translateX(${ici * PAS}px)`; sl.style.transition = ''; }
  /* l'onglet allumé redevient celui de la page : un geste abandonné en route
     (un second doigt, l'app qui passe derrière) laissait allumé celui de la
     voisine — son icône blanche sur la barre claire, la pastille ailleurs */
  $.querySelectorAll('.tabs button').forEach((b, j) => b.classList.toggle('on', j === ici));
}

function abandonner() {
  ecoute(false);
  if (g.raf) cancelAnimationFrame(g.raf);
  const ici = g.ici;
  cacher(g.voisin);
  g = null;
  nettoyer(ici);
}

/* Un doigt qui se pose pendant que la page finit sa course : presque
   arrivée, elle arrive et le nouveau geste part de la nouvelle page ;
   sinon on la reprend là où on la voit, comme une page qu'on attrape. */
function rattraper(e) {
  clearTimeout(g.fin);
  const x = xActuel();
  if (g.phase === 'aller' && Math.abs(x) > W() * .5) { terminer(); return commencer(e); }
  for (const n of [...bouge(), g.voisin && g.voisin.v, glissiere()]) {
    if (!n) continue;
    const m = new DOMMatrixReadOnly(getComputedStyle(n).transform);
    n.style.transition = 'none';
    n.style.transform = n.classList.contains('sl') ? `translateX(${m.m41}px)` : `translate3d(${m.m41}px,0,0)`;
  }
  Object.assign(g, { phase: 'doigt', pid: e.pointerId, noeud: e.target, x0: e.clientX, y0: e.clientY, base: x, dx: x, x, lock: 1, traces: [] });
  ecoute(true);
}

function commencer(e) {
  const ordre = ordreOnglets(), ici = ordre.indexOf(view.name);
  if (ici < 0 || !document.getElementById('page')) return;
  g = { phase: 'doigt', pid: e.pointerId, noeud: e.target, x0: e.clientX, y0: e.clientY, dx: 0, x: 0, base: 0, lock: 0, traces: [], raf: 0,
    strip: e.target.closest && e.target.closest('.pills,.heat,.mixwrap'), voisin: null, ordre, ici, allume: ici };
  ecoute(true);
}

const AILLEURS = '.tabs,.menu,.dm-bandeau,#rail,.rng,.seg,input,textarea,select';
const sansCouche = () => { for (const n of document.querySelectorAll('body > .balai')) n.remove(); };
const auDoigt = e => e.pointerType !== 'mouse' && !LARGE.matches && !reorder && e.isPrimary;
/* Le retour part aussi d'un champ qu'on n'est pas en train d'écrire : les
   cartes d'un paquet sont des champs, et le pouce s'y pose presque toujours. */
const RETENUS = '.tabs,.menu,.dm-bandeau,#rail,.rng,.seg,select';
const pourRetour = e => !e.target.closest(RETENUS) && e.target !== document.activeElement;
document.addEventListener('pointerdown', e => {
  if (!g && !r) sansCouche();                        // jamais une voisine sans geste, quel que soit l'écran
  if (r || !auDoigt(e)) return;
  if (!g && peutRevenir()) return pourRetour(e) && commencerRetour(e);
  entreOnglets(e);
});
function entreOnglets(e) {
  if (e.target.closest(AILLEURS)) return;
  // la page finit sa course : le doigt la rattrape (la barre, une feuille gardent leur appui)
  if (g && g.phase !== 'doigt') return rattraper(e);
  if (g) { if (e.pointerId === g.pid) return; abandonner(); }   // l'ancien doigt est parti sans qu'on l'ait vu
  const pg = document.getElementById('page');
  if (pg && pg.contains(e.target) && $.contains(pg)) commencer(e);
}

/* Appelé par chaque page à onglets une fois rendue (sa porte, ui/balayage.js). */
export function lier() {
  if (fantome) return;
  if (g) redessinee();
  /* Aucune couche ne survit à son geste : une voisine restée dans la page
     (un geste perdu) se figeait par-dessus tous les écrans suivants —
     « les pages s'empilent », 2026-11-17. */
  else sansCouche();
  planifier(true);
}

/* L'app passe derrière (un appel, une autre app) : le doigt ne reviendra pas,
   la page finit tout de suite là où elle allait. */
function quitter() {
  annulerRetour();
  if (!g) return;
  if (g.phase === 'doigt') abandonner(); else terminer();
}
addEventListener('blur', quitter);
document.addEventListener('visibilitychange', () => { if (document.hidden) quitter(); });

/* La page s'est redessinée sous le geste (une réponse de la base) : ses
   nœuds neufs reprennent aussitôt la place des anciens. Pendant le retour,
   ils sont déjà où il faut : le geste est fini. */
function redessinee() {
  if (view.name !== g.ordre[g.ici]) {               // un autre écran s'est ouvert sous le geste : il s'arrête là
    ecoute(false); cacher(g.voisin); clearTimeout(g.fin); g = null;
    return;
  }
  if (g.phase === 'retour') return terminer();
  for (const n of bouge()) { n.style.transition = 'none'; n.style.willChange = 'transform'; }
  placer();
}

/* ══════════ revenir au doigt (2026-11-17) ══════════
   Demandé : « dans un paquet, les réglages ou une page annexe (création,
   quiz, club…), si je glisse le doigt de gauche à droite, ça ferme et me
   ramène sur la page d'où je viens ». Comme le retour d'iOS : la page suit
   le doigt vers la droite et découvre dessous, un peu en retrait et voilé,
   l'onglet où mène son bouton « Retour » — préparé d'avance comme une
   voisine, sa barre du bas comprise. Lâché assez loin ou d'un geste vif,
   c'est ce bouton qui agit (ses règles, son historique), sans fondu : la
   page dessous était déjà la bonne. Sinon elle revient. Jamais pendant une
   révision, une partie, un examen, ni sur une création qui a du contenu. */
const RETOURS = /^(deck|settings|trash|mail|lettre|stats|find|shared|friends|profil|club|defi|classe|import|run|plus|mod)$/;
const VERS = { home: 'home', commu: 'commu', classes: 'classes' };
let r = null;

const boutonRetour = () => $.querySelector('.bar > [aria-label="Retour"]');
function destRetour() {
  const b = boutonRetour(); if (!b) return null;
  const ds = b.dataset;
  const k = ds.act === 'deckback' ? (retourLivre() || {}).name : ds.ec ? 'classes'
    : ds.lp ? (cercle.profilRetour || {}).name : VERS[ds.act];
  return ordreOnglets().includes(k) ? k : null;
}
const brouillon = () => comp.cards.length || [comp.f, comp.b, comp.text].some(x => (x || '').trim());
const peutRevenir = () => RETOURS.test(view.name) && !menu && !tuto && !!boutonRetour()
  && !$.querySelector(':scope > .tabs') && !(view.name === 'import' && brouillon());

function commencerRetour(e) {
  const st = e.target.closest('.pills,.heat,.mixwrap');
  if (st && st.scrollLeft > 1) return;               // une bande qui peut revenir en arrière : à elle le geste
  r = { phase: 'doigt', pid: e.pointerId, noeud: e.target, x0: e.clientX, y0: e.clientY, x: 0, lock: 0, pts: [], raf: 0 };
  ecouteRetour(true);
}

function ecouteRetour(oui) {
  const f = oui ? 'addEventListener' : 'removeEventListener';
  for (const c of [window, r && r.noeud]) {
    if (!c) continue;
    c[f]('pointermove', bougerRetour, { passive: true });
    c[f]('pointerup', lacherRetour);
    c[f]('pointercancel', lacherRetour);
  }
}

function bougerRetour(e) {
  if (!r || r.phase !== 'doigt' || e.pointerId !== r.pid || deja(e)) return;
  const ax = e.clientX - r.x0, ay = e.clientY - r.y0;
  if (!r.lock) {
    if (Math.abs(ax) < 9 && Math.abs(ay) < 9) return;
    if (ax <= 0 || ax <= Math.abs(ay) * 1.3) { ecouteRetour(false); r = null; return; }
    r.lock = 1; r.x0 = e.clientX;
    debuterRetour();
  }
  r.x = Math.max(0, e.clientX - r.x0);
  r.pts.push({ t: e.timeStamp, x: e.clientX });
  while (r.pts.length > 2 && e.timeStamp - r.pts[0].t > 90) r.pts.shift();
  if (!r.raf) r.raf = requestAnimationFrame(() => { if (r) { r.raf = 0; placerRetour(); } });
}

function debuterRetour() {
  r.k = destRetour();
  r.n = r.k ? montrer(r.k, 0) : null;
  if (r.n) {
    r.n.clip.classList.add('avec-barre');
    r.n.voile = document.createElement('i');
    r.n.voile.className = 'balai-voile';
    r.n.clip.append(r.n.voile);
  }
  r.ombre = document.createElement('i');
  r.ombre.className = 'retour-ombre';
  document.body.append(r.ombre);
  for (const n of bouge()) { n.style.transition = 'none'; n.style.willChange = 'transform'; }
}

/* La page à x ; dessous, l'onglet découvert sur [0, x] seulement : sa couche
   recule de la largeur restante, son contenu avance de 70 % de celle-ci —
   il se montre à −30 % de cette largeur, comme sous iOS. */
function placerRetour() {
  const w = W(), x = r.x, reste = w - x;
  for (const n of bouge()) n.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  if (r.n) {
    r.n.clip.style.transform = `translate3d(${(x - w).toFixed(1)}px,0,0)`;
    r.n.v.style.transform = `translate3d(${(reste * 0.7).toFixed(1)}px,0,0)`;
    r.n.voile.style.opacity = (reste / w).toFixed(3);
  }
  r.ombre.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  r.ombre.style.opacity = (reste / w).toFixed(3);
}

function lacherRetour(e) {
  if (!r || r.phase !== 'doigt' || e.pointerId !== r.pid || deja(e)) return;
  ecouteRetour(false);
  if (!r.lock) { r = null; return; }
  if (r.raf) { cancelAnimationFrame(r.raf); r.raf = 0; }
  const v = vitesseDe(r.pts);
  const passe = e.type !== 'pointercancel' && r.x + v * 180 > W() * 0.35 && v > -0.2;
  const cible = passe ? W() : 0;
  const dur = Math.round(Math.min(320, Math.max(180, Math.abs(cible - r.x) / Math.max(Math.abs(v), 1.2))));
  courseRetour(`${dur}ms ${COURBE}`);
  r.phase = passe ? 'aller' : 'retour';
  r.x = cible;
  placerRetour();
  r.fin = setTimeout(finirRetour, dur + 24);
}

const vitesseDe = pts => {
  const a = pts[0], b = pts[pts.length - 1];
  return a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
};
function courseRetour(t) {
  const n = r.n || {};
  for (const x of [...bouge(), n.clip, n.v]) if (x) x.style.transition = `transform ${t}`;
  for (const x of [r.ombre, n.voile]) if (x) x.style.transition = `transform ${t},opacity ${t}`;
}

/* La fenêtre perd la main en plein retour : la page revient à sa place. */
function annulerRetour() {
  if (!r) return;
  ecouteRetour(false); clearTimeout(r.fin);
  r.phase = 'retour';
  finirRetour();
}

function finirRetour() {
  const f = r; r = null;
  if (!f) return;
  try {
    if (f.phase === 'aller') {
      const b = boutonRetour();
      if (b) b.click();
      if (f.n) entreeEcran('calme');                   // l'onglet était déjà là, dessous : il ne rejoue pas son entrée
    }
  } finally {
    cacher(f.n);
    if (f.ombre) f.ombre.remove();
    for (const n of bouge()) { n.style.transform = ''; n.style.transition = ''; n.style.willChange = ''; }
  }
}
