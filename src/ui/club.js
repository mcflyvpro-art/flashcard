// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, cercle, duels, view } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { clubsPull, membresPull, sallesPull, termineesPull } from '../core/cercle.js';
import { classement, codeClubLisible } from '../club.js';
import { medailleHtml } from './jeton.js';
import { teinte } from '../jeton.js';
import { hlp } from './connexion.js';
import { JEUX, placeTexte } from '../defi.js';
import { avatar, defiLigne, enDirectHtml, iconeClub, ident, infos, parDefi, rangLigne } from './cercle.js';
import { duelsPull } from '../core/defis.js';
import { timeAgo } from './reglages-corbeille.js';

/* ══════════ la page d'un club ══════════
   Ce qui fait vivre un club : son identité (emblème, couleur, devise, que
   le chef choisit), ses défis, son classement, ses membres. Sur téléphone,
   trois onglets ; sur ordinateur, tout se lit d'un coup, défis à gauche,
   classement et membres à droite — c'est la même page, la feuille de style
   décide (data-onglet). */

export const ONGLETS = { defis: 'Défis', classement: 'Classement', membres: 'Membres' };

export const clubOuvert = () => (cercle.clubs || []).find(g => g.id === view.id);

export function clubPull(id) {
  if (cercle.clubs === null) clubsPull();
  if (!duels.list) duelsPull();
  membresPull(id);
  termineesPull(id, null);
  sallesPull();
}

function banniereHtml(g) {
  const n = (cercle.membres[g.id] || []).length || g.membres;
  return `<section class="cl-ban" style="--k:${teinte(g.teinte)}">
    <i class="cl-emb">${iconeClub(g)}</i>
    <div class="cl-ban-t"><h1>${esc(g.nom)}</h1>${g.devise ? `<p>${esc(g.devise)}</p>` : ''}</div>
    <div class="cl-stats"><span title="Membres">${svg(I.users)}<b>${n}</b></span>
      <span title="Pages lues cette semaine">${svg(I.book)}<b>${g.pages}</b></span>
      ${n > 1 && g.mes_pages ? `<span title="Ta place">${svg(I.trophy)}<b>${placeTexte(g.mon_rang)}</b></span>` : ''}</div>
    <div class="cl-ban-a">
      <button class="cl-chip" data-cc="club-inviter">${svg(I.plus)}Inviter<b>${esc(codeClubLisible(g.code))}</b></button>
      ${g.chef ? `<button class="cl-chip ic" data-cc="club-perso" aria-label="Personnaliser">${svg(I.pen)}</button>` : ''}
    </div>
  </section>`;
}

function defisPane(g) {
  const l = parDefi((duels.list || []).filter(d => d.group_id === g.id));
  const fin = cercle.terminees[g.id];
  return `<section class="cl-pane" data-pane="defis">
    <h2 class="cc-h">Défis</h2>
    ${!duels.list ? '<div class="cc-load"></div>' : l.length ? `<div class="cc-list">${l.map(d => defiLigne(d, false)).join('')}</div>`
      : `<p class="cc-vide">${svg(I.flame)}Aucun défi</p>`}
    ${fin && fin.length ? `<h2 class="cc-h">Parties</h2><div class="cc-list">${fin.map(p => `
      <div class="cl-partie"><i class="cc-defi-i">${svg(I.podium)}</i>
        <span class="cl-partie-t"><b>${esc(p.titre)}</b>${infos([['bolt', JEUX[p.jeu] ? JEUX[p.jeu].nom : ''], ['play', p.joueurs, 'Joueurs'],
          ['clock', p.fini_at ? timeAgo(p.fini_at) : '']])}
          <span class="cl-podium">${(p.podium || []).map((x, i) => `<span>${medailleHtml(i + 1)} ${esc(x.nom)} <small>${x.score}</small></span>`).join('')}</span></span>
        ${p.moi ? `<em class="cc-score"><b>${placeTexte(p.moi.place)}</b>${p.moi.score} pts</em>` : ''}</div>`).join('')}</div>` : ''}
  </section>`;
}

function classementPane(g) {
  const m = cercle.membres[g.id];
  if (!m) return `<section class="cl-pane" data-pane="classement"><h2 class="cc-h">Classement</h2><div class="cc-load"></div></section>`;
  const l = classement(m, 'pages', auth.uid);
  const champion = l[0] && l[0].pages ? l[0] : null;
  return `<section class="cl-pane" data-pane="classement">
    <h2 class="cc-h">Classement ${hlp('classementClub')}</h2>
    ${champion && l.length > 1 ? `<div class="cl-champion">${svg(I.crown)}${avatar(champion.user_id, ident(champion.pseudo, champion.nom))}<span>
      <b>${esc(champion.nom)}</b></span><em>${svg(I.book)}${champion.pages}</em></div>` : ''}
    <div class="cc-rank">${l.map(r => rangLigne(r, r.nom, [['check', Math.round(r.justes / (r.pages || 1) * 100) + ' %', 'Réponses justes'],
      ['cal', r.jours, 'Jours de lecture']])).join('')}</div>
  </section>`;
}

function membresPane(g) {
  const m = cercle.membres[g.id];
  return `<section class="cl-pane" data-pane="membres">
    <div class="cc-h"><h2>Membres <span>${m ? m.length : ''}</span></h2>
      <button class="cc-lnk" data-cc="club-inviter" aria-label="Inviter">${svg(I.plus)}</button></div>
    ${!m ? '<div class="cc-load"></div>' : `<div class="cc-list">${m.map(x => `
      <button class="cc-ligne" data-cc="membre" data-id="${esc(x.user_id)}">${avatar(x.user_id, ident(x.pseudo, x.nom))}
        <span class="cc-ligne-t"><b>${esc(x.nom)}${x.moi ? ' <small>toi</small>' : ''}</b><i>${x.pseudo ? '@' + esc(x.pseudo) : ''}</i></span>
        ${x.chef ? `<em class="cc-tag or" title="Chef du club">${svg(I.crown)}</em>` : ''}</button>`).join('')}</div>`}
  </section>`;
}

export function clubView() {
  const g = clubOuvert();
  if (!g) {
    $.innerHTML = `<div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button><h1>Club</h1></div>
      <div class="page cc">${cercle.clubs === null ? '<div class="cc-load"></div>'
        : `<p class="cc-vide">${svg(I.users)}Ce club n’existe plus, ou tu n’en fais plus partie.</p>`}</div>`;
    return;
  }
  const salles = (cercle.salles || []).filter(s => s.group_id === g.id);
  $.innerHTML = `
    <div class="bar cl-bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <button class="ic" data-cc="club-menu" aria-label="Options du club">${svg(I.more)}</button></div>
    <div class="page cc cl" data-onglet="${cercle.onglet}">
      ${banniereHtml(g)}
      ${enDirectHtml(salles)}
      <div class="cc-actions">
        <button class="cc-act pri" data-cc="defi" data-ou="club:${esc(g.id)}" data-mode="direct">${svg(I.bolt)}
          <b>Défi en direct</b></button>
        <button class="cc-act" data-cc="defi" data-ou="club:${esc(g.id)}" data-mode="rythme">${svg(I.clock)}
          <b>À son rythme</b></button>
      </div>
      <div class="seg cl-tabs" role="tablist">${Object.entries(ONGLETS).map(([k, n]) =>
        `<button role="tab" class="${cercle.onglet === k ? 'on' : ''}" aria-selected="${cercle.onglet === k}" data-cc="onglet" data-id="${k}">${n}</button>`).join('')}</div>
      <div class="cl-corps">
        ${defisPane(g)}
        <div class="cl-droite">${classementPane(g)}${membresPane(g)}</div>
      </div>
    </div>`;
}
