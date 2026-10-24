// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import {
  addQ, asks, auth, board, compte, duels, eleve as classesEleve, friends, groups, lib, mates, me,
  myRole, school, setAddQ, setAnimate, view
} from '../data/etat.js';
import { bindPager, render, tabs } from './bibliotheque.js';
import { atSchool, isPupil } from './classement.js';
import { boardPull, schoolPull } from '../core/classement.js';
import { esc, plur, shortWho } from '../core/coeur-sync.js';
import { groupsPull } from '../core/bilan-devoirs.js';
import { myScore, rankOf } from './defis.js';
import { duelsPull } from '../core/defis.js';
import { BRANGE } from './ecran-groupe.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { timeAgo } from './reglages-corbeille.js';
import { askFriend, friendsPull, libPull, mePull } from '../core/reglages-corbeille.js';

/* ══════════ communauté ══════════
   Un centre unique : qui tu es, qui tu connais, les groupes, les défis,
   l'étagère commune et le classement. Le reste de l'app n'a plus à parler
   de « groupe » ici et là — tout ce qui concerne les autres vit ici. */

/* tout ce que l'écran a besoin de savoir, en un seul aller-retour groupé */
export function commuPull() {
  if (!me) mePull().then(() => { if (view.name === 'commu') { setAnimate(false); render(); } });
  if (!friends) friendsPull();
  if (!groups && !atSchool()) groupsPull();   // pas de club à l'école
  if (!duels.list) duelsPull();
  if (!lib.list) libPull();
  if (!board.rows) boardPull();
  if (school === null) schoolPull().then(() => { if (view.name === 'commu') { setAnimate(false); render(); } });
  if (myRole === 'eleve' && !classesEleve.classes) eleveClassesPull();
}

export const initial = s => (String(s || '?').trim()[0] || '?').toUpperCase();

const ctile = (act, ic, lab, val, warn) => `<button class="ctile" data-act="${act}">
  <i class="ci">${svg(ic)}${warn ? `<b class="cbdg">${warn}</b>` : ''}</i>
  <span class="cn">${lab}</span><span class="cv">${val}</span></button>`;

/* Un élève de classe s'appelle « Prénom NOM » : c'est ce nom, imposé et
   verrouillé par la base, que porte sa carte — pas un pseudo. */
function meCardEleveHtml() {
  const nom = (compte && compte.nom) || (me && me.name) || 'Élève';
  const ou = school && school.org
    ? (school.classe ? `<b class="maclasse">${esc(school.classe)}</b> · ${esc(school.org)}` : esc(school.org))
    : 'Carte élève';
  return `<div class="mecard fixe">
        <i class="av">${esc(initial(nom))}</i>
        <span class="mex"><b>${esc(nom)}</b><i>${ou}</i></span></div>`;
}

function meCardAutreHtml(rows, mine, MED) {
  return `<button class="mecard" data-act="handle">
        <i class="av">${esc(initial(me && (me.handle || me.name)))}</i>
        <span class="mex"><b>${me && me.handle ? '@' + esc(me.handle) : 'Choisis ton pseudo'}</b>
          <i>${me && me.handle ? (mine >= 0 ? `${MED[mine] || (mine + 1) + 'ᵉ'} cette semaine · ${plur(+rows[mine].n, 'page')}`
            : 'Pas encore révisé cette semaine')
            : 'C’est ce que tes amis taperont pour t’ajouter'}</i></span>
        ${svg(I.arrow)}</button>`;
}

/* Un élève de classe (établissement ou carte) n'a ni pseudo à choisir, ni
   club, ni annuaire ouvert : ses trois tuiles sont Défis, Mes classes,
   Bibliothèque. Un compte personnel garde les siennes, plus une cinquième
   pour rejoindre la classe d'un professeur. */
function ctilesHtml(eleve, toPlay, nAsk, nLib, nMates, nGroup) {
  const aFaire = (classesEleve.devoirs || []).filter(d => d.etat !== 'rendu').length;
  if (eleve) {
    return `
          ${ctile('duels', I.flame, 'Défis', toPlay ? toPlay + ' à jouer' : '—', toPlay)}
          ${ctile('classes', I.school, 'Mes classes', aFaire ? aFaire + ' à faire' : '—', aFaire)}
          ${ctile('library', I.book, 'Bibliothèque', nLib || '—', 0)}`;
  }
  const nCl = (classesEleve.classes || []).filter(c => c.statut === 'inscrit').length;
  return `
          ${ctile('friends', I.user, 'Lecteurs', nMates || '—', nAsk)}
          ${atSchool() ? '' : ctile('groups', I.layers, 'Clubs', nGroup || '—', 0)}
          ${ctile('duels', I.flame, 'Défis', toPlay ? toPlay + ' à jouer' : '—', toPlay)}
          ${ctile('library', I.book, 'Bibliothèque', nLib || '—', 0)}
          ${atSchool() ? '' : ctile('classes', I.school, 'Classes', nCl ? (aFaire ? aFaire + ' à faire' : nCl) : 'Rejoindre', aFaire)}`;
}

function boardListHtml(rows) {
  if (!board.rows) return `<div class="card2"><div class="note">${board.err ? 'Indisponible' : 'Chargement…'}</div></div>`;
  if (!rows.length) return `<div class="card2"><div class="note">Ajoute un lecteur.</div></div>`;
  return `<div class="rows">${rows.slice(0, 3).map((x, i) => bdRow(x, i)).join('')}</div>`;
}

export function commuView() {
  const nMates = (mates || []).length, nAsk = (asks || []).length;
  const nGroup = (groups || []).length;
  const toPlay = (duels.list || []).filter(d => !myScore(d.id)).length;
  const nLib = (lib.list || []).length;
  const rows = board.rows || [];
  const mine = rows.findIndex(r => r.uid === auth.uid);
  const MED = ['🥇', '🥈', '🥉'];
  const eleve = isPupil();
  $.innerHTML = `
    <div class="page" id="page">
      <div class="top"><div class="hero">Le cercle des lecteurs</div></div>
      ${eleve ? meCardEleveHtml() : meCardAutreHtml(rows, mine, MED)}
      <div class="ctiles${eleve || atSchool() ? ' trois' : ' cinq'}">
        ${ctilesHtml(eleve, toPlay, nAsk, nLib, nMates, nGroup)}
      </div>
      <div class="lbl"><span>Classement de la semaine</span>
        ${rows.length > 3 ? '<button class="lnk" data-act="board">Tout voir</button>' : ''}</div>
      ${boardListHtml(rows)}
    </div>
    ${tabs('commu')}`;
  bindPager();
}

const bdRow = (x, i) => {
  const MED = ['🥇', '🥈', '🥉'];
  const top = Math.max(1, +((board.rows || [])[0] || {}).n || 1);
  return `<div class="bdr ${x.uid === auth.uid ? 'me' : ''}">
    <span class="bdp">${MED[i] || (i + 1)}</span>
    <span class="bdn"><b>${esc(x.who)}</b>
      <i>${plur(+x.n, 'page')} · ${Math.round(x.ok / (x.n || 1) * 100)} % juste · ${plur(+x.jours, 'jour')}</i>
      <em style="width:${Math.max(4, Math.round(x.n / top * 100))}%"></em></span></div>`;
};

export function friendsView() {
  const l = mates || [], a = asks || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Lecteurs</h1></div>
    <div class="page">
      <div class="fld addf"><input id="addq" type="search" placeholder="Pseudo d’un lecteur"
        autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(addQ)}"
        aria-label="Pseudo d’un lecteur"><button class="addgo" data-act="doadd">Ajouter</button></div>
      ${a.length ? `<div class="lbl"><span>Demandes reçues</span><span>${a.length}</span></div>
        <div class="slist">${a.map(f => `<div class="sr flat">
          <i class="av sm">${esc(initial(f.handle || f.name))}</i>
          <span class="n">@${esc(f.handle || '')}</span>
          <button class="fyes" data-yes="${f.id}">${svg(I.check)}</button>
          <button class="fno" data-no="${f.id}">${svg(I.x)}</button></div>`).join('')}</div>` : ''}
      <div class="lbl"><span>Mes lecteurs</span><span>${l.length || ''}</span></div>
      ${!friends ? `<div class="card2"></div>`
        : !l.length ? `<div class="empty">${svg(I.user)}<p><b>Personne pour l’instant</b>Ajoute quelqu’un par son pseudo.</p></div>`
        : `<div class="slist">${l.map(f => `<button class="sr flat" data-mate="${f.id}">
            <i class="av sm">${esc(initial(f.handle || f.name))}</i>
            <span class="ml2"><span class="n">${esc(f.name || '')}</span>
              <span class="sub">@${esc(f.handle || '')}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
  const q = document.getElementById('addq');
  if (q) {
    q.addEventListener('input', () => setAddQ(q.value));
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  }
}

export async function doAdd() {
  const v = addQ.trim(); if (!v) return;
  if (await askFriend(v)) { setAddQ(''); setAnimate(false); render(); }
}

export function groupsView() {
  const l = groups || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Clubs</h1></div>
    <div class="page">
      <div class="duo ghost">
        <button data-act="newgroup">${svg(I.plus)}Créer</button>
        <button data-act="joingroup">${svg(I.link)}Rejoindre</button>
      </div>
      ${!groups ? `<div class="card2"></div>`
        : !l.length ? `<div class="empty">${svg(I.layers)}<p><b>Aucun club</b>Une classe, un binôme : la même bibliothèque et les mêmes défis pour tous.</p></div>`
        : `<div class="slist">${l.map(g => `<button class="sr flat" data-group="${g.id}">
            ${svg(I.layers)}<span class="ml2"><span class="n">${esc(g.name)}</span>
              <span class="sub">code ${esc(g.code)}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
}

export function duelsView() {
  const l = duels.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Défis</h1></div>
    <div class="page">
      <button class="cta ghost" data-act="duelnew">${svg(I.flame)}Lancer un défi</button>
      ${!l ? `<div class="card2"><div class="note">${duels.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !l.length ? `<div class="empty">${svg(I.flame)}<p><b>Aucun défi</b>Dix questions d’un de tes livres, les mêmes pour tous.</p></div>`
        : `<div class="slist">${l.map(du => {
            const m = myScore(du.id), r = rankOf(du.id);
            const pos = m ? r.findIndex(x => x.user_id === auth.uid) + 1 : 0;
            return `<button class="sr flat" data-duel="${esc(du.id)}">${svg(I.flame)}
              <span class="ml2"><span class="n">${esc(du.name)}</span>
                <span class="sub">${esc(shortWho(du.who) || 'Un ami')} · ${plur(du.total, 'question')}${
                  r.length ? ' · ' + plur(r.length, 'joueur') : ''}</span></span>
              <span class="c">${m ? `<b class="dsc">${m.score}/${du.total}</b> ${pos === 1 ? '🥇' : pos + 'ᵉ'}`
                : '<span class="dnew">à jouer</span>'}</span>${svg(I.arrow)}</button>`;
          }).join('')}</div>`}
    </div>`;
}

export function libraryView() {
  const l = lib.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Bibliothèque</h1></div>
    <div class="page">
      ${!l ? `<div class="card2"><div class="note">${lib.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !l.length ? `<div class="empty">${svg(I.book)}<p><b>Bibliothèque vide</b>Prête un livre depuis son menu Partager.</p></div>`
        : `<div class="slist">${l.map(it => `<button class="sr flat" data-lib="${esc(it.deck_id)}">${svg(I.book)}
            <span class="ml2"><span class="n">${esc(it.name)}</span>
              <span class="sub">${esc(shortWho(it.who) || 'Un ami')}${it.subject ? ' · ' + esc(it.subject) : ''} · ${plur(it.n, 'page')}</span></span>
            <span class="c">${timeAgo(it.updated_at)}</span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
}

export function boardView() {
  const r = board.rows || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Classement</h1></div>
    <div class="page">
      <div class="seg" id="bRange">${Object.entries(BRANGE).map(([k, n]) =>
        `<button class="${board.range === +k ? 'on' : ''}" data-brange="${k}">${n}</button>`).join('')}</div>
      ${!board.rows ? `<div class="card2"><div class="note">${board.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !r.length ? `<div class="empty">${svg(I.trophy)}<p><b>Rien sur cette période</b></p></div>`
        : `<div class="rows">${r.map((x, i) => bdRow(x, i)).join('')}</div>
`}
    </div>`;
}
