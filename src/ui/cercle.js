// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import {
  addQ, asks, auth, board, cercle, compte, duels, friends, mates, mates2, me, school, setAddQ, setAnimate, setMateOpen, view
} from '../data/etat.js';
import { bindPager, go, monIdent, render, tabs } from './bibliotheque.js';
import { isPupil } from './classement.js';
import { boardPull, schoolPull } from '../core/classement.js';
import { esc, shortWho } from '../core/coeur-sync.js';
import { clubsPull, profilPull, sallesPull } from '../core/cercle.js';
import { toast } from './import-cartes.js';
import { classement, medaille } from '../club.js';
import { avatar, blasonClub, iconeEmbleme, medailleHtml } from './jeton.js';
import { hlp } from './connexion.js';
import { placeTexte } from '../defi.js';
import { myScore, rankOf } from './defis.js';
import { duelsPull } from '../core/defis.js';
import { camaradesHtml } from './eleve-classes.js';
import { askFriend, friendsPull, mePull } from '../core/reglages-corbeille.js';

/* ══════════ le cercle des lecteurs ══════════
   Refait le 2026-10-24. Trois choses, pas une de plus : des AMIS, des
   CLUBS, des DÉFIS. Ce qui vivait ici et n'en faisait pas partie en est
   sorti : « Mes classes » a son propre onglet (et seulement pour les comptes
   d'une classe), la bibliothèque commune a disparu, les défis ne sont plus
   une tuile à part mais ce qu'on fait avec ses amis et dans ses clubs.

   L'écran se lit de haut en bas comme on s'en sert : qui je suis, les deux
   gestes (lancer un défi, entrer un code), ce qui se joue en ce moment,
   mes clubs ; à côté (sur ordinateur) ou plus bas (sur téléphone), où j'en
   suis face à mes amis. */

export const BRANGE = { 7: '7 jours', 30: '30 jours', 365: 'Toujours' };

export { avatar };
export const iconeClub = g => iconeEmbleme(g.embleme);

/* Une ligne de petites infos, en icônes : [[icône, valeur, ce qu'elle dit], …] */
export const infos = l => `<span class="cc-infos">${l.filter(x => x && x[1] !== '' && x[1] != null).map(([ic, v, t]) =>
  `<span${t ? ` title="${esc(t)}"` : ''}>${ic ? svg(I[ic]) : ''}${esc(String(v))}</span>`).join('')}</span>`;

/* tout ce que l'écran a besoin de savoir, lancé en parallèle */
export function commuPull() {
  if (!me) mePull().then(() => { if (view.name === 'commu') { setAnimate(false); render(); } });
  if (!friends) friendsPull();
  if (!duels.list) duelsPull();
  if (!board.rows) boardPull();
  if (!isPupil() && cercle.clubs === null) clubsPull();
  sallesPull();
  if (school === null) schoolPull().then(() => { if (view.name === 'commu') { setAnimate(false); render(); } });
}

/* ---------- qui je suis ---------- */
function maLigne() {
  return classement(board.rows || [], 'n', auth.uid).find(r => r.moi);
}

function moiInfos() {
  const r = maLigne(), n = (board.rows || []).length;
  return infos([['book', r ? +r.n : 0, 'Pages lues cette semaine'],
    r && +r.n && n > 1 ? ['trophy', placeTexte(r.place) + ' / ' + n, 'Ta place face à tes amis'] : null]);
}

function moiEleve() {
  const nom = (compte && compte.nom) || (me && me.name) || 'Élève';
  const ou = school && school.classe ? `${school.classe}${school.org ? ' · ' + school.org : ''}` : 'Carte élève';
  return `<button class="cc-moi" data-cc="moi">${avatar(auth.uid, monIdent(), 'lg')}
    <span class="cc-moi-t"><b>${esc(nom)}</b>${infos([['school', ou]])}${moiInfos()}</span>${svg(I.pen)}</button>`;
}

function moiHtml(eleve) {
  if (eleve) return moiEleve();
  const h = me && me.handle;
  return `<button class="cc-moi" data-cc="moi">${avatar(auth.uid, monIdent(), 'lg')}
    <span class="cc-moi-t"><b>${h ? '@' + esc(h) : 'Choisis ton pseudo'}</b>${moiInfos()}</span>${svg(I.pen)}</button>`;
}

function actionsHtml(eleve) {
  return `<div class="cc-actions">
    <button class="cc-act pri" data-cc="defi">${svg(I.bolt)}<b>Lancer un défi</b></button>
    <button class="cc-act" data-cc="pin">${svg(I.hash)}<b>Entrer un code</b></button>
  </div>`;
}

/* ---------- ce qui se joue en ce moment ---------- */
export function enDirectHtml(salles) {
  const l = salles || [];
  if (!l.length) return '';
  return `<section class="cc-sec"><h2 class="cc-h">En direct</h2><div class="cc-lives">${l.map(s => `
    <div class="cc-live"><span class="cc-pulse" aria-hidden="true"></span>
      <span class="cc-live-t"><b>${esc(s.titre)}</b>${infos([['user', s.hote ? 'Toi' : s.hote_nom], s.classe || s.club ? ['users', s.classe || s.club] : null,
        ['play', s.joueurs, 'Joueurs']])}</span>
      <button class="cc-btn pri" data-cc="salle" data-id="${esc(s.id)}" data-pin="${esc(s.pin)}"
        data-dedans="${s.dedans || s.hote ? 1 : ''}">${s.hote ? 'Reprendre' : s.dedans ? 'Revenir' : 'Rejoindre'}</button>
    </div>`).join('')}</div></section>`;
}

/* Un défi « à son rythme » : à jouer en premier, puis ceux déjà joués, avec
   ma place. `ou` dit d'où il vient (un club, la classe, les amis). */
function ouDefi(du) {
  if (du.class_id) return 'Ta classe';
  if (du.group_id) { const g = (cercle.clubs || []).find(x => x.id === du.group_id); return g ? g.nom : 'Un club'; }
  return 'Amis';
}

export function defiLigne(du, avecOu = true) {
  const m = myScore(du.id), r = rankOf(du.id);
  const pos = m ? r.findIndex(x => x.user_id === auth.uid) + 1 : 0;
  return `<button class="cc-defi" data-duel="${esc(du.id)}">
    <i class="cc-defi-i">${svg(I.flame)}</i>
    <span class="cc-defi-t"><b>${esc(du.name)}</b>${infos([['user', shortWho(du.who) || 'Un ami'], avecOu ? ['users', ouDefi(du)] : null,
      ['card', du.total, 'Questions'], r.length ? ['play', r.length, 'Joueurs'] : null])}</span>
    ${m ? `<em class="cc-score"><b>${m.score}/${du.total}</b>${medaille(pos) ? medailleHtml(pos) : placeTexte(pos)}</em>`
      : `<em class="cc-ajouer">${svg(I.play)}Jouer</em>`}</button>`;
}

export const parDefi = l => (l || []).slice().sort((a, b) => (myScore(a.id) ? 1 : 0) - (myScore(b.id) ? 1 : 0));

function defisHtml() {
  const l = duels.list;
  if (!l) return `<section class="cc-sec"><h2 class="cc-h">Défis</h2><div class="cc-load"></div></section>`;
  const tri = parDefi(l), max = cercle.tous ? 40 : 4;
  return `<section class="cc-sec"><div class="cc-h"><h2>Défis</h2>${
    tri.length > 4 ? `<button class="cc-lnk" data-cc="tous">${cercle.tous ? 'Moins' : 'Tout voir · ' + tri.length}</button>` : ''}</div>
    ${tri.length ? `<div class="cc-list">${tri.slice(0, max).map(du => defiLigne(du)).join('')}</div>`
      : `<p class="cc-vide">${svg(I.flame)}Aucun défi</p>`}
  </section>`;
}

/* ---------- mes clubs ---------- */
export function clubCarte(g) {
  const rang = g.membres > 1 && g.mes_pages ? placeTexte(g.mon_rang) : '';
  return `<button class="cc-club" data-cc="club" data-id="${esc(g.id)}">
    ${blasonClub(g)}
    <span class="cc-club-t"><b>${esc(g.nom)}</b>${infos([['users', g.membres, 'Membres'], ['book', g.pages, 'Pages lues cette semaine']])}</span>
    ${g.en_direct ? '<em class="cc-tag live">En direct</em>' : rang ? `<em class="cc-tag">${rang}</em>` : ''}</button>`;
}

function clubsHtml() {
  const l = cercle.clubs;
  if (l === null) return `<section class="cc-sec"><h2 class="cc-h">Mes clubs</h2><div class="cc-load"></div></section>`;
  if (!l.length) return `<section class="cc-sec"><h2 class="cc-h">Mes clubs</h2>
    <div class="cc-nouveau"><i class="jt groupe xl" style="--k:var(--ink)">${svg(I.owl)}</i>
      <div class="cc-nv-b"><button class="cc-btn pri" data-cc="club-creer">${svg(I.plus)}Créer un club</button>
        <button class="cc-btn" data-cc="club-rejoindre">${svg(I.hash)}J’ai un code</button></div></div></section>`;
  return `<section class="cc-sec"><div class="cc-h"><h2>Mes clubs</h2>
      <button class="cc-lnk" data-cc="club-rejoindre">${svg(I.hash)}Code</button></div>
    <div class="cc-clubs">${l.map(clubCarte).join('')}
      <button class="cc-club neuf" data-cc="club-creer"><i class="jt groupe vide">${svg(I.plus)}</i>
        <span class="cc-club-t"><b>Créer un club</b></span></button>
    </div></section>`;
}

/* ---------- face aux amis ---------- */
/* `ident` : ce dont le jeton tire ses initiales — le pseudo s'il y en a un,
   sinon le nom. Le même partout (cercle, club, amis, fiches), pour qu'une
   personne ait le même visage d'un écran à l'autre. */
export const ident = (pseudo, nom) => pseudo || nom || '';

export function rangLigne(r, nom, sous) {
  return `<button class="cc-rk${r.moi ? ' moi' : ''}" data-lecteur="${esc(r.uid || r.user_id)}"><span class="cc-pl">${medailleHtml(r.place)}</span>
    ${avatar(r.uid || r.user_id, ident(r.handle || r.pseudo, nom), 'sm')}
    <span class="cc-rk-t"><b>${esc(nom)}${r.moi ? ' <small>toi</small>' : ''}</b>
      ${sous ? (Array.isArray(sous) ? infos(sous) : `<i>${esc(sous)}</i>`) : ''}<span class="cc-bar"><em style="width:${r.part}%"></em></span></span>
    <span class="cc-rk-n">${r.n != null ? r.n : r.pages}</span></button>`;
}

/* ---------- la porte du profil d'un lecteur ----------
   Toucher quelqu'un (un ami, une ligne de classement, un membre de club)
   ouvre son profil : ui/profil.js et sa feuille de style, chargés à la
   demande. Rien d'autre ne doit importer ui/profil.js. */
let profilMorceau = null;
export function ouvrirProfil(id, o = {}) {
  if (!id) return;
  cercle.profilClub = o.club || null;
  cercle.profilRetour = { name: view.name, id: view.id };
  setMateOpen(id);                   // les gestes d'ami (défier, prêter, retirer) lisent mateOpen
  profilPull(id);
  go('profil', id);
}
export function profilView() {
  if (profilMorceau) return profilMorceau.profilEcran();
  $.innerHTML = `<div class="page cc"><div class="cc-load"></div></div>`;
  import('./profil.js').then(m => { profilMorceau = m; if (view.name === 'profil') render(); })
    .catch(() => toast(I.x, 'Le profil n’a pas pu s’ouvrir : vérifie ta connexion'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lecteur]');
  if (b) ouvrirProfil(b.dataset.lecteur);
});

function classementCourt() {
  if (!board.rows) return `<div class="cc-load"></div>`;
  const l = classement(board.rows, 'n', auth.uid);
  if (l.length < 2) return `<p class="cc-vide">${svg(I.trophy)}Ajoute des amis</p>`;
  const top = l.slice(0, 5), moi = l.find(r => r.moi);
  if (moi && !top.includes(moi)) top.push(moi);
  return `<div class="cc-rank">${top.map(r => rangLigne(r, shortWho(r.who) || 'Lecteur')).join('')}</div>`;
}

function amisHtml(eleve) {
  const l = mates || [], a = (asks || []).length;
  return `<section class="cc-carte">
    <div class="cc-h"><h2>${eleve ? 'Camarades' : 'Amis'} <span>${l.length || ''}</span></h2>
      <button class="cc-lnk" data-act="friends" aria-label="Gérer">${a ? `<b class="cc-badge">${a}</b>` : ''}${svg(I.arrow)}</button></div>
    <div class="cc-amis">${l.slice(0, 11).map(f => `<button class="cc-ami" data-mate="${esc(f.id)}">
        ${avatar(f.id, f.handle || f.name)}<span>${esc((shortWho(f.name || f.handle) || '').split(' ')[0])}</span></button>`).join('')}
      <button class="cc-ami plus" data-act="friends"><i class="cc-av vide">${svg(I.plus)}</i><span>Ajouter</span></button></div>
  </section>`;
}

export function commuView() {
  const eleve = isPupil();
  $.innerHTML = `
    <div class="page cc" id="page">
      <div class="top"><div class="hero">Cercle des lecteurs</div></div>
      <div class="cc-grille">
        <div class="cc-main">
          ${moiHtml(eleve)}
          ${actionsHtml(eleve)}
          ${enDirectHtml(cercle.salles)}
          ${defisHtml()}
          ${eleve ? '' : clubsHtml()}
        </div>
        <aside class="cc-cote">
          <section class="cc-carte"><div class="cc-h"><h2>Classement ${hlp('classement')}</h2>
            <button class="cc-lnk" data-act="friends" aria-label="Tout voir">${svg(I.arrow)}</button></div>
            ${classementCourt()}</section>
          ${amisHtml(eleve)}
        </aside>
      </div>
    </div>
    ${tabs('commu')}`;
  bindPager();
}

/* ══════════ la page des amis ══════════
   Ajouter quelqu'un par son pseudo, répondre aux demandes, et le classement
   complet, sur 7 jours, 30 jours ou depuis toujours. Un élève de classe
   n'a pas d'annuaire : il ajoute ses camarades depuis leur liste. */
function demandesHtml() {
  const a = asks || [];
  if (!a.length) return '';
  return `<section class="cc-sec"><h2 class="cc-h">Demandes <span>${a.length}</span></h2>
    <div class="cc-list">${a.map(f => `<div class="cc-ligne"><button class="cc-qui" data-lecteur="${esc(f.id)}">${avatar(f.id, f.handle || f.name)}
      <span class="cc-ligne-t"><b>${esc(f.name || '')}</b><i>@${esc(f.handle || '')}</i></span></button>
      <button class="cc-rond ok" data-yes="${esc(f.id)}" aria-label="Accepter">${svg(I.check)}</button>
      <button class="cc-rond" data-no="${esc(f.id)}" aria-label="Refuser">${svg(I.x)}</button></div>`).join('')}</div></section>`;
}

function mesAmisHtml(eleve) {
  const l = mates || [];
  const pages = new Map((board.rows || []).map(r => [r.uid, +r.n]));
  if (!friends) return `<div class="cc-load"></div>`;
  if (!l.length) return `<p class="cc-vide">${svg(I.users)}Personne pour l’instant</p>`;
  return `<div class="cc-list">${l.map(f => `<button class="cc-ligne" data-mate="${esc(f.id)}">${avatar(f.id, f.handle || f.name)}
    <span class="cc-ligne-t"><b>${esc(f.name || '')}</b><i>${f.handle ? '@' + esc(f.handle) : ''}</i></span>
    ${infos([['book', pages.get(f.id) || 0, 'Pages lues']])}${svg(I.arrow)}</button>`).join('')}</div>`;
}

function classementLong() {
  const seg = `<div class="seg" id="bRange">${Object.entries(BRANGE).map(([k, n]) =>
    `<button class="${board.range === +k ? 'on' : ''}" data-brange="${k}">${n}</button>`).join('')}</div>`;
  if (!board.rows) return seg + `<div class="cc-load"></div>`;
  const l = classement(board.rows, 'n', auth.uid);
  if (!l.length) return seg + `<p class="cc-vide">${svg(I.trophy)}Aucune lecture</p>`;
  return seg + `<div class="cc-rank">${l.map(r => rangLigne(r, shortWho(r.who) || 'Lecteur',
    [['check', Math.round(r.ok / (r.n || 1) * 100) + ' %', 'Réponses justes'], ['cal', +r.jours, 'Jours de lecture']])).join('')}</div>`;
}

export function friendsView() {
  const eleve = isPupil();
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>${eleve ? 'Camarades' : 'Amis'}</h1></div>
    <div class="page cc">
      <div class="cc-grille">
        <div class="cc-main">
          ${eleve ? '' : `<form class="cc-ajout" id="ccadd" autocomplete="off">
            <span class="cc-at">@</span><input id="addq" type="search" placeholder="Pseudo d’un ami" enterkeyhint="send"
              autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(addQ)}" aria-label="Pseudo d’un ami">
            <button class="cc-btn pri" data-act="doadd">Ajouter</button></form>`}
          ${demandesHtml()}
          ${eleve && (mates2 || []).length ? camaradesHtml() : ''}
          <section class="cc-sec"><h2 class="cc-h">Amis <span>${(mates || []).length || ''}</span></h2>
            ${mesAmisHtml(eleve)}</section>
        </div>
        <aside class="cc-cote"><section class="cc-carte"><h2 class="cc-h">Classement ${hlp('classement')}</h2>${classementLong()}</section></aside>
      </div>
    </div>`;
  const q = document.getElementById('addq'), f = document.getElementById('ccadd');
  if (q) q.addEventListener('input', () => setAddQ(q.value));
  if (f) f.onsubmit = e => { e.preventDefault(); doAdd(); };
}

export async function doAdd() {
  const v = addQ.trim().replace(/^@/, ''); if (!v) return;
  if (await askFriend(v)) { setAddQ(''); setAnimate(false); render(); }
}
