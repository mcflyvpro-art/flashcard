// @ts-nocheck
/* ══════════ le geste de la fiche : les quatre notes au doigt (2026-11-16) ══════════
   Demandé : « à la Quizlet, plus tu swipes une carte à gauche ou à droite,
   plus ça choisit parmi les quatre options, selon où elles sont ; le contour
   change de couleur en correspondant ; on choisit sans cliquer sur les
   boutons ; et une micro-bulle dit quand la carte reviendra ».

   Les quatre notes sont rangées sous la fiche comme sur une règle — Encore,
   Difficile | Correct, Facile — et le doigt les retrouve au même endroit :
   un peu à gauche, Difficile ; loin à gauche, Encore ; un peu à droite,
   Correct ; loin à droite, Facile. La limite entre les deux notes d'un côté
   est à un bouton et quart du centre (110 px au moins, à portée de pouce) :
   la fiche part avec la note du bouton vers lequel on l'a portée.

   Ce qu'on voit est ce qu'on obtient : le contour prend la couleur de la
   note (celle de son bouton), le bouton s'allume, une bulle au-dessus de la
   fiche dit la note et quand la page reviendra (« Facile · dans 9 j », le
   calcul même du moteur, le même que sous les boutons), et le lâcher donne
   exactement cette note. Revenir au centre n'en donne aucune. La bulle ne
   tourne pas avec la fiche : elle se lit pendant qu'on la promène. Une
   limite ne se repasse qu'en la dépassant franchement (ECART) : la note ne
   clignote jamais sous un doigt qui hésite.

   Ce qui fait la fluidité (le geste d'avant, gardé) : un seul dessin par
   image — un doigt envoie plus d'événements que l'écran n'a d'images —, la
   rotation selon l'endroit où l'on a saisi la fiche, comme un carton qu'on
   fait pivoter autour du point qu'on tient, et le lancer qui garde sa
   direction. Un déplacement vertical promène la fiche, il ne répond pas.

   Chargé au calme après l'ouverture (ui/synchro-ecran.js) ou à la première
   fiche (lierGeste de ui/revision.js). */
import './geste.css';
import { setPendingGrade, study } from '../data/etat.js';
import { preview } from './carte-media.js';
import { NOTES, TEINTES, cardOf, findCard, fling, isTF, toggleFlip } from './revision.js';

const SEUIL = 40;           // en deçà, la fiche se promène : aucune note (un appui un peu glissé ne note rien)
const ECART = 8;            // une limite ne se repasse qu'en la dépassant d'autant
const SUIVI = 90;           // les dernières millisecondes, pour la vitesse du lâcher
const calme = matchMedia('(prefers-reduced-motion: reduce)');
const POP = [{ transform: ['scale(1.1)', 'none'] }, { duration: 280, easing: 'cubic-bezier(.3,1.45,.45,1)' }];

/* La bulle : une seule, posée sur la pile. Elle survit à la fiche qu'on
   vient de lancer (lier la remet sur la pile de la suivante) : la note
   choisie se lit encore pendant que la page suivante arrive. */
const bulle = document.createElement('div');
bulle.className = 'gz-bulle';
bulle.setAttribute('aria-hidden', 'true');
bulle.innerHTML = '<b></b><span></span>';
let cacher = 0;

// le délai de chaque note pour cette page, tel que le moteur le calculera
function delais(c) {
  if (!c || study.simple) return [];
  const d = findCard(c.id)[1];
  return NOTES.map((_, r) => { const t = preview(c, r, d); return /^\d/.test(t) ? 'dans ' + t : t; });
}

function montrer(z, delai) {
  clearTimeout(cacher);
  bulle.classList.remove('part');
  if (z == null) return bulle.classList.remove('on');
  const deja = bulle.classList.contains('on');
  bulle.style.setProperty('--gz', TEINTES[z]);
  bulle.firstChild.textContent = NOTES[z];
  bulle.lastChild.textContent = delai || '';
  bulle.classList.add('on');
  if (deja && !calme.matches) bulle.animate(...POP);   // une autre note : la bulle bat une fois
}

// le bouton de la note visée s'allume sous la fiche retournée
function allumer(z) {
  for (const b of document.querySelectorAll('#foot .gr')) b.classList.toggle('vise', +b.dataset.g === z);
}

/* La note sous le doigt : aucune au centre, Difficile ou Correct près du
   centre, Encore ou Facile au-delà d'un bouton. `avant` est la note qu'on
   montre déjà : pour la quitter, il faut passer la limite d'ECART pixels. */
function viser(dx, avant, loin) {
  const a = Math.abs(dx), droite = dx > 0;
  const cote = avant != null && avant > 1 === droite;
  if (a <= (cote ? SEUIL - ECART : SEUIL)) return null;
  const auLoin = a > (cote && (avant === 0 || avant === 3) ? loin - ECART : loin);
  return droite ? (auLoin ? 3 : 2) : (auLoin ? 0 : 1);
}

/* La fiche part (fling de ui/revision.js), au doigt, au bouton ou au
   clavier : la bulle confirme la note et le délai, puis s'envole et
   s'efface au moment où la page suivante arrive — elle ne reste pas posée
   sur une page qui n'est pas la sienne. Pas pour un vrai ou faux : son
   verdict est déjà en bas. */
export function partir(z) {
  const c = cardOf(0);
  if (!c || isTF(c)) return;
  montrer(z, delais(c)[z]);                            // déjà là (le doigt) : elle bat une fois, sinon elle paraît
  allumer(z);
  cacher = setTimeout(() => {
    bulle.classList.add('part');
    cacher = setTimeout(() => bulle.classList.remove('on', 'part'), 420);
  }, 380);
}

export function lier(el) {
  const st = el.parentNode;
  if (st && bulle.parentNode !== st) st.appendChild(bulle);
  let x0 = 0, y0 = 0, dx = 0, dy = 0, on = false, moved = false, haut = true;
  let raf = 0, pid = -1, note = null, loin = 100, t = [], trace = [];

  const peindre = () => {
    raf = 0;
    /* La rotation suit l'écart horizontal, signée par le point de saisie,
       et se plafonne : au-delà d'une vingtaine de degrés la fiche devient
       illisible pendant qu'on la déplace. */
    const rot = Math.max(-20, Math.min(20, dx * .07)) * (haut ? 1 : -1);
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`;
    const z = viser(dx, note, loin), a = Math.abs(dx);
    /* Le contour s'annonce avant la limite, à peine, dans la couleur de la
       note la plus proche ; passée la limite, il est franc — la couleur
       exacte de la note —, et s'épaissit encore jusqu'à la note d'après. */
    const sw = z == null ? Math.max(0, Math.min(1, (a - 8) / (SEUIL - 8))) * .35
      : Math.min(1, .9 + .1 * (a - SEUIL) / (loin - SEUIL));
    el.style.setProperty('--sw', sw.toFixed(3));
    el.style.setProperty('--swc', TEINTES[z != null ? z : dx < 0 ? 1 : 2]);
    if (z === note) return;
    note = z;
    montrer(z, t[z]);
    allumer(z);
    if (z != null && navigator.vibrate) try { navigator.vibrate(4); } catch (x) { /* vibration refusée : le geste reste le même */ }
  };
  const demander = () => { if (!raf) raf = requestAnimationFrame(peindre); };

  /* La vitesse au lâcher, sur les derniers instants du geste : la moyenne
     depuis le départ mentirait (on ralentit souvent avant de relâcher). */
  const vitesse = () => {
    const now = performance.now(), p = trace.filter(s => now - s.t < SUIVI);
    if (p.length < 2) return { vx: 0, vy: 0 };
    const a = p[0], b = p[p.length - 1], dt = Math.max(8, b.t - a.t);
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };   // pixels par milliseconde
  };

  el.addEventListener('pointerdown', e => {
    // une fiche qui part ne se rattrape pas ; le son ne la retourne pas
    if (on || el.dataset.gone || !e.isPrimary || e.button > 0 || e.target.closest('[data-snd],[data-say]')) return;
    on = true; moved = false; dx = dy = 0; note = null;
    x0 = e.clientX; y0 = e.clientY; pid = e.pointerId;
    const r = el.getBoundingClientRect();
    haut = e.clientY < r.top + r.height / 2;
    trace = [{ x: 0, y: 0, t: performance.now() }];
    // un bouton de note et quart : là où commence la note du bord
    const g = document.getElementById('foot');
    loin = Math.max(110, Math.min(180, (g ? g.getBoundingClientRect().width : 360) / 4 * 1.25));
    t = delais(cardOf(0));
    try { el.setPointerCapture(pid); } catch (x) { /* capture refusée : le glissé marche quand même via pointermove */ }
    el.style.transition = 'none';
  });
  el.addEventListener('pointermove', e => {
    if (!on || e.pointerId !== pid) return;
    dx = e.clientX - x0; dy = e.clientY - y0;
    if (!moved && Math.hypot(dx, dy) > 5) moved = true;
    const now = performance.now();
    trace.push({ x: dx, y: dy, t: now });
    while (trace.length > 2 && now - trace[0].t > SUIVI) trace.shift();
    demander();
  });
  const lacher = e => {
    if (!on || e.pointerId !== pid) return;
    on = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    el.style.transition = '';
    const v = vitesse(), annule = e.type !== 'pointerup';   // le système a repris la main : on ne note pas
    let z = annule ? null : viser(dx, note, loin);
    /* Un lancer court et sec, sans être allé jusqu'à la limite : la note
       la plus sûre de son côté, celle d'à côté du centre. */
    if (z == null && !annule && Math.abs(v.vx) > .45 && Math.abs(dx) > 26) z = dx < 0 ? 1 : 2;
    note = null;
    if (z != null) { setPendingGrade(z); return fling(z > 1 ? 1 : -1, v, dx, dy); }
    allumer(null);
    montrer(null);
    el.style.transform = '';
    el.style.setProperty('--sw', 0);            // la fiche revient au centre, la couleur s'efface
    if (!moved && !annule) toggleFlip();
  };
  el.addEventListener('pointerup', lacher);
  el.addEventListener('pointercancel', lacher);
  el.addEventListener('lostpointercapture', lacher);
}
