import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { isLeech } from '../file.js';
import {
  DECKPAGE, accounts, adm, animate, asks, auth, classes, db, demo, dirty, filter, liveAt,
  liveSoon, liveT, mailbox, menu, myRole, online, pageDir, pagerEnd, peek, prefs, prof,
  reorder, setAnimate, setDeckOpen, setDeckQ, setDeckShow, setLiveAt, setLiveSoon, setLiveT,
  setPageDir, setPagerEnd, setPreviewOf, setView, stats, view
} from '../data/etat.js';
import {
  boardView, classeView, classesView, commuPull, commuView, duelsView, friendsView,
  groupsView, libraryView, profEleveView
} from './bilan-devoirs.js';
import { STATE, cstate, paintMedia } from './carte-media.js';
import {
  adminView, atSchool, isProf, isPupil, maClassePull, maClasseView, modView, refView
} from './classement.js';
import { accountsPull, admPull, boardPull, classesPull, refPull } from '../core/classement.js';
import { deck, esc, flush, live, pending, plur, pushUndo, save, sty, subj } from '../core/coeur-sync.js';
import { deckView, legalView, loginView, selOff } from './connexion.js';
import { duelView } from './defis.js';
import { duelsPull } from '../core/defis.js';
import { findView, groupView, statsView } from './ecran-groupe.js';
import { statsPull } from '../core/ecran-groupe.js';
import { profClasseView, profView } from './etablissement.js';
import { profPull } from '../core/etablissement.js';
import {
  applyFont, dropBoot, dueCount, savePrefs, simpleMode, todayCount
} from './import-cartes.js';
import { closeMenu, openMenu, paintMenu } from './menus-a.js';
import { importView, quizView, stopTimer } from './quiz.js';
import {
  mailView, settingsView, sharedView, trashView
} from './reglages-corbeille.js';
import { libPull, mailPull } from '../core/reglages-corbeille.js';
import { loadResume, studyView } from './revision.js';

/* ---------- synchronisation vivante ----------
   Le classement et le Journal ne doivent jamais attendre un rechargement.
   Tant qu'un de ces écrans est ouvert et que l'app est au premier plan,
   on redemande les chiffres à intervalle régulier ; on redemande aussi
   dès qu'on revient sur l'app, et une page jouée déclenche une mise à
   jour rapprochée pour que son effet se voie tout de suite. */
const LIVEMS = 15000;

const LIVEV = /^(stats|commu|board|duels|library|friends|groups|group)$/;

function livePull(force) {
  if (!auth || demo || document.hidden || !LIVEV.test(view.name)) return;
  if (!force && Date.now() - liveAt < 4000) return;
  setLiveAt(Date.now());
  if (view.name === 'stats') statsPull(1);
  else {
    boardPull(1);
    if (view.name === 'duels') duelsPull();
    if (view.name === 'library') libPull();
  }
}

function liveSync() {
  const want = auth && !demo && LIVEV.test(view.name);
  if (want && !liveT) { setLiveT(setInterval(livePull, LIVEMS)); livePull(); }
  if (!want && liveT) { clearInterval(liveT); setLiveT(0); }
}

/* Après une page jouée : le serveur vient d'encaisser la ligne, on lui
   laisse un souffle puis on redemande le décompte partagé. */
export function liveBump() {
  clearTimeout(liveSoon);
  setLiveSoon(setTimeout(() => livePull(true), 1200));
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) livePull(true); });

window.addEventListener('focus', () => livePull(true));

export function render() {
  const v = { home, deck: deckView, study: studyView, import: importView,
              run: quizView, login: loginView, settings: settingsView, trash: trashView, mail: mailView, stats: statsView, find: findView,
              group: groupView, shared: sharedView, duel: duelView, legal: legalView, mod: modView,
              classes: classesView, classe: classeView, maclasse: maClasseView,
              prof: profView, profclasse: profClasseView, profeleve: profEleveView,
              ref: refView,
              admin: adminView,
              commu: commuView, friends: friendsView, groups: groupsView,
              duels: duelsView, library: libraryView, board: boardView };
  $.classList.remove('fade');
  if (animate) void $.offsetWidth;             // force un vrai redémarrage si elle était déjà là
  (v[view.name] || home)();
  $.dataset.view = view.name;
  applyFont();
  paintRail();
  paintMedia($);                               // les images posées sans adresse la reçoivent ici
  if (animate) $.classList.add('fade');
  if (pageDir) {
    const pg = document.getElementById('page');
    if (pg) pg.classList.add(pageDir < 0 ? 'in-right' : 'in-left');
    setPageDir(0);
  }
  setAnimate(false);
  const on = $.querySelector('.pills .p.on');
  if (on && on.previousElementSibling) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (menu) paintMenu();
  liveSync();
  dropBoot();
}

export function go(name, id, dir) {
  closeMenu();
  if (name !== 'run') stopTimer();
  if (name !== 'deck' || id !== view.id) { selOff(); setDeckQ(''); setDeckOpen(false); setDeckShow(DECKPAGE); }
  setPageDir(dir || 0); setView({ name, id }); setAnimate(!dir);
  render(); window.scrollTo(0, 0);
}

function railOn() {
  if (view.name === 'settings') return 'settings';
  if (view.name === 'mail') return 'mail';
  if (view.name === 'stats') return 'stats';
  if (/^(classes|classe|maclasse|prof|ref$|admin$)/.test(view.name)) return 'classes';
  if (/commu|friends|groups|duels|library|board|shared/.test(view.name)) return 'commu';
  return 'home';
}

function railClasseNom() {
  if (myRole === 'ref') return 'Mon établissement';
  if (myRole === 'admin') return 'Administration';
  return isProf() ? 'Mes classes' : 'Ma classe';
}

const railEntry = (on, k, ic, nom, badge) => `<button class="${on === k ? 'on' : ''}" data-r="${k}">${
  svg(ic)}<span>${nom}</span>${badge ? `<i class="icb">${badge}</i>` : ''}</button>`;

const railMailBadge = () => mailbox.n ? (mailbox.n > 9 ? '9+' : mailbox.n) : 0;

function railNavBoulot(on, classeNom) {
  const ent = (k, ic, nom, badge) => railEntry(on, k, ic, nom, badge);
  return `
    <div class="brand"><img src="icons/icon-192.png" alt=""><span>Folio</span></div>
    <nav>
      ${ent('classes', I.school, classeNom)}
      ${ent('home', I.layers, 'Livres')}
      ${ent('mail', I.mail, 'Courrier', railMailBadge())}
      ${ent('settings', I.gear, 'Réglages')}
    </nav>
    <div class="sp"></div>
    <div class="who">${svg(I.user)}<span>${esc(prefs.name || auth.email)}</span></div>`;
}

const railHasClasses = () => isProf() || atSchool() || !!(classes || []).length;

function railNavHome(on, classeNom) {
  const ent = (k, ic, nom, badge) => railEntry(on, k, ic, nom, badge);
  return `
    <div class="brand"><img src="icons/icon-192.png" alt=""><span>Folio</span></div>
    <nav>
      ${ent('home', I.layers, 'Livres')}
    </nav>
    <div class="sp"></div>
    <nav>
      ${ent('stats', I.chart, 'Journal')}
      ${railHasClasses() ? ent('classes', I.school, classeNom) : ''}
      ${ent('commu', I.user, 'Le cercle', (asks || []).length)}
      ${ent('mail', I.mail, 'Courrier', railMailBadge())}
      ${ent('settings', I.gear, 'Réglages')}
    </nav>
    <div class="who">${svg(I.user)}<span>${esc(prefs.name || auth.email)}</span></div>`;
}

function railClickClasses() {
  if (isPupil()) { maClassePull(); return go('maclasse'); }
  if (myRole === 'admin') { if (!accounts) accountsPull(); if (!adm.orgs) admPull(); return go('admin'); }
  if (myRole === 'ref' && atSchool()) { refPull(); return go('ref'); }
  if (isProf() && atSchool()) { if (!prof.classes) profPull(); return go('prof'); }
  if (!classes) classesPull(); return go('classes');
}

function railClick(e) {
  const b = e.target.closest('[data-r]'); if (!b) return;
  if (b.dataset.r === 'mail') { mailbox.list = null; mailPull(); return go('mail'); }
  if (b.dataset.r === 'stats') { stats.rows = null; statsPull(); return go('stats'); }
  if (b.dataset.r === 'commu') { commuPull(); return go('commu'); }
  if (b.dataset.r === 'classes') return railClickClasses();
  go(b.dataset.r === 'settings' ? 'settings' : 'home');
}

function paintRail() {
  let r = document.getElementById('rail');
  if (!auth || view.name === 'login') {
    if (r) r.remove();
    document.documentElement.classList.remove('nav-haut');
    return;
  }
  const on = railOn();
  /* Un compte d'établissement travaille, il ne révise pas : ni journal de
     lecture, ni cercle des lecteurs. Quatre entrées, et elles passent en
     barre horizontale — la page de gestion prend alors toute la largeur au
     lieu de vivre dans les trois quarts restants. */
  const boulot = atSchool() && myRole !== 'eleve';
  const sig = on + '\u0000' + (prefs.name || auth.email) + '\u0000' + mailbox.n
            + '\u0000' + myRole + '\u0000' + (boulot ? 'h' : 'v');
  if (r && r.dataset.sig === sig) return;      // rien n'a changé : on ne redessine pas
  if (!r) { r = document.createElement('aside'); r.id = 'rail'; document.body.appendChild(r); }
  r.dataset.sig = sig;
  r.className = boulot ? 'haut' : '';
  document.documentElement.classList.toggle('nav-haut', boulot);
  const classeNom = railClasseNom();
  r.innerHTML = boulot ? railNavBoulot(on, classeNom) : railNavHome(on, classeNom);
  r.onclick = railClick;
}

/* Deux écrans de premier niveau, donc deux onglets et un balayage entre
   les deux. C'est la seule navigation horizontale de l'app : partout
   ailleurs on entre et on ressort par la flèche. */
export const tabs = on => `<div class="tabs">
  <div class="sl" style="transform:translateX(${on === 'commu' ? 74 : 0}px)"></div>
  <button class="${on === 'home' ? 'on' : ''}" data-act="tab-home" aria-label="Ma bibliothèque"
    aria-current="${on === 'home' ? 'page' : 'false'}">${svg(I.layers)}</button>
  <button class="${on === 'commu' ? 'on' : ''}" data-act="tab-commu" aria-label="Le cercle des lecteurs"
    aria-current="${on === 'commu' ? 'page' : 'false'}">${svg(I.user)}${
      (asks || []).length ? `<i class="icb">${(asks || []).length}</i>` : ''}</button>
</div>`;

/* balayage horizontal entre « Mes paquets » et « Communauté » */
export function bindPager() {
  if (reorder) return;   // le rangement fige la page : plus rien d'autre ne bouge
  const pg = document.getElementById('page'); if (!pg) return;
  const home = view.name === 'home';
  let x0 = 0, y0 = 0, dx = 0, on = false, lock = 0, t0 = 0, raf = 0, pid = -1;
  const draw = () => {
    raf = 0;
    if (!on) return;
    const edge = home ? dx > 0 : dx < 0;
    pg.style.transform = `translate3d(${(edge ? dx * .26 : dx).toFixed(1)}px,0,0)`;
  };
  const reset = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pg.style.transition = ''; pg.style.transform = '';
  };
  /* Une bande de pastilles défile toute seule : tant qu'elle a de quoi
     défiler du côté où va le doigt, c'est elle qui prend le geste. Une
     fois au bout, le geste redevient un changement d'écran — avant, poser
     le doigt dessus annulait le balayage pour de bon. */
  let strip = null;
  pg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button) return;
    if (e.target.closest('.rng,.seg')) return;
    strip = e.target.closest('.pills,.heat,.mixwrap');
    on = true; lock = 0; dx = 0; x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); pid = e.pointerId;
    pg.style.transition = 'none';
  });
  pg.addEventListener('pointermove', e => {
    if (!on || e.pointerId !== pid) return;
    const ax = e.clientX - x0, ay = e.clientY - y0;
    if (!lock) {
      if (Math.abs(ax) < 9 && Math.abs(ay) < 9) return;
      lock = Math.abs(ax) > Math.abs(ay) * 1.3 ? 1 : -1;
      if (lock < 0) { on = false; reset(); return; }
      if (strip) {
        const room = ax > 0 ? strip.scrollLeft
                            : strip.scrollWidth - strip.clientWidth - strip.scrollLeft;
        if (room > 1) { on = false; reset(); return; }
      }
    }
    dx = ax;
    if (!raf) raf = requestAnimationFrame(draw);
  });
  const end = () => {
    if (!on) return; on = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pg.style.transition = '';
    const v = Math.abs(dx) / Math.max(1, Date.now() - t0);
    const far = Math.abs(dx) > innerWidth * .28 || (v > .55 && Math.abs(dx) > 40);
    const go2 = far && (home ? dx < 0 : dx > 0);
    pg.style.transform = '';
    if (go2) { if (home) { commuPull(); go('commu', null, 1); } else go('home', null, -1); }
  };
  /* le doigt finit souvent sa course hors de la page : sans écouter la
     fenêtre, le balayage restait suspendu à mi-chemin. La page est
     redessinée à chaque écran, la fenêtre non : on retire l'écoute
     précédente avant d'en poser une nouvelle. */
  pg.addEventListener('pointerup', end);
  pg.addEventListener('pointercancel', end);
  if (pagerEnd) { removeEventListener('pointerup', pagerEnd); removeEventListener('pointercancel', pagerEnd); }
  setPagerEnd(end);
  addEventListener('pointerup', pagerEnd);
  addEventListener('pointercancel', pagerEnd);
}

export const pills = (active, list, act) => `<div class="pills">
  <button class="p ${active === '' ? 'on' : ''}" data-${act}="">Tout</button>
  ${list.map(s => `<button class="p ${active === s.id ? 'on' : ''}" data-${act}="${s.id}" style="--d:${s.d}">
    <i></i>${esc(s.name)}</button>`).join('')}
</div>`;

const maturePct = d => d.cards.length
  ? Math.round(d.cards.filter(c => cstate(c) === 'mature').length / d.cards.length * 100) : 0;

const tile = (d, i) => {
  const due = simpleMode() ? 0 : dueCount(d);
  const p = simpleMode() ? 0 : maturePct(d);
  return `<button class="tile ${d.hidden ? 'mute' : ''}" data-go="${d.id}" data-peek="${d.id}"
  data-id="${d.id}" data-pin="${d.pinned ? 1 : 0}"
  style="${sty(subj(d.subject))};--i:${i}">
  <i class="spine" aria-hidden="true"></i>
  ${due ? `<i class="due">${due}</i>` : ''}
  ${d.pinned ? `<i class="pind">${svg(I.pin)}</i>` : ''}
  <span class="n">${esc(d.name)}</span>
  <span class="m">${svg(d.hidden ? I.eyeoff : I.card)}${d.cards.length}</span>
  ${p ? `<i class="tbar"><b style="width:${p}%"></b></i>` : ''}
</button>`;
};

/* Vue liste : plus dense que la grille dès qu'il y a beaucoup de paquets,
   et c'est elle qui porte la poignée quand on réorganise. */
const listRow = (d, i) => {
  const due = simpleMode() ? 0 : dueCount(d);
  const p = simpleMode() ? 0 : maturePct(d);
  return `<div class="lrow ${d.hidden ? 'mute' : ''}" style="${sty(subj(d.subject))};--i:${i}"
    data-id="${d.id}" data-pin="${d.pinned ? 1 : 0}">
    ${reorder ? `<i class="grip">${svg(I.grip)}</i>` : `<i class="ldot"></i>`}
    <button class="lmain" data-go="${d.id}" data-peek="${d.id}">
      <span class="n">${esc(d.name)}${d.pinned ? svg(I.pin) : ''}</span>
      <span class="s">${plur(d.cards.length, 'page')}${p ? ' · ' + p + ' % mûres' : ''}</span>
    </button>
    ${due ? `<i class="ldue">${due}</i>` : ''}
  </div>`;
};

/* Tri de l'accueil. « Manuel » garde l'ordre que tu as posé toi-même ;
   les paquets épinglés passent devant dans tous les cas. */
export const SORTS = { manual: 'Manuel', recent: 'Récents', az: 'A → Z', size: 'Taille', best: 'Réussite' };

function sortDecks(list) {
  const rate = d => {
    const h = [];
    for (const k of Object.keys(db.hist)) if (k.startsWith(d.id + ':')) h.push(...db.hist[k]);
    return h.length ? h.reduce((a, x) => a + x.p, 0) / h.length : -1;
  };
  const by = {
    manual: (a, b) => (a.pos || 0) - (b.pos || 0),
    recent: (a, b) => (b.pos || 0) - (a.pos || 0),
    az: (a, b) => a.name.localeCompare(b.name, 'fr'),
    size: (a, b) => b.cards.length - a.cards.length,
    best: (a, b) => rate(b) - rate(a)
  }[prefs.sort] || ((a, b) => (a.pos || 0) - (b.pos || 0));
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || by(a, b));
}

/* Anneau d'objectif du jour, en tête de l'accueil */
function goalRing() {
  const n = todayCount(), g = Math.max(1, prefs.goal || 30);
  const p = Math.min(1, n / g);
  return `<button class="goal" data-act="goalinfo" title="${n} / ${g} aujourd'hui">
    <svg viewBox="0 0 44 44"><circle class="b" cx="22" cy="22" r="18"/>
      <circle class="f" cx="22" cy="22" r="18"
        style="stroke-dasharray:113;stroke-dashoffset:${(113 * (1 - p)).toFixed(1)}"/></svg>
    <b>${n}</b></button>`;
}

/* Le point gris disait « hors ligne » sans dire ce qui attendait. Un
   compteur vaut mieux : on sait ce qu'on risque en fermant l'app, et on
   peut relancer l'envoi à la main sans attendre la prochaine minute. */
export function queueChip() {
  const n = pending();
  if (online && !n) return '<span id="offdot" class="off-dot" style="display:none"></span>';
  return `<button class="qchip ${online ? '' : 'off'}" data-act="retry"
    aria-label="${n ? n + ' modification' + (n > 1 ? 's' : '') + ' en attente d’envoi'
      : 'Hors ligne'}${online ? '' : ', hors ligne'}">
    ${svg(online ? I.cloud : I.warn)}${n ? `<b>${n}</b>` : 'hors ligne'}</button>`;
}

function mailBadge() {
  return mailbox.n ? `<i class="icb">${mailbox.n > 9 ? '9+' : mailbox.n}</i>` : '';
}

function peekButton(hidden) {
  if (!hidden) return '';
  return `<button class="ic ${peek ? 'solid' : ''}" data-act="peek">${svg(peek ? I.eye : I.eyeoff)}</button>`;
}

function sortRow(list) {
  if (list.length <= 2 || reorder) return '';
  return `<div class="hbar">
    <button class="lnk" data-act="sortpick">${svg(I.sort)}${SORTS[prefs.sort] || 'Manuel'}</button>
    <div style="flex:1"></div>
    <button class="lnk" data-act="listview" aria-label="Changer d’affichage">${svg(prefs.list ? I.grid : I.rows)}</button>
  </div>`;
}

function deckList(list) {
  if (!list.length) {
    return `<div class="empty">${svg(I.layers)}<p><b>Ta bibliothèque est vide</b>Appuie sur + pour écrire ton premier livre.</p></div>`;
  }
  const sorted = sortDecks(list);
  return prefs.list
    ? `<div class="rows lst ${reorder ? 'reord' : ''}">${sorted.map(listRow).join('')}</div>`
    : `<div class="grid ${reorder ? 'reord' : ''}">${sorted.map(tile).join('')}</div>`;
}

function marathonBanner() {
  if (simpleMode() || !allDue()) return '';
  return `<button class="marathon" data-act="marathon">${svg(I.shuffle)}
    <span>Lecture du jour</span><i>${allDue()} pages dues, toutes matières</i></button>`;
}

function homeFab() {
  return reorder
    ? `<button class="fab fabok" data-act="reorder" aria-label="Valider l’ordre">${svg(I.check)}</button>`
    : `<button class="fab" data-act="new" aria-label="Nouveau livre">${svg(I.plus)}<span>Nouveau livre</span></button>`;
}

function home() {
  const used = db.subjects.filter(s => db.decks.some(d => d.subject === s.id && (peek || !d.hidden))).map(x => subj(x.id));
  const hidden = db.decks.some(d => d.hidden);
  const list = db.decks.filter(d => (peek || !d.hidden) && (!filter || d.subject === filter));
  $.innerHTML = `
    <div class="page ${reorder ? 'frozen' : ''}" id="page">
      <div class="top">
        <div class="hero">Mes livres</div>
        ${queueChip()}
        ${goalRing()}
        <button class="ic" data-act="find" aria-label="Rechercher">${svg(I.search)}</button>
        <button class="ic icmail" data-act="mail" aria-label="Boîte de réception">${svg(I.mail)}${mailBadge()}</button>
        <button class="ic" data-act="settings" aria-label="Réglages">${svg(I.gear)}</button>
        ${peekButton(hidden)}
      </div>
      ${resumeBanner()}
      ${used.length > 1 ? pills(filter, used, 'filt') : ''}
      ${list.length ? subBar(list) : ''}
      ${sortRow(list)}
      ${deckList(list)}
      ${marathonBanner()}
    </div>
    ${homeFab()}
    ${tabs('home')}`;
  $.classList.toggle('reordering', reorder);
  bindPager();
  if (reorder) bindDeckOrder();
  bindPeek();
}

/* Progression de la sélection courante, en une ligne fine : la part de
   chaque état de carte, matière par matière quand aucun filtre n'est posé. */
function subBar(list) {
  if (simpleMode()) return '';
  const k = { new: 0, learn: 0, young: 0, mature: 0, susp: 0 };
  list.forEach(d => d.cards.forEach(c => k[cstate(c)]++));
  const tot = k.new + k.learn + k.young + k.mature;
  if (!tot) return '';
  return `<div class="sbar" title="${k.mature} mûres sur ${tot}">
    ${['mature', 'young', 'learn', 'new'].filter(x => k[x])
      .map(x => `<i class="${x}" style="flex:${k[x]}"></i>`).join('')}
  </div>`;
}

/* ---------- ranger sa bibliothèque ----------
   On appuie sur un livre, on le garde sous le doigt, on le pose ailleurs.
   Le même geste marche sur les couvertures et sur la liste : la vue ne
   change pas quand on entre en rangement, c'est le rangement qui s'adapte
   à la vue. Et il n'existe que dans ce mode — ailleurs, l'appui long
   ouvre les actions du livre.
   Les épinglés gardent leur tête de file : on ne peut déplacer un livre
   qu'au sein de son propre groupe, sinon le tri le remonterait aussitôt
   et le geste passerait pour cassé. */
function bindDeckOrder() {
  const wrap = $.querySelector('.grid.reord, .rows.lst.reord'); if (!wrap) return;
  const grid = wrap.classList.contains('grid');
  const SEL = grid ? '.tile' : '.lrow';
  let g = null, hold = 0;

  const items = () => [...wrap.querySelectorAll(SEL)];
  /* translate/scale sont posées à part de « transform » : le tremblement
     des livres non tenus tourne sur `rotate`, et les deux ne se marchent
     jamais dessus.
     Le livre tenu doit rester sous le doigt même quand `slot()` le
     réinsère ailleurs dans la liste — sa position « au repos » change
     alors sans prévenir. `getBoundingClientRect()` ne renvoie que la
     position peinte, translation déjà comprise : il faut en retrancher
     la translation qu'on a posée la fois d'avant pour retrouver le repos
     réel, sinon chaque image recalculait sa cible à partir d'un point de
     départ faux, et le livre partait à la dérive au lieu de suivre le
     doigt. g.tx/g.ty gardent donc la translation actuellement posée. */
  const LIFT_SCALE = 1.06;
  const place = () => {
    const r = g.el.getBoundingClientRect();
    /* Le grossissement du livre tenu (scale 1.06, centré) élargit sa
       boîte de façon symétrique et déplace donc son bord gauche/haut
       vers l'intérieur : une fois posé, `getBoundingClientRect()` ne
       renvoie plus le repos + la translation, mais repos + translation
       - ce décalage de mise à l'échelle (calculé sur sa taille d'origine,
       fixée une fois pour toutes à la prise — la taille mesurée après
       coup est déjà grossie). Sans le retrancher, chaque image partait
       d'un repos faux d'une dizaine de pixels — c'est ce qui faisait
       dériver le livre loin du doigt. */
    const dsx = g.scaled ? g.ow * (LIFT_SCALE - 1) / 2 : 0;
    const dsy = g.scaled ? g.oh * (LIFT_SCALE - 1) / 2 : 0;
    const restX = r.left + dsx - g.tx, restY = r.top + dsy - g.ty;
    g.tx = (g.bx + g.px - g.x0) - restX;
    g.ty = (g.by + g.py - g.y0) - restY;
    g.el.style.translate = `${g.tx.toFixed(1)}px ${g.ty.toFixed(1)}px`;
    g.el.style.scale = String(LIFT_SCALE);
    g.scaled = true;
  };
  /* on replace la couverture dans le flux, puis on remet les autres à
     leur place d'avant le temps d'une animation : elles glissent au lieu
     de sauter d'un coup. */
  const slot = () => {
    const others = items().filter(n => n !== g.el && n.dataset.pin === g.pin);
    const before = n => {
      const r = n.getBoundingClientRect();
      if (!grid) return g.py < r.top + r.height / 2;
      if (g.py < r.top) return true;
      if (g.py > r.bottom) return false;
      return g.px < r.left + r.width / 2;
    };
    const k = others.findIndex(before);
    const ref = k < 0 ? (others.length ? others[others.length - 1].nextSibling : null) : others[k];
    if (ref === g.el || (k < 0 && g.el.nextSibling === ref)) return;
    const was = new Map(items().map(n => [n, n.getBoundingClientRect()]));
    wrap.insertBefore(g.el, ref);
    for (const n of items()) {
      if (n === g.el) continue;
      const o = was.get(n); if (!o) continue;
      const r = n.getBoundingClientRect();
      const dx = o.left - r.left, dy = o.top - r.top;
      if (!dx && !dy) continue;
      n.style.transition = 'none';
      n.style.translate = `${dx}px ${dy}px`;
      requestAnimationFrame(() => { n.style.transition = ''; n.style.translate = ''; });
    }
  };
  const lift = () => {
    const r = g.el.getBoundingClientRect();
    g.bx = r.left; g.by = r.top; g.tx = 0; g.ty = 0; g.ow = r.width; g.oh = r.height;
    g.el.classList.add('drag');
    wrap.classList.add('dragging');
    try { g.el.setPointerCapture(g.pid); } catch (e) { /* capture refusée : le glissé continue sans elle */ }
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* vibration refusée ou non permise : sans effet sur le geste */ }
    place();
  };
  wrap.addEventListener('pointerdown', e => {
    const el = e.target.closest(SEL); if (!el || g) return;
    g = { el, px: e.clientX, py: e.clientY, x0: e.clientX, y0: e.clientY,
          pid: e.pointerId, pin: el.dataset.pin || '0', up: 0, bx: 0, by: 0, tx: 0, ty: 0 };
    el.classList.add('hold');
    clearTimeout(hold);
    hold = setTimeout(() => { if (g) { g.up = 1; lift(); } }, 260);
  });
  wrap.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.pid) return;
    g.px = e.clientX; g.py = e.clientY;
    if (!g.up) {
      if (Math.abs(g.px - g.x0) > 8 || Math.abs(g.py - g.y0) > 8) {
        clearTimeout(hold); g.el.classList.remove('hold'); g = null;
      }
      return;
    }
    e.preventDefault();
    /* slot() d'abord : elle peut réinsérer le livre ailleurs dans la
       grille (nouvelle rangée, nouvelle colonne) selon où en est le
       doigt. Appeler place() après lui laisse toujours mesurer la
       position de repos définitive de cette image — dans l'autre sens,
       place() se basait sur le repos d'avant le réarrangement et le
       livre sautait d'un coup avant de se corriger à l'image suivante. */
    slot(); place();
  });
  const drop = e => {
    if (!g || (e && e.pointerId !== g.pid)) return;
    clearTimeout(hold);
    const { el, up } = g;
    el.classList.remove('hold');
    g = null;
    if (!up) return;
    el.style.transition = ''; el.style.translate = ''; el.style.scale = '';
    el.classList.remove('drag'); wrap.classList.remove('dragging');
    const ids = items().map(n => n.dataset.id);
    if (ids.some(x => !x)) return;
    pushUndo('Ordre des livres', ids);
    ids.forEach((id, i) => { const d = deck(id); if (d) { d.pos = i; dirty[id] = 1; } });
    if (prefs.sort !== 'manual') { prefs.sort = 'manual'; savePrefs(); }
    save(); flush(); setAnimate(false); render();
  };
  wrap.addEventListener('pointerup', drop);
  wrap.addEventListener('pointercancel', drop);
}

/* Aperçu : un appui long sur un paquet (ou le survol sur un écran qui en
   a un) montre ses premières cartes sans quitter l'accueil. */
function bindPeek() {
  /* #app ne change pas d'un écran à l'autre : une seule écoute suffit,
     sinon chaque rendu en empilait une de plus. */
  if ($.dataset.peekbound) return;
  $.dataset.peekbound = 1;
  let t = 0, moved = false;
  let held = null;
  const start = e => {
    if (reorder) return;                     // en rangement, l'appui long déplace
    const b = e.target.closest('[data-peek]'); if (!b) return;
    moved = false;
    clearTimeout(t);
    /* le livre s'enfonce doucement sous le doigt : on voit que quelque
       chose se prépare, au lieu d'une feuille qui surgit sans prévenir */
    held = b.closest('.tile, .lrow') || b;
    held.classList.add('hold');
    t = setTimeout(() => { if (!moved) { setPreviewOf(b.dataset.peek); openMenu('preview'); } }, 480);
  };
  const stop = () => {
    moved = true; clearTimeout(t);
    if (held) { held.classList.remove('hold'); held = null; }
  };
  $.addEventListener('pointerdown', start);
  $.addEventListener('pointermove', stop);
  $.addEventListener('pointerup', stop);
  $.addEventListener('pointercancel', stop);
  $.addEventListener('scroll', stop, true);
}

export const allDue = () => live().reduce((a, d) => a + dueCount(d), 0);

function resumeBanner() {
  const r = loadResume();
  if (!r) return '';
  const left = r.queue.length - r.i;
  return `<button class="resume" data-act="resume">${svg(I.play)}
    <span>Reprendre ${esc(r.name || '')}</span><i>${left} carte${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}</i></button>`;
}

/* Répartition nouvelle / apprentissage / jeune / mûre, en une barre */
export function mixBar(d) {
  const n = d.cards.length; if (!n) return '';
  const k = { new: 0, learn: 0, young: 0, mature: 0, susp: 0 };
  d.cards.forEach(c => k[cstate(c)]++);
  const seg = ['new', 'learn', 'young', 'mature', 'susp']
    .filter(x => k[x]).map(x => `<i class="${x}" style="flex:${k[x]}" title="${STATE[x]} : ${k[x]}"></i>`).join('');
  const leech = d.cards.filter(isLeech).length;
  return `<div class="mixwrap">
    <div class="mix">${seg}</div>
    <div class="mixk">
      ${['new', 'learn', 'young', 'mature'].filter(x => k[x])
        .map(x => `<span><i class="${x}"></i>${STATE[x]} ${k[x]}</span>`).join('')}
      ${leech ? `<span class="lee">${svg(I.target)}${leech} coriace${leech > 1 ? 's' : ''}</span>` : ''}
    </div></div>`;
}

/* Une carte est « enrichie » dès qu'elle porte autre chose que deux textes. */
export const cardRich = c => !!(c.t || c.fi || c.bi || c.fa || c.ba || (c.g || []).length);

export const cardIcon = c => c.t === 'tf' ? I.type : (c.fi || c.bi) ? I.image
                    : (c.fa || c.ba) ? I.sound : (c.g || []).length ? I.tag : I.more;
