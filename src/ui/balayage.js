// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { reorder, setView, view } from '../data/etat.js';
import { allerOnglet, defilementDe, ordreOnglets, vueOnglet } from './bibliotheque.js';
import { paintMedia } from './carte-media.js';

/* ══════════ le balayage entre onglets (téléphone) ══════════
   Livres ↔ Classe ↔ Cercle des lecteurs, comme d'un écran à l'autre dans
   une app native : la page suit le doigt et la voisine entre par le bord,
   déjà dessinée, à sa position de défilement. On la lâche passé un peu
   moins de la moitié de l'écran, ou plus tôt d'un geste vif ; sinon tout
   revient. Sur ordinateur (souris, ou fenêtre de 900 px et plus) rien ne
   glisse : la barre latérale suffit.

   La voisine est rendue par sa vraie fonction d'écran, dont on intercepte
   le `$.innerHTML = …` : la page en cours ne quitte jamais le document
   (le doigt resterait sinon accroché à un nœud détaché, et le défilement
   serait remis à zéro). */

const LARGE = matchMedia('(min-width: 900px)');
const PAS = 74;                         // largeur d'un bouton d'onglet (.tabs button)
const COURBE = 'cubic-bezier(.2,.85,.25,1)';
let fantome = false;                    // une vue s'écrit pour l'aperçu : elle ne rebranche pas le geste
let glisse = false;                     // une page finit sa course : on n'en commence pas une autre

function rendre(k) {
  let html = '';
  const avant = view;
  fantome = true; setView({ name: k, id: null });
  Object.defineProperty($, 'innerHTML', { configurable: true, get: () => html, set: v => { html = v; } });
  try { vueOnglet(k)(); }
  catch (e) { html = ''; console.warn('aperçu', k, e); }   // sans aperçu, le bord reste élastique
  finally { delete $.innerHTML; fantome = false; setView(avant); }
  return html;
}

/* La voisine, dans une couche fixe qui ne déborde jamais de l'écran :
   même marges que #app, même hauteur de défilement que celle qu'elle
   retrouvera une fois ouverte (render() → placerDefilement()). */
function poserVoisine(k, c) {
  const html = rendre(k);
  if (!html) return null;
  const clip = document.createElement('div');
  clip.className = 'balai';
  clip.setAttribute('aria-hidden', 'true');
  clip.innerHTML = `<div class="balai-v"><div class="balai-app" data-view="${k}">${html}</div></div>`;
  const app = clip.querySelector('.balai-app');
  const tb = app.querySelector('.tabs'); if (tb) tb.remove();
  app.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  const r = $.getBoundingClientRect(), cs = getComputedStyle($);
  const haut = r.top + document.body.scrollTop;
  Object.assign(app.style, { left: r.left + 'px', width: r.width + 'px', padding: cs.padding });
  document.body.appendChild(clip);
  const max = Math.max(0, haut + app.offsetHeight - innerHeight);
  app.style.top = (haut - Math.min(defilementDe(k), max)) + 'px';
  paintMedia(app);
  return { k, c, clip, el: clip.firstElementChild };
}

export function bindPager() {
  if (fantome || reorder || LARGE.matches) return;
  const pg = document.getElementById('page'); if (!pg) return;
  const ordre = ordreOnglets(), ici = ordre.indexOf(view.name);
  if (ici < 0) return;
  let x0 = 0, y0 = 0, dx = 0, x = 0, on = false, lock = 0, raf = 0, pid = -1;
  let strip = null, voisin = null, traces = [], allume = ici;
  const W = () => innerWidth;
  const bouge = () => [...$.children].filter(n => !n.classList.contains('tabs'));
  const glissiere = () => $.querySelector('.tabs .sl');

  const retirer = () => { if (voisin) { voisin.clip.remove(); voisin = null; } };
  const transition = t => {
    for (const n of bouge()) n.style.transition = t;
    if (voisin) voisin.el.style.transition = t;
    const sl = glissiere(); if (sl) sl.style.transition = t;
  };
  /* l'onglet allumé bascule à mi-course, comme la page qu'il nomme */
  const allumer = i => {
    if (i === allume) return;
    allume = i;
    $.querySelectorAll('.tabs button').forEach((b, j) => b.classList.toggle('on', j === i));
  };
  const placer = () => {
    const t = `translate3d(${x.toFixed(1)}px,0,0)`;
    for (const n of bouge()) n.style.transform = t;
    const p = voisin ? -x / W() : 0;
    if (voisin) voisin.el.style.transform = `translate3d(${(x + voisin.c * W()).toFixed(1)}px,0,0)`;
    const sl = glissiere(); if (sl) sl.style.transform = `translateX(${((ici + p) * PAS).toFixed(1)}px)`;
    allumer(ici + Math.round(p));
  };
  const dessiner = () => {
    raf = 0;
    if (!on) return;
    const c = dx < 0 ? 1 : -1, k = ordre[ici + c];
    if (!k) { retirer(); x = dx * .26; }                 // au bout : la page résiste, rien derrière
    else {
      if (!voisin || voisin.k !== k) { retirer(); voisin = poserVoisine(k, c); transition('none'); }
      x = voisin ? dx : dx * .26;
    }
    placer();
  };
  const vitesse = () => {
    const a = traces[0], b = traces[traces.length - 1];
    return a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
  };
  const ecoute = oui => {
    const f = oui ? addEventListener : removeEventListener;
    f('pointermove', bouger, { passive: true });
    f('pointerup', lacher);
    f('pointercancel', lacher);
  };

  /* Une bande de pastilles défile toute seule : tant qu'elle a de quoi
     défiler du côté où va le doigt, c'est elle qui prend le geste. Une
     fois au bout, le geste redevient un changement d'écran. */
  const bouger = e => {
    if (!on || e.pointerId !== pid) return;
    const ax = e.clientX - x0, ay = e.clientY - y0;
    if (!lock) {
      if (Math.abs(ax) < 9 && Math.abs(ay) < 9) return;
      lock = Math.abs(ax) > Math.abs(ay) * 1.3 ? 1 : -1;
      if (lock < 0) return finir(false);
      if (strip) {
        const room = ax > 0 ? strip.scrollLeft : strip.scrollWidth - strip.clientWidth - strip.scrollLeft;
        if (room > 1) return finir(false);
      }
      transition('none');
      x0 = e.clientX;                                   // pas de saut : la page part d'où est le doigt
    }
    dx = e.clientX - x0;
    traces.push({ t: e.timeStamp, x: e.clientX });
    while (traces.length > 2 && e.timeStamp - traces[0].t > 90) traces.shift();
    if (!raf) raf = requestAnimationFrame(dessiner);
  };

  /* On projette la course : un geste vif qui n'a parcouru qu'un quart de
     l'écran passe quand même, un retour du doigt annule même au-delà de
     la moitié. La durée suit la vitesse du doigt, pour ne pas freiner un
     geste rapide ni lancer une page posée doucement. */
  const lacher = e => {
    if (!on || (e && e.pointerId !== pid)) return;
    if (!lock) return finir(false);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    dessiner();
    const v = vitesse(), c = voisin && voisin.c;
    const passe = !!voisin && -(dx + v * 200) * c > W() * .4;
    const cible = passe ? -c * W() : 0;
    const dur = Math.round(Math.min(380, Math.max(190, Math.abs(cible - x) / Math.max(Math.abs(v), 1.1))));
    on = false; ecoute(false); glisse = true;
    transition(`transform ${dur}ms ${COURBE}`);
    x = cible;
    placer();
    if (!passe) allumer(ici);
    setTimeout(() => {
      glisse = false;
      if (passe) { allerOnglet(voisin.k); retirer(); return; }
      retirer(); nettoyer();
    }, dur + 16);
  };
  const nettoyer = () => {
    for (const n of bouge()) { n.style.transform = ''; n.style.transition = ''; }
    const sl = glissiere(); if (sl) { sl.style.transform = `translateX(${ici * PAS}px)`; sl.style.transition = ''; }
  };
  const finir = rendu => {
    on = false; ecoute(false);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!rendu) { retirer(); nettoyer(); allumer(ici); }
  };

  pg.addEventListener('pointerdown', e => {
    if (glisse || on || e.pointerType === 'mouse' || LARGE.matches) return;
    if (e.target.closest('.rng,.seg,input,textarea,select')) return;
    strip = e.target.closest('.pills,.heat,.mixwrap');
    on = true; lock = 0; dx = 0; x = 0; traces = [];
    x0 = e.clientX; y0 = e.clientY; pid = e.pointerId;
    ecoute(true);
  });
}
