// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { isLeech } from '../file.js';
import {
  db, menu, setMenu, setSubjName, subjColor, subjEdit, subjName, view
} from '../data/etat.js';
import { render } from './bibliotheque.js';
import { sansMouvement } from './mouvement.js';
import { paintMenuCercle } from './cercle-feuilles.js';
import { paintMenuCode } from './code-entree.js';
import { paintMedia } from './carte-media.js';
import { blockedSheet, reportSheet } from './classement.js';
import { COLORS, PALETTE, canUndo, deck, esc, subj, undoLabel } from '../core/coeur-sync.js';
import { paintMenuProf } from './prof-porte.js';
import {
  paintMenuCard, paintMenuConflict, paintMenuDeckset, paintMenuDuelitem,
  paintMenuFnr, paintMenuHelp, paintMenuLeave,
  paintMenuLend, paintMenuMate, paintMenuMateprof,
  paintMenuMerge, paintMenuMove, paintMenuPreview, paintMenuSendfriend,
  paintMenuSharepick, paintMenuSortpick, paintMenuSplit, paintMenuTuto,
  paintMenuVers
} from './menus-b.js';
import { paintMenuRename } from './menus-c.js';
import { paintMenuPseudo } from './pseudo-porte.js';
import { installSheet } from './onboarding.js';

/* ---------- menu contextuel ----------
   Sur ordinateur, une feuille n'est pas un tiroir de téléphone posé au
   milieu de l'écran : une explication « ? » ou une courte liste d'actions
   s'ouvre accrochée au bouton qui l'a demandée, comme un menu de bureau ;
   un formulaire devient une boîte de dialogue, sans poignée ni geste de
   glisser. Sur téléphone, rien ne change. Le bouton se retient au clic
   (en capture, avant que son action n'ouvre la feuille) ; une feuille
   ouverte depuis une autre garde l'ancre de la première. */
const PC = matchMedia('(min-width: 900px)');
let dernierClic = null, ancre = null;
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('button,[data-act],[data-help],[role="button"]');
  dernierClic = el ? { el, t: Date.now() } : null;
}, true);

export function openMenu(kind) {
  const recent = dernierClic && Date.now() - dernierClic.t < 800 ? dernierClic.el : null;
  if (recent && !recent.closest('.menu')) ancre = recent;
  else if (!menu) ancre = null;
  setMenu(kind); paintMenu();
}

export function closeMenu() {
  const ouverte = !!menu;
  ancre = null;
  setMenu(null);
  sortirFeuilles();
  /* L'espace professeur ne repeint pas la page sous une feuille ouverte
     (ce serait la repeindre elle aussi) : il attend ce signal. */
  if (ouverte) document.dispatchEvent(new Event('feuille-fermee'));
}

/* Une feuille peut porter beaucoup de contenu (les matières, la liste
   des paquets à fusionner…) : plus que l'écran n'en montre d'un coup.
   Elle défile donc sur elle-même — poignée et croix restent fixes en
   tête, toujours à portée, et le reste du texte qui suit prend la place
   qu'il lui faut sans jamais entraîner l'écran de dessous. */
export function mountMenu(w) {
  const box = w.querySelector('.menu');
  if (box) {
    /* Une feuille flotte au-dessus de la page, mais la page en dessous
       reste le vrai document qui défile : sans le geler, un doigt posé
       sur la feuille — ou sur le voile autour d'elle, dès qu'il n'y a
       rien à faire défiler à cet endroit précis — continuait de faire
       glisser tout l'écran derrière. */
    document.documentElement.classList.add('sheet-open');
    const body = document.createElement('div');
    body.className = 'mbody';
    while (box.firstChild) body.appendChild(box.firstChild);
    box.insertAdjacentHTML('afterbegin',
      `<div class="mtop"><i class="mgrip"></i><button class="mx" data-mact="close" aria-label="Fermer">${svg(I.x)}</button></div>`);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.appendChild(body);
    if (!PC.matches) bindSheetDrag(box, body);
  }
  const scrim = w.querySelector('.scrim');
  const vue = avant; avant = null;
  if (box) box.dataset.feuille = (menu || '') + ':' + (box.dataset.etape || '');
  document.body.append(...w.childNodes);
  if (box) placerSurPC(box);
  if (box) poser(box, scrim, vue);
  paintMedia();               // l'aperçu d'image de la feuille d'édition
}

/* ---------- entrée, redessin et sortie d'une feuille ----------
   Une feuille déjà ouverte qui se redessine (un jour choisi dans un
   calendrier, une case cochée, un compte à rebours) est un nœud neuf : elle
   rejouait son entrée, remontait en haut de son contenu et perdait le
   curseur. Elle reprend désormais exactement où on la voyait : même point
   de son entrée si celle-ci jouait encore, même défilement, même champ
   actif ; si sa hauteur change, elle y glisse au lieu de sauter, et si on
   passe d'une étape à l'autre (choisir le livre, puis le reste), seul le
   contenu fond de l'une à l'autre. Elle s'en va comme elle est venue,
   depuis là où elle en est, sans bloquer un geste pendant ce temps. */
const ENTREE = 420;                    // l'entrée la plus longue (app.css, prof-espace.css)
const DEFILANTS = '.mscroll,.pf-table,.pf-noms,.pf-list,.slist,.dlist';
let ouverteA = -1e9, avant = null;

/* Un double appui sur le bouton qui ouvre une feuille : le second tombe sur
   le voile tout juste posé et la refermait aussitôt — elle clignotait.
   Le voile n'écoute qu'une fois la feuille vraiment là. */
export const vientDOuvrir = () => performance.now() - ouverteA < 350;

function photo(box) {
  const body = box.querySelector('.mbody'), a = document.activeElement;
  const defile = [...box.querySelectorAll(DEFILANTS)].map(n => n.scrollTop);
  const champ = a && box.contains(a) && a.id && 'selectionStart' in a
    ? { id: a.id, de: a.selectionStart, a: a.selectionEnd } : null;
  return { feuille: box.dataset.feuille, h: box.getBoundingClientRect().height,
    haut: body ? body.scrollTop : 0, defile, champ };
}

function poser(box, scrim, vue) {
  const t = performance.now();
  if (!vue) { ouverteA = t; return; }
  const age = t - ouverteA;
  for (const n of [box, scrim]) {
    if (!n) continue;
    if (age < ENTREE && !sansMouvement()) n.style.animationDelay = -Math.round(age) + 'ms';
    else n.classList.add('deja');
  }
  const body = box.querySelector('.mbody');
  const meme = vue.feuille === box.dataset.feuille;
  if (meme) {
    if (body) body.scrollTop = vue.haut;
    box.querySelectorAll(DEFILANTS).forEach((n, i) => { if (vue.defile[i]) n.scrollTop = vue.defile[i]; });
    const c = vue.champ && document.getElementById(vue.champ.id);
    if (c && box.contains(c) && document.activeElement !== c) {
      c.focus({ preventScroll: true });
      try { c.setSelectionRange(vue.champ.de, vue.champ.a); } catch (e) { /* un champ sans curseur (nombre, date) : le focus suffit */ }
    }
  } else if (body && !sansMouvement()) body.classList.add('change');
  glisserHauteur(box, vue.h);
}

function glisserHauteur(box, h0) {
  if (sansMouvement() || box.classList.contains('pop') || box.classList.contains('pf-tableau')) return;
  const h1 = box.getBoundingClientRect().height;
  if (Math.abs(h1 - h0) < 2) return;
  box.style.height = h0 + 'px';
  void box.offsetHeight;
  box.style.transition = 'height .26s var(--ios)';
  box.style.height = h1 + 'px';
  const fin = e => {
    if (e && (e.target !== box || e.propertyName !== 'height')) return;
    box.removeEventListener('transitionend', fin);
    if (box.style.height === h1 + 'px') { box.style.height = ''; box.style.transition = ''; }
  };
  box.addEventListener('transitionend', fin);
  setTimeout(fin, 360);
}

/* Où va une feuille qui se ferme : par où elle est arrivée. */
function sortie(n) {
  if (n.classList.contains('scrim') || n.classList.contains('pf-tableau')) return [{ opacity: 0 }, 200];
  if (n.classList.contains('pop')) return [{ opacity: 0 }, 110];
  if (n.classList.contains('pf-tiroir')) return [{ opacity: 0, transform: 'translateX(24px)' }, 190];
  if (n.classList.contains('dlg')) return [{ opacity: 0, transform: 'scale(.98)' }, 150];
  return [{ transform: 'translateY(calc(100% + 24px))' }, 240];
}

export function sortirFeuilles() {
  document.documentElement.classList.remove('sheet-open');
  for (const n of document.querySelectorAll('.scrim:not(.sort),.menu:not(.sort)')) {
    /* tirée vers le bas au doigt, elle est déjà partie : on ne la refait pas revenir */
    if (sansMouvement() || n.style.transform || n.style.opacity) { n.remove(); continue; }
    const cs = getComputedStyle(n), de = { opacity: cs.opacity, transform: cs.transform };
    n.classList.add('sort', 'deja');
    n.style.animationDelay = '';
    n.removeAttribute('role'); n.removeAttribute('aria-modal');
    n.setAttribute('aria-hidden', 'true'); n.inert = true;
    n.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    const [vers, ms] = sortie(n);
    const fin = () => n.remove();
    try {
      n.animate([de, vers], { duration: ms, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = fin;
    } catch (e) { fin(); }             // sans animations web : elle s'en va d'un coup, comme avant
    setTimeout(fin, ms + 120);
  }
}

/* Plus rien d'ouvert, tout de suite : une autre feuille arrive. */
export function retirerFeuilles() {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  document.documentElement.classList.remove('sheet-open');
}

/* Une feuille légère (rien à remplir, pas de nuancier à parcourir)
   s'accroche à son bouton : dessous, ou dessus s'il y a plus de place, et
   si elle est plus longue que l'espace, c'est elle qui défile — comme un
   menu de bureau. Jamais hors de l'écran ni sous la barre latérale. */
function placerSurPC(box) {
  if (!PC.matches) return;
  box.classList.add('dlg');
  /* une fiche en tiroir, un tableau, une grande feuille ou un calendrier ne
     s'accrochent jamais : la fiche d'un devoir finissait en petit menu sous
     sa ligne, coupée en bas, le calendrier caché sous ses boutons */
  const leger = !box.matches('.pf-tiroir,.pf-tableau,.large')
    && !box.querySelector('input,textarea,select,.jt-grille,.jt-couleurs,.seg,.rng,canvas,svg.qr,.pf-cal');
  if (!leger || !ancre || !ancre.isConnected) return;
  const r = ancre.getBoundingClientRect();
  if (!r.width && !r.height) return;
  box.classList.replace('dlg', 'pop');
  const scrim = document.querySelector('.scrim'); if (scrim) scrim.classList.add('pop');
  const m = 12, w = box.offsetWidth, h = box.offsetHeight;
  const dessous = innerHeight - r.bottom - 8 - m, dessus = r.top - 8 - m;
  const enBas = h <= dessous || dessous >= dessus;
  const place = enBas ? dessous : dessus;
  box.style.maxHeight = Math.max(160, place) + 'px';
  // la barre latérale borne le menu à gauche — pas quand elle est posée en haut (html.nav-haut)
  const rail = document.getElementById('rail'), rr = rail && rail.getBoundingClientRect();
  const bord = rr && rr.height > rr.width ? rr.right : 0;
  const x = Math.max(bord + m, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - m));
  const y = enBas ? r.bottom + 8 : Math.max(m, r.top - 8 - Math.min(h, place));
  box.style.left = Math.round(x) + 'px';
  box.style.top = Math.round(y) + 'px';
}

/* Tirer la feuille vers le bas la ferme, comme partout ailleurs sur un
   téléphone. Sans ça, une feuille courte — une explication, un code —
   n'avait aucune réponse au geste : on tirait et il ne se passait rien.
   Le geste ne prend la main que si le contenu est déjà en haut, sinon
   c'est le texte qui doit défiler. */
function bindSheetDrag(box, body) {
  const head = box.querySelector('.mtop');
  let y0 = 0, dy = 0, on = false, lock = 0, t0 = 0, pid = -1, pts = 0;
  /* Un seul doigt, et seulement vers le bas. Sans ces deux gardes, la
     feuille suivait n'importe quel geste — deux doigts la déplaçaient et
     la pinçaient comme une image. */
  const cancel = () => {
    on = false; pid = -1;
    box.style.transition = ''; box.style.transform = '';
    const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = '';
  };
  const start = e => {
    pts++;
    if (pts > 1) return cancel();
    if (e.pointerType === 'mouse' && e.button) return;
    if (e.target.closest('input,textarea,button,.seg,.rng,.mgrid')) return;
    if (body.scrollTop > 2 && !head.contains(e.target)) return;
    on = true; lock = 0; dy = 0; y0 = e.clientY; t0 = Date.now(); pid = e.pointerId;
    box.style.transition = 'none';
  };
  const move = e => {
    if (!on || e.pointerId !== pid || pts > 1) return;
    dy = e.clientY - y0;
    if (!lock) {
      if (Math.abs(dy) < 7) return;
      /* vers le haut : ce n'est pas une fermeture, on rend la main */
      if (dy < 0) { on = false; box.style.transition = ''; box.style.transform = ''; return; }
      lock = 1;
    }
    box.style.transform = `translateY(${dy.toFixed(1)}px)`;
    const sc = document.querySelector('.scrim');
    if (sc) sc.style.opacity = Math.max(0, 1 - dy / 320);
  };
  const end = () => {
    pts = Math.max(0, pts - 1);
    if (!on) return; on = false; pid = -1;
    box.style.transition = '';
    const v = dy / Math.max(1, Date.now() - t0);
    if (dy > 110 || (v > .55 && dy > 40)) {
      box.style.transform = 'translateY(110%)';
      const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = 0;
      setTimeout(() => { closeMenu(); render(); }, 220);
      return;
    }
    box.style.transform = '';
    const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = '';
  };
  box.addEventListener('pointerdown', start);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', () => { pts = Math.max(0, pts - 1); cancel(); });
  box.addEventListener('gesturestart', e => { e.preventDefault(); cancel(); });
}

/* Table de correspondance construite à l'appel, jamais au niveau module :
   plusieurs feuilles listées ici viennent de menus-b.js et menus-c.js, qui
   importent eux-mêmes depuis ce fichier (cycle inévitable, voir CLAUDE.md) —
   un objet au niveau module capturerait ces imports avant qu'ils soient
   initialisés. */
function menuPainter(m) {
  return {
    subject: paintMenuSubject,
    install: paintMenuInstall,
    /* Toutes les feuilles de l'espace professeur passent par une seule
       entrée ; laquelle est ouverte se lit dans `prof.feuille`. */
    pf: paintMenuProf,
    cc: paintMenuCercle,
    code: paintMenuCode,
    /* ---------- les feuilles du référent ---------- */
    report: paintMenuReport,
    blocked: paintMenuBlocked,
    backup: paintMenuBackup,
    card: paintMenuCard,
    deckset: paintMenuDeckset,
    merge: paintMenuMerge,
    fnr: paintMenuFnr,
    leave: paintMenuLeave,
    sortpick: paintMenuSortpick,
    preview: paintMenuPreview,
    sharepick: paintMenuSharepick,
    handle: paintMenuPseudo,
    mate: paintMenuMate,
    tuto: paintMenuTuto,
    help: paintMenuHelp,
    vers: paintMenuVers,
    conflict: paintMenuConflict,
    duelitem: paintMenuDuelitem,
    sendfriend: paintMenuSendfriend,
    /* Prêter un livre : on part de l'ami, pas du livre. La feuille montre
       toute la bibliothèque personnelle ; le livre choisi part aussitôt
       dans sa boîte aux lettres. */
    lend: paintMenuLend,
    mateprof: paintMenuMateprof,
    move: paintMenuMove,
    split: paintMenuSplit,
    rename: paintMenuRename, pwd: paintMenuRename, delacc: paintMenuRename
  }[m];
}

function paintMenuDeck(w) {
  const d = deck(view.id); if (!d) return;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mgrid">
        ${db.subjects.map(x => subj(x.id)).map(s => `<button class="ms ${d.subject === s.id ? 'on' : ''}"
          data-msubj="${s.id}" style="--d:${s.d}"><i></i><span>${esc(s.name)}</span></button>`).join('')}
      </div>
      <div class="msep"></div>
      <button class="mi" data-mact="pindeck">${svg(I.pin)}${d.pinned ? 'Détacher' : 'Épingler en haut'}</button>
      <button class="mi" data-mact="hide">${svg(d.hidden ? I.eye : I.eyeoff)}${d.hidden ? 'Réafficher' : 'Masquer'}</button>
      <button class="mi" data-mact="studyall">${svg(I.play)}Tout revoir<span class="tail">${d.cards.length}</span></button>
      <button class="mi" data-mact="mcq">${svg(I.grid)}QCM</button>
      <button class="mi" data-mact="match">${svg(I.link)}Association</button>
      <button class="mi" data-mact="deckset">${svg(I.gear)}Réglages du livre</button>
      ${d.cards.filter(isLeech).length ? `<button class="mi" data-mact="studyleech">${svg(I.target)}Cartes coriaces<span class="tail">${d.cards.filter(isLeech).length}</span></button>` : ''}
      <div class="msep"></div>
      ${canUndo() ? `<button class="mi" data-mact="undo">${svg(I.redo)}Annuler<span class="tail">${esc(undoLabel())}</span></button>` : ''}
      ${d.cards.length ? `<button class="mi" data-mact="fnropen">${svg(I.search)}Chercher et remplacer</button>` : ''}
      <button class="mi" data-mact="versopen">${svg(I.clock)}Éditions précédentes</button>
      <button class="mi" data-mact="clone">${svg(I.copy)}Dupliquer</button>
      ${db.decks.length > 1 ? `<button class="mi" data-mact="mergeopen">${svg(I.link)}Fusionner avec…</button>` : ''}
      ${d.cards.length > 3 ? `<button class="mi" data-mact="splitopen">${svg(I.split)}Scinder<span class="tail">${d.cards.length}</span></button>` : ''}
      <button class="mi" data-mact="sharepick">${svg(I.share)}Partager</button>
      <button class="mi warn" data-mact="del">${svg(I.trash)}<span>Supprimer</span></button>
    </div>`;
  mountMenu(w);
}

export function paintMenu() {
  const ouverte = document.querySelector('.menu:not(.sort)');
  avant = ouverte ? photo(ouverte) : null;
  retirerFeuilles();
  const w = document.createElement('div');
  const painter = menuPainter(menu);
  /* une feuille qui renonce à se remonter (ses données ont disparu) ne
     laisse pas sa photo à la prochaine, qui s'ouvrirait sans entrée */
  try { return painter ? painter(w) : paintMenuDeck(w); } finally { avant = null; }
}

function paintMenuSubject(w) {
  const t = db.subjects.find(x => x.id === subjEdit) || { id: '', name: '', color: 'graphite' };
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <input class="tok" id="sn" placeholder="Nom de la matière" spellcheck="false"
          enterkeyhint="done" value="${esc(subjName)}">
        <div class="swatch">${COLORS.map(k => `<button class="sw2 ${k === subjColor ? 'on' : ''}"
          data-color="${k}" style="background:${PALETTE[k].c};--dd:${PALETTE[k].d}"></button>`).join('')}</div>
        <div class="msep"></div>
        ${t.id ? `<button class="mi warn" data-mact="subjdel">${svg(I.trash)}<span>Supprimer</span></button>` : ''}
        <button class="mi" data-mact="subjok" style="justify-content:center;font-weight:700">
          ${svg(I.check)}${t.id ? 'Enregistrer' : 'Créer'}</button>
      </div>`;
    mountMenu(w);
    const sn = document.getElementById('sn');
    sn.addEventListener('input', () => setSubjName(sn.value));
    sn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sn.blur(); } });
    setTimeout(() => { if (!subjName) sn.focus(); }, 60);
    return;
}

function paintMenuInstall(w) {
  return installSheet(w);
}


function paintMenuReport(w) {
  return reportSheet(w);
}

function paintMenuBlocked(w) {
  return blockedSheet(w);
}

function paintMenuBackup(w) {
  const n = db.decks.length, c = db.decks.reduce((a, x) => a + x.cards.length, 0);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <button class="mi" data-mact="backup-file">${svg(I.check)}Exporter toute ma bibliothèque
          <span class="tail">${n} · ${c}</span></button>
        <button class="mi" data-mact="backup-restore">${svg(I.arrow)}Restaurer depuis un fichier</button>
        <button class="mi" data-mact="backup">${svg(I.share)}Partager un lien (recto et verso seulement)</button>
      </div>`;
    mountMenu(w);
    return;
}
